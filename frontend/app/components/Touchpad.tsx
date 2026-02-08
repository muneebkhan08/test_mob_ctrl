"use client";

import { useRef, useCallback, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  MousePointer2,
  Hand,
  ArrowUpDown,
} from "lucide-react";

const SENSITIVITY = 1.8;
const SCROLL_SENSITIVITY = 0.8;
const TAP_THRESHOLD = 150; // ms
const TAP_MOVE_THRESHOLD = 8; // px

export default function Touchpad() {
  const { send, status } = useWebSocket();
  const disabled = status !== "connected";

  // ── Touch State ───────────────────────────
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    fingers: number;
  } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const totalMoveRef = useRef(0);
  const [activeFingers, setActiveFingers] = useState(0);

  // ── Handlers ──────────────────────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      const fingers = e.touches.length;
      setActiveFingers(fingers);

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        fingers,
      };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      totalMoveRef.current = 0;
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !lastTouchRef.current) return;
      e.preventDefault();

      const touch = e.touches[0];
      const fingers = e.touches.length;
      const dx = (touch.clientX - lastTouchRef.current.x) * SENSITIVITY;
      const dy = (touch.clientY - lastTouchRef.current.y) * SENSITIVITY;

      totalMoveRef.current += Math.abs(dx) + Math.abs(dy);

      if (fingers === 1) {
        // Single finger → move cursor
        send("mouse_move", { dx: Math.round(dx), dy: Math.round(dy) });
      } else if (fingers === 2) {
        // Two fingers → scroll
        send("mouse_scroll", {
          dy: Math.round(-dy * SCROLL_SENSITIVITY),
          dx: Math.round(dx * SCROLL_SENSITIVITY),
        });
      }

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [disabled, send]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchStartRef.current) return;

      const elapsed = Date.now() - touchStartRef.current.time;
      const isTap =
        elapsed < TAP_THRESHOLD && totalMoveRef.current < TAP_MOVE_THRESHOLD;

      if (isTap) {
        if (touchStartRef.current.fingers === 1) {
          send("mouse_click", { button: "left" });
        } else if (touchStartRef.current.fingers === 2) {
          send("mouse_right_click");
        } else if (touchStartRef.current.fingers === 3) {
          send("mouse_click", { button: "middle" });
        }
      }

      setActiveFingers(e.touches.length);
      if (e.touches.length === 0) {
        touchStartRef.current = null;
        lastTouchRef.current = null;
      }
    },
    [disabled, send]
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Touchpad Area ─────────────────── */}
      <div
        className="touchpad-area relative flex-1 rounded-2xl border border-surface-700/30 mx-1 flex items-center justify-center select-none overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {disabled ? (
          <p className="text-surface-500 text-sm">Connect to start</p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-surface-600 pointer-events-none">
            <MousePointer2 size={28} strokeWidth={1.5} />
            <p className="text-xs font-medium tracking-wide">TRACKPAD</p>
            <div className="flex items-center gap-3 text-[10px] text-surface-500 mt-1">
              <span className="flex items-center gap-1">
                <Hand size={10} /> 1-tap = click
              </span>
              <span className="flex items-center gap-1">
                <Hand size={10} /> 2-tap = right
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpDown size={10} /> 2-drag = scroll
              </span>
            </div>
          </div>
        )}

        {/* Finger indicator */}
        {activeFingers > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
            {[...Array(activeFingers)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Click Buttons ─────────────────── */}
      <div className="flex gap-2 px-1 pt-2">
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
            if (!disabled) send("mouse_click", { button: "left" });
          }}
          disabled={disabled}
          className="btn-control flex-1 h-12 text-xs font-medium text-surface-400 disabled:opacity-30"
        >
          Left Click
        </button>
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
            if (!disabled) send("mouse_click", { button: "middle" });
          }}
          disabled={disabled}
          aria-label="Middle click"
          className="btn-control w-14 h-12 text-xs text-surface-500 disabled:opacity-30"
        >
          <ArrowUpDown size={14} />
        </button>
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
            if (!disabled) send("mouse_right_click");
          }}
          disabled={disabled}
          className="btn-control flex-1 h-12 text-xs font-medium text-surface-400 disabled:opacity-30"
        >
          Right Click
        </button>
      </div>
    </div>
  );
}
