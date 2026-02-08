"""
Screen Capture & WebRTC Streaming Controller
=============================================
Captures the desktop using *mss*, wraps frames in an aiortc VideoStreamTrack,
and delivers them over WebRTC with adaptive quality control.

Key features:
  • Low-latency capture → encode → transmit pipeline  (<100 ms target)
  • Adaptive resolution / FPS / bitrate based on network RTT
  • Multiple quality presets (low / medium / high / ultra)
  • Thread-safe frame producer  →  async consumer  bridge
  • Graceful connection lifecycle management
"""

from __future__ import annotations

import asyncio
import fractions
import json
import logging
import threading
import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

import av
import mss
import numpy as np
from aiortc import (
    MediaStreamTrack,
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
)
from aiortc.sdp import candidate_from_sdp
from aiortc.contrib.media import MediaRelay

logger = logging.getLogger("screen_controller")

# ── Quality Presets ──────────────────────────────────────────────────────────


class QualityPreset(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    ULTRA = "ultra"


@dataclass
class QualityProfile:
    width: int
    height: int
    fps: int
    bitrate: int  # kbps

    @property
    def frame_interval(self) -> float:
        return 1.0 / self.fps


QUALITY_PRESETS: Dict[QualityPreset, QualityProfile] = {
    QualityPreset.LOW: QualityProfile(width=640, height=360, fps=15, bitrate=500),
    QualityPreset.MEDIUM: QualityProfile(width=960, height=540, fps=24, bitrate=1200),
    QualityPreset.HIGH: QualityProfile(width=1280, height=720, fps=30, bitrate=2500),
    QualityPreset.ULTRA: QualityProfile(width=1920, height=1080, fps=30, bitrate=4000),
}


# ── Screen Capture Track ────────────────────────────────────────────────────


class ScreenCaptureTrack(MediaStreamTrack):
    """
    aiortc MediaStreamTrack that captures the desktop screen.

    Uses a background thread for mss screen grabbing (CPU-bound) and
    bridges frames into the asyncio event loop.

    Frame pipeline:
      mss.grab() → numpy → resize → av.VideoFrame → WebRTC encode → network
    """

    kind = "video"

    def __init__(self, quality: QualityPreset = QualityPreset.MEDIUM):
        super().__init__()
        self._quality = QUALITY_PRESETS[quality]
        self._quality_preset = quality
        self._started = False
        self._frame_count = 0
        self._start_time: Optional[float] = None

        # Frame exchange
        self._latest_frame: Optional[av.VideoFrame] = None
        self._frame_lock = threading.Lock()
        self._frame_event = asyncio.Event()

        # Capture thread
        self._capture_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Adaptive quality
        self._rtt_samples: list[float] = []
        self._last_quality_check = 0.0

    # ── Quality control ──────────────────────────────────────────────────

    def set_quality(self, preset: QualityPreset) -> None:
        """Change quality preset on the fly."""
        self._quality = QUALITY_PRESETS[preset]
        self._quality_preset = preset
        logger.info(f"Quality changed to {preset.value}: "
                     f"{self._quality.width}x{self._quality.height}@{self._quality.fps}fps")

    def report_rtt(self, rtt_ms: float) -> None:
        """Feed network RTT for adaptive quality decisions."""
        self._rtt_samples.append(rtt_ms)
        if len(self._rtt_samples) > 30:
            self._rtt_samples.pop(0)

        now = time.monotonic()
        if now - self._last_quality_check > 3.0:
            self._last_quality_check = now
            self._adapt_quality()

    def _adapt_quality(self) -> None:
        """Automatically adjust quality based on average RTT."""
        if len(self._rtt_samples) < 5:
            return
        avg_rtt = sum(self._rtt_samples) / len(self._rtt_samples)

        if avg_rtt > 200:
            target = QualityPreset.LOW
        elif avg_rtt > 100:
            target = QualityPreset.MEDIUM
        elif avg_rtt > 50:
            target = QualityPreset.HIGH
        else:
            target = QualityPreset.ULTRA

        if target != self._quality_preset:
            logger.info(f"Adaptive quality: RTT avg={avg_rtt:.0f}ms → {target.value}")
            self.set_quality(target)

    @property
    def current_quality_info(self) -> dict:
        q = self._quality
        return {
            "preset": self._quality_preset.value,
            "width": q.width,
            "height": q.height,
            "fps": q.fps,
            "bitrate_kbps": q.bitrate,
        }

    # ── Capture thread ───────────────────────────────────────────────────

    def _capture_loop(self) -> None:
        """Background thread: grabs screen → produces av.VideoFrame."""
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # Primary monitor
            logger.info(f"Capturing monitor: {monitor['width']}x{monitor['height']}")

            while not self._stop_event.is_set():
                loop_start = time.monotonic()

                try:
                    # Grab screen
                    shot = sct.grab(monitor)
                    img = np.array(shot)  # BGRA

                    # BGRA → BGR (drop alpha)
                    img_bgr = img[:, :, :3]

                    # Resize to target resolution
                    q = self._quality
                    src_h, src_w = img_bgr.shape[:2]

                    if src_w != q.width or src_h != q.height:
                        # Fast resize using numpy slicing + simple downscale
                        img_bgr = self._fast_resize(img_bgr, q.width, q.height)

                    # BGR → RGB for av
                    img_rgb = img_bgr[:, :, ::-1].copy()

                    # Create av.VideoFrame
                    frame = av.VideoFrame.from_ndarray(img_rgb, format="rgb24")
                    frame.pts = self._frame_count
                    frame.time_base = fractions.Fraction(1, q.fps)

                    with self._frame_lock:
                        self._latest_frame = frame
                        self._frame_count += 1

                    # Signal the async consumer
                    if self._loop and not self._loop.is_closed():
                        self._loop.call_soon_threadsafe(self._frame_event.set)

                except Exception as exc:
                    logger.warning(f"Capture error: {exc}")

                # Frame rate limiter
                elapsed = time.monotonic() - loop_start
                sleep_time = self._quality.frame_interval - elapsed
                if sleep_time > 0:
                    self._stop_event.wait(sleep_time)

        logger.info("Capture thread stopped")

    @staticmethod
    def _fast_resize(img: np.ndarray, target_w: int, target_h: int) -> np.ndarray:
        """
        Resize without OpenCV dependency — uses numpy index mapping for
        nearest-neighbor scaling (both up and down) which is very fast.
        Always produces exact target dimensions.
        """
        src_h, src_w = img.shape[:2]
        # Build index arrays for nearest-neighbor mapping
        row_indices = (np.arange(target_h) * src_h // target_h).astype(int)
        col_indices = (np.arange(target_w) * src_w // target_w).astype(int)
        return img[np.ix_(row_indices, col_indices)]

    # ── MediaStreamTrack interface ───────────────────────────────────────

    async def recv(self) -> av.VideoFrame:
        """Called by aiortc to get the next frame."""
        if not self._started:
            self._started = True
            self._start_time = time.monotonic()
            self._loop = asyncio.get_running_loop()
            self._capture_thread = threading.Thread(
                target=self._capture_loop, daemon=True
            )
            self._capture_thread.start()
            logger.info("Screen capture started")

        # Wait for a new frame
        self._frame_event.clear()
        try:
            await asyncio.wait_for(self._frame_event.wait(), timeout=1.0)
        except asyncio.TimeoutError:
            pass

        with self._frame_lock:
            frame = self._latest_frame

        if frame is None:
            # Return a blank frame if no capture yet
            frame = av.VideoFrame(
                width=self._quality.width,
                height=self._quality.height,
                format="rgb24",
            )
            frame.pts = 0
            frame.time_base = fractions.Fraction(1, self._quality.fps)

        return frame

    def stop(self) -> None:
        """Clean shutdown of capture thread."""
        self._stop_event.set()
        super().stop()
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=2.0)
        logger.info("ScreenCaptureTrack stopped")


# ── WebRTC Connection Manager ────────────────────────────────────────────────


class ScreenController:
    """
    Manages WebRTC peer connections for screen streaming.

    Supports multiple simultaneous viewers with independent quality settings.
    Uses STUN servers for NAT traversal (long-distance support).
    """

    # Public STUN servers for NAT traversal
    ICE_SERVERS = [
        RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
        RTCIceServer(urls=["stun:stun1.l.google.com:19302"]),
        RTCIceServer(urls=["stun:stun2.l.google.com:19302"]),
        RTCIceServer(urls=["stun:stun.stunprotocol.org:3478"]),
    ]

    def __init__(self):
        self._connections: Dict[str, RTCPeerConnection] = {}
        self._tracks: Dict[str, ScreenCaptureTrack] = {}
        self._relay = MediaRelay()
        self._connection_counter = 0

    async def create_offer(
        self,
        sdp: str,
        sdp_type: str,
        quality: str = "medium",
    ) -> dict:
        """
        Handle incoming SDP offer from a client.
        Creates a peer connection, attaches screen capture track,
        and returns an SDP answer.
        """
        self._connection_counter += 1
        conn_id = f"screen_{self._connection_counter}_{int(time.time())}"

        config = RTCConfiguration(iceServers=self.ICE_SERVERS)
        pc = RTCPeerConnection(configuration=config)

        # Quality preset
        preset = QualityPreset.MEDIUM
        try:
            preset = QualityPreset(quality)
        except ValueError:
            pass

        # Create screen capture track
        track = ScreenCaptureTrack(quality=preset)

        # Store references
        self._connections[conn_id] = pc
        self._tracks[conn_id] = track

        # Add the video track to the peer connection
        pc.addTrack(track)

        # Set up data channel for stats & quality control
        dc = pc.createDataChannel("stats", ordered=False)

        @dc.on("message")
        def on_message(message):
            try:
                msg = json.loads(message)
                if msg.get("type") == "rtt_report":
                    track.report_rtt(msg.get("rtt", 0))
                elif msg.get("type") == "quality_change":
                    try:
                        new_preset = QualityPreset(msg.get("quality", "medium"))
                        track.set_quality(new_preset)
                    except ValueError:
                        pass
            except Exception:
                pass

        @pc.on("connectionstatechange")
        async def on_state_change():
            state = pc.connectionState
            logger.info(f"[{conn_id}] Connection state: {state}")
            if state in ("failed", "closed", "disconnected"):
                await self._cleanup_connection(conn_id)

        @pc.on("iceconnectionstatechange")
        async def on_ice_state_change():
            logger.info(f"[{conn_id}] ICE state: {pc.iceConnectionState}")

        # Set remote description (client's offer)
        offer = RTCSessionDescription(sdp=sdp, type=sdp_type)
        await pc.setRemoteDescription(offer)

        # Create and set local description (our answer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        logger.info(f"[{conn_id}] WebRTC connection established "
                     f"({preset.value} quality)")

        return {
            "connection_id": conn_id,
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type,
            "quality": track.current_quality_info,
        }

    async def add_ice_candidate(
        self, connection_id: str, candidate: dict
    ) -> dict:
        """Add a trickle ICE candidate to an existing connection."""
        pc = self._connections.get(connection_id)
        if not pc:
            return {"error": f"Connection {connection_id} not found"}

        try:
            candidate_sdp = candidate.get("candidate", "")
            if not candidate_sdp:
                return {"ok": True}  # Empty candidate = end-of-candidates

            # Parse the SDP candidate string into an RTCIceCandidate object
            ice_candidate = candidate_from_sdp(candidate_sdp)
            ice_candidate.sdpMid = candidate.get("sdpMid")
            ice_candidate.sdpMLineIndex = candidate.get("sdpMLineIndex")
            await pc.addIceCandidate(ice_candidate)
            return {"ok": True}
        except Exception as exc:
            return {"error": str(exc)}

    async def change_quality(
        self, connection_id: str, quality: str
    ) -> dict:
        """Change quality for an active connection."""
        track = self._tracks.get(connection_id)
        if not track:
            return {"error": f"Connection {connection_id} not found"}

        try:
            preset = QualityPreset(quality)
            track.set_quality(preset)
            return {"ok": True, "quality": track.current_quality_info}
        except ValueError:
            return {"error": f"Invalid quality preset: {quality}"}

    async def get_stats(self, connection_id: str) -> dict:
        """Get stream statistics for a connection."""
        pc = self._connections.get(connection_id)
        track = self._tracks.get(connection_id)
        if not pc or not track:
            return {"error": f"Connection {connection_id} not found"}

        return {
            "connection_state": pc.connectionState,
            "ice_state": pc.iceConnectionState,
            "quality": track.current_quality_info,
        }

    async def stop_stream(self, connection_id: str) -> dict:
        """Stop a specific stream."""
        await self._cleanup_connection(connection_id)
        return {"ok": True}

    async def _cleanup_connection(self, conn_id: str) -> None:
        """Clean up a peer connection and its resources."""
        track = self._tracks.pop(conn_id, None)
        if track:
            track.stop()

        pc = self._connections.pop(conn_id, None)
        if pc:
            await pc.close()

        logger.info(f"[{conn_id}] Cleaned up")

    async def cleanup_all(self) -> None:
        """Shut down all connections (server shutdown)."""
        conn_ids = list(self._connections.keys())
        for conn_id in conn_ids:
            await self._cleanup_connection(conn_id)
        logger.info("All screen connections cleaned up")

    @property
    def active_connections(self) -> int:
        return len(self._connections)
