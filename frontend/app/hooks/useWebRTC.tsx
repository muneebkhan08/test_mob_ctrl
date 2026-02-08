"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "./useWebSocket";

// ── Types ───────────────────────────────────────────────────────────────────

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "error";

export type QualityPreset = "low" | "medium" | "high" | "ultra";

export interface StreamStats {
  fps: number;
  latency: number;
  resolution: string;
  bitrate: number;
  quality: QualityPreset;
  packetsLost: number;
  jitter: number;
  connectionState: string;
}

interface WebRTCContextValue {
  streamStatus: StreamStatus;
  streamStats: StreamStats;
  connectionId: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startStream: (quality?: QualityPreset) => Promise<void>;
  stopStream: () => Promise<void>;
  changeQuality: (quality: QualityPreset) => Promise<void>;
  streamError: string | null;
}

const DEFAULT_STATS: StreamStats = {
  fps: 0,
  latency: 0,
  resolution: "—",
  bitrate: 0,
  quality: "medium",
  packetsLost: 0,
  jitter: 0,
  connectionState: "new",
};

const WebRTCContext = createContext<WebRTCContextValue | null>(null);

// ── ICE Servers ─────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ── Provider ────────────────────────────────────────────────────────────────

const STATS_INTERVAL = 1000;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function WebRTCProvider({ children }: { children: ReactNode }) {
  const { serverIp, status: wsStatus } = useWebSocket();

  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [streamStats, setStreamStats] = useState<StreamStats>(DEFAULT_STATS);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);
  const currentQualityRef = useRef<QualityPreset>("medium");
  const connectionIdRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);

  // ── Server URL builder ────────────────────────────────────────────────

  const getServerUrl = useCallback(() => {
    if (!serverIp) return null;
    const host = serverIp.includes(":") ? serverIp : `${serverIp}:8765`;
    return `http://${host}`;
  }, [serverIp]);

  // ── Stats collection ──────────────────────────────────────────────────

  const startStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    let prevBytesReceived = 0;
    let prevTimestamp = 0;
    let prevFramesDecoded = 0;

    statsIntervalRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const stats = await pc.getStats();
        let newStats = { ...DEFAULT_STATS, quality: currentQualityRef.current };

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            // FPS calculation
            const now = report.timestamp;
            const framesDecoded = report.framesDecoded || 0;
            if (prevTimestamp > 0) {
              const timeDelta = (now - prevTimestamp) / 1000;
              const framesDelta = framesDecoded - prevFramesDecoded;
              newStats.fps = Math.round(framesDelta / timeDelta);
            }
            prevFramesDecoded = framesDecoded;
            prevTimestamp = now;

            // Bitrate
            const bytesReceived = report.bytesReceived || 0;
            if (prevBytesReceived > 0) {
              const bytesDelta = bytesReceived - prevBytesReceived;
              newStats.bitrate = Math.round(
                (bytesDelta * 8) / (STATS_INTERVAL / 1000) / 1000
              );
            }
            prevBytesReceived = bytesReceived;

            // Resolution
            if (report.frameWidth && report.frameHeight) {
              newStats.resolution = `${report.frameWidth}×${report.frameHeight}`;
            }

            // Packet loss & jitter
            newStats.packetsLost = report.packetsLost || 0;
            newStats.jitter = Math.round((report.jitter || 0) * 1000);
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            newStats.latency = Math.round(
              report.currentRoundTripTime
                ? report.currentRoundTripTime * 1000
                : 0
            );
          }
        });

        newStats.connectionState = pc.connectionState;
        setStreamStats(newStats);

        // Send RTT back to server for adaptive quality
        const dc = dataChannelRef.current;
        if (dc?.readyState === "open" && newStats.latency > 0) {
          dc.send(
            JSON.stringify({
              type: "rtt_report",
              rtt: newStats.latency,
            })
          );
        }
      } catch {
        // ignore stats errors
      }
    }, STATS_INTERVAL);
  }, []);

  const stopStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = undefined;
    }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    stopStatsCollection();

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.ondatachannel = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopStatsCollection]);

  // ── Start Stream ──────────────────────────────────────────────────────

  const startStream = useCallback(
    async (quality: QualityPreset = "medium") => {
      const baseUrl = getServerUrl();
      if (!baseUrl) {
        setStreamError("Not connected to server");
        return;
      }

      isStoppingRef.current = false;
      setStreamError(null);
      setStreamStatus("connecting");
      currentQualityRef.current = quality;

      try {
        // Clean up any existing connection
        cleanup();

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          // Lower ICE candidate gathering timeout
          iceCandidatePoolSize: 2,
        });
        pcRef.current = pc;

        // Handle incoming video track
        pc.ontrack = (event) => {
          if (event.track.kind === "video" && videoRef.current) {
            const stream = new MediaStream([event.track]);
            videoRef.current.srcObject = stream;
            videoRef.current
              .play()
              .catch((e) => console.warn("Video play error:", e));
          }
        };

        // Handle incoming data channel (for stats)
        pc.ondatachannel = (event) => {
          dataChannelRef.current = event.channel;
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === "connected") {
            setStreamStatus("streaming");
            reconnectAttemptsRef.current = 0;
            startStatsCollection();
          } else if (state === "disconnected" || state === "failed") {
            if (!isStoppingRef.current) {
              handleReconnect();
            }
          } else if (state === "closed") {
            if (!isStoppingRef.current) {
              setStreamStatus("idle");
            }
          }
        };

        // Add transceivers for receiving video
        pc.addTransceiver("video", { direction: "recvonly" });

        // Create offer
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });
        await pc.setLocalDescription(offer);

        // Trickle ICE candidates to server
        pc.onicecandidate = async (event) => {
          if (event.candidate && connectionIdRef.current) {
            try {
              await fetch(`${baseUrl}/webrtc/ice`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  connection_id: connectionIdRef.current,
                  candidate: {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                  },
                }),
              });
            } catch {
              // ICE candidate send failure is non-fatal
            }
          }
        };

        // Send offer to server
        const response = await fetch(`${baseUrl}/webrtc/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
            quality,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const answer = await response.json();

        if (answer.error) {
          throw new Error(answer.error);
        }

        connectionIdRef.current = answer.connection_id;
        setConnectionId(answer.connection_id);

        // Set remote description (server's answer)
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            sdp: answer.sdp,
            type: answer.type,
          })
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to start stream";
        setStreamError(msg);
        setStreamStatus("error");
        cleanup();
      }
    },
    [getServerUrl, cleanup, startStatsCollection]
  );

  // ── Reconnect ─────────────────────────────────────────────────────────

  const handleReconnect = useCallback(() => {
    if (isStoppingRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStreamStatus("error");
      setStreamError("Connection lost. Tap to retry.");
      return;
    }

    setStreamStatus("reconnecting");
    reconnectAttemptsRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      startStream(currentQualityRef.current);
    }, RECONNECT_DELAY);
  }, [startStream]);

  // ── Stop Stream ───────────────────────────────────────────────────────

  const stopStream = useCallback(async () => {
    isStoppingRef.current = true;

    // Notify server
    const baseUrl = getServerUrl();
    if (baseUrl && connectionIdRef.current) {
      try {
        await fetch(`${baseUrl}/webrtc/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connection_id: connectionIdRef.current,
          }),
        });
      } catch {
        // ignore cleanup errors
      }
    }

    cleanup();
    connectionIdRef.current = null;
    setConnectionId(null);
    setStreamStatus("idle");
    setStreamStats(DEFAULT_STATS);
    setStreamError(null);
    reconnectAttemptsRef.current = 0;
  }, [getServerUrl, cleanup]);

  // ── Change Quality ────────────────────────────────────────────────────

  const changeQuality = useCallback(
    async (quality: QualityPreset) => {
      currentQualityRef.current = quality;

      // Send via data channel (fastest path)
      const dc = dataChannelRef.current;
      if (dc?.readyState === "open") {
        dc.send(JSON.stringify({ type: "quality_change", quality }));
        setStreamStats((prev) => ({ ...prev, quality }));
        return;
      }

      // Fallback: HTTP endpoint
      const baseUrl = getServerUrl();
      if (baseUrl && connectionIdRef.current) {
        try {
          await fetch(`${baseUrl}/webrtc/quality`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connection_id: connectionIdRef.current,
              quality,
            }),
          });
          setStreamStats((prev) => ({ ...prev, quality }));
        } catch {
          // ignore
        }
      }
    },
    [getServerUrl]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  // Stop stream when WS disconnects
  useEffect(() => {
    if (wsStatus === "disconnected" && streamStatus !== "idle") {
      stopStream();
    }
  }, [wsStatus, streamStatus, stopStream]);

  return (
    <WebRTCContext.Provider
      value={{
        streamStatus,
        streamStats,
        connectionId,
        videoRef,
        startStream,
        stopStream,
        changeQuality,
        streamError,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useWebRTC() {
  const ctx = useContext(WebRTCContext);
  if (!ctx)
    throw new Error("useWebRTC must be used inside WebRTCProvider");
  return ctx;
}
