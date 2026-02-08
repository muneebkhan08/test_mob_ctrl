"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Volume2,
  VolumeX,
  Volume1,
  Minus,
  Plus,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  Music,
} from "lucide-react";

export default function MediaVolume() {
  const { send, sendAndWait, status } = useWebSocket();
  const disabled = status !== "connected";

  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch volume on connect
  useEffect(() => {
    if (status === "connected") {
      sendAndWait("volume_get").then((data: unknown) => {
        const d = data as { volume?: number; muted?: boolean } | null;
        if (d) {
          if (d.volume !== undefined && d.volume >= 0) setVolume(d.volume);
          if (d.muted !== undefined) setMuted(d.muted);
        }
      });
    }
  }, [status, sendAndWait]);

  const handleVolumeChange = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(100, val));
      setVolume(clamped);
      send("volume_set", { level: clamped });
    },
    [send]
  );

  const toggleMute = useCallback(() => {
    send("volume_mute");
    setMuted(!muted);
  }, [send, muted]);

  const VolumeIcon = muted ? VolumeX : volume > 50 ? Volume2 : Volume1;

  return (
    <div className="px-1 space-y-6">
      {/* ── Volume Section ────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-accent/50" />
          <h2 className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-300">VOL</h2>
        </div>

        {/* Volume Display */}
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(148,163,184,0.06)"
                strokeWidth="5"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={muted ? "#ff3355" : "#00ffc8"}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${volume * 2.64} 264`}
                className="transition-all duration-200"
              />
            </svg>
            <button
              onClick={toggleMute}
              disabled={disabled}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex flex-col items-center gap-1 disabled:opacity-30"
            >
              <VolumeIcon
                size={22}
                className={muted ? "text-danger" : "text-accent"}
              />
              <span className="text-base font-mono font-bold text-surface-200 tracking-wider">
                {muted ? "MUTE" : `${volume}%`}
              </span>
            </button>
          </div>
        </div>

        {/* Slider */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleVolumeChange(volume - 5)}
            disabled={disabled}
            aria-label="Volume down"
            className="btn-control w-9 h-9 text-surface-500 disabled:opacity-30"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            disabled={disabled}
            aria-label="Volume level"
            className="flex-1 disabled:opacity-30"
          />
          <button
            onClick={() => handleVolumeChange(volume + 5)}
            disabled={disabled}
            aria-label="Volume up"
            className="btn-control w-9 h-9 text-surface-500 disabled:opacity-30"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Quick Volume Presets */}
        <div className="grid grid-cols-5 gap-1">
          {[0, 25, 50, 75, 100].map((level) => (
            <button
              key={level}
              onClick={() => handleVolumeChange(level)}
              disabled={disabled}
              className={`btn-control h-8 text-[10px] font-mono tracking-wider disabled:opacity-30 ${
                volume === level
                  ? "text-accent border-accent/25 bg-accent/8 text-glow"
                  : "text-surface-500"
              }`}
            >
              {level}%
            </button>
          ))}
        </div>
      </div>

      {/* ── Media Controls ────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Music size={14} className="text-accent/50" />
          <h2 className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-300">
            MEDIA
          </h2>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => send("media_prev")}
            disabled={disabled}
            aria-label="Previous track"
            className="btn-control w-12 h-12 text-surface-400 disabled:opacity-30"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={() => {
              send("media_play_pause");
              setIsPlaying(!isPlaying);
            }}
            disabled={disabled}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="btn-control w-14 h-14 text-accent bg-accent/8 border-accent/15 disabled:opacity-30"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>

          <button
            onClick={() => send("media_next")}
            disabled={disabled}
            aria-label="Next track"
            className="btn-control w-12 h-12 text-surface-400 disabled:opacity-30"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => {
              send("media_stop");
              setIsPlaying(false);
            }}
            disabled={disabled}
            className="btn-control px-5 h-9 text-[10px] font-mono tracking-wider uppercase text-surface-500 gap-1.5 disabled:opacity-30"
          >
            <Square size={13} /> Stop
          </button>
        </div>
      </div>
    </div>
  );
}
