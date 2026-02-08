"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useWebRTC,
  type QualityPreset,
  type StreamStats,
} from "../hooks/useWebRTC";
import {
  Play,
  Square,
  Maximize,
  Minimize,
  RefreshCw,
  Monitor,
  Gauge,
  Signal,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ── Quality presets config ──────────────────────────────────────────────────

const QUALITY_OPTIONS: {
  value: QualityPreset;
  label: string;
  desc: string;
}[] = [
  { value: "low", label: "Low", desc: "360p • 15fps" },
  { value: "medium", label: "Medium", desc: "540p • 24fps" },
  { value: "high", label: "High", desc: "720p • 30fps" },
  { value: "ultra", label: "Ultra", desc: "1080p • 30fps" },
];

// ── Stats Badge ─────────────────────────────────────────────────────────────

function StatsBadge({ stats }: { stats: StreamStats }) {
  const latencyColor =
    stats.latency < 50
      ? "text-emerald-400"
      : stats.latency < 100
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="flex items-center gap-3 text-[10px] font-mono">
      <span className={`flex items-center gap-1 ${latencyColor}`}>
        <Signal size={10} />
        {stats.latency}ms
      </span>
      <span className="text-surface-400">
        {stats.fps > 0 ? `${stats.fps}fps` : "—"}
      </span>
      <span className="text-surface-400">{stats.resolution}</span>
      {stats.bitrate > 0 && (
        <span className="text-surface-400">
          {stats.bitrate > 1000
            ? `${(stats.bitrate / 1000).toFixed(1)}Mbps`
            : `${stats.bitrate}kbps`}
        </span>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ScreenViewer() {
  const {
    streamStatus,
    streamStats,
    videoRef,
    startStream,
    stopStream,
    changeQuality,
    streamError,
  } = useWebRTC();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedQuality, setSelectedQuality] =
    useState<QualityPreset>("medium");
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isStreaming = streamStatus === "streaming";
  const isConnecting =
    streamStatus === "connecting" || streamStatus === "reconnecting";

  // ── Auto-hide controls ────────────────────────────────────────────────

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isStreaming) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      resetControlsTimer();
    } else {
      setShowControls(true);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isStreaming, resetControlsTimer]);

  // ── Fullscreen ────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        // Force landscape on mobile
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch {
          // Not all browsers support orientation lock
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        try {
          screen.orientation?.unlock?.();
        } catch {}
      }
    } catch {
      // Fullscreen not supported
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Quality change ────────────────────────────────────────────────────

  const handleQualityChange = useCallback(
    async (quality: QualityPreset) => {
      setSelectedQuality(quality);
      await changeQuality(quality);
      setShowSettings(false);
    },
    [changeQuality]
  );

  // ── Start/Stop handlers ───────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    await startStream(selectedQuality);
  }, [startStream, selectedQuality]);

  const handleStop = useCallback(async () => {
    if (isFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    await stopStream();
  }, [stopStream, isFullscreen]);

  const handleRetry = useCallback(async () => {
    await startStream(selectedQuality);
  }, [startStream, selectedQuality]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full ${
        isFullscreen ? "bg-black" : ""
      }`}
      onClick={isStreaming ? resetControlsTimer : undefined}
    >
      {/* ── Video area ─────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center min-h-0 rounded-2xl overflow-hidden bg-surface-900/80 border border-surface-700/30">
        {/* Video element (always mounted) */}
        <video
          ref={videoRef as React.LegacyRef<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain bg-black transition-opacity duration-300 ${
            isStreaming ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* ── Idle state ──────────────────────── */}
        {streamStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Monitor size={28} className="text-accent" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-surface-200">
                Screen Stream
              </p>
              <p className="text-xs text-surface-400">
                View your PC screen in real-time
              </p>
            </div>

            {/* Quality selector */}
            <div className="flex gap-1.5 mt-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedQuality(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    selectedQuality === opt.value
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-surface-800 text-surface-400 border border-surface-700/30 hover:text-surface-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-sm font-medium transition-all active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              Start Stream
            </button>
          </div>
        )}

        {/* ── Connecting state ────────────────── */}
        {isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900/80">
            <Loader2
              size={32}
              className="text-accent animate-spin"
            />
            <p className="text-sm text-surface-300">
              {streamStatus === "reconnecting"
                ? "Reconnecting…"
                : "Connecting…"}
            </p>
          </div>
        )}

        {/* ── Error state ─────────────────────── */}
        {streamStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900/80">
            <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
              <AlertCircle size={24} className="text-danger" />
            </div>
            <p className="text-sm text-surface-300 text-center px-4">
              {streamError || "Stream failed"}
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 border border-surface-700/30 text-sm text-surface-200 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* ── Streaming overlay controls ──────── */}
        {isStreaming && (
          <>
            {/* Top bar - stats */}
            <div
              className={`absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white/70 font-medium">
                    LIVE
                  </span>
                </div>
                <StatsBadge stats={streamStats} />
              </div>
            </div>

            {/* Bottom bar - controls */}
            <div
              className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Stop button */}
                <button
                  onClick={handleStop}
                  title="Stop stream"
                  className="p-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-all active:scale-95"
                >
                  <Square size={16} fill="currentColor" />
                </button>

                {/* Quality + Settings */}
                <div className="flex items-center gap-2">
                  {/* Quality indicator */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 text-white/80 text-[10px] font-medium transition-all hover:bg-white/20"
                    >
                      <Gauge size={12} />
                      {streamStats.quality.toUpperCase()}
                      <ChevronDown size={10} />
                    </button>

                    {/* Quality dropdown */}
                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 w-40 rounded-xl bg-surface-800/95 backdrop-blur border border-surface-700/50 shadow-xl overflow-hidden z-10">
                        {QUALITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleQualityChange(opt.value)}
                            className={`w-full text-left px-3 py-2.5 text-xs transition-all ${
                              streamStats.quality === opt.value
                                ? "bg-accent/15 text-accent"
                                : "text-surface-300 hover:bg-surface-700/50"
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-[9px] text-surface-500 mt-0.5">
                              {opt.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen toggle */}
                  <button
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    className="p-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-all active:scale-95"
                  >
                    {isFullscreen ? (
                      <Minimize size={16} />
                    ) : (
                      <Maximize size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
