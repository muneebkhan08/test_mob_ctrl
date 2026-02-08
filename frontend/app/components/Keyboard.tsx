"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Delete,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Space,
  ChevronUp,
  Command,
  Copy,
  Clipboard,
  Scissors,
  RotateCcw,
  Type,
} from "lucide-react";

// ── Special keys row ────────────────────────────────────────────────────────
const SPECIAL_KEYS = [
  { key: "escape", label: "Esc", icon: null },
  { key: "tab", label: "Tab", icon: null },
  { key: "ctrl", label: "Ctrl", icon: null },
  { key: "alt", label: "Alt", icon: null },
  { key: "win", label: "Win", icon: Command, iconSize: 13 },
  { key: "shift", label: "⇧", icon: null },
  { key: "up", label: "", icon: ArrowUp, iconSize: 14 },
  { key: "down", label: "", icon: ArrowDown, iconSize: 14 },
  { key: "left", label: "", icon: ArrowLeft, iconSize: 14 },
  { key: "right", label: "", icon: ArrowRight, iconSize: 14 },
];

const SHORTCUTS = [
  { keys: ["ctrl", "c"], label: "Copy", icon: Copy },
  { keys: ["ctrl", "v"], label: "Paste", icon: Clipboard },
  { keys: ["ctrl", "x"], label: "Cut", icon: Scissors },
  { keys: ["ctrl", "z"], label: "Undo", icon: RotateCcw },
  { keys: ["ctrl", "a"], label: "All", icon: null },
  { keys: ["alt", "tab"], label: "Switch", icon: null },
  { keys: ["alt", "f4"], label: "Close", icon: null },
  { keys: ["win", "d"], label: "Desktop", icon: null },
  { keys: ["ctrl", "shift", "escape"], label: "Task Mgr", icon: null },
  { keys: ["printscreen"], label: "Screenshot", icon: null },
];

export default function Keyboard() {
  const { send, status } = useWebSocket();
  const disabled = status !== "connected";

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Send each character as typed
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const val = e.target.value;
      if (val.length > text.length) {
        // New character(s) added
        const newChars = val.slice(text.length);
        send("key_type", { text: newChars });
      }
      setText(val);
    },
    [disabled, send, text]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "Enter") {
        send("key_press", { key: "enter" });
        e.preventDefault();
      } else if (e.key === "Backspace") {
        send("key_press", { key: "backspace" });
      }
    },
    [disabled, send]
  );

  const pressKey = useCallback(
    (key: string) => {
      if (!disabled) send("key_press", { key });
    },
    [disabled, send]
  );

  const pressCombo = useCallback(
    (keys: string[]) => {
      if (!disabled) send("key_combo", { keys });
    },
    [disabled, send]
  );

  // Auto-focus input when tab is active
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full gap-3 px-1">
      {/* ── Text Input ────────────────────── */}
      <div className="relative">
        <Type
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
        />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connect to type…" : "Start typing here…"}
          disabled={disabled}
          className="keyboard-input w-full pl-9 pr-20 py-3 rounded-xl text-sm bg-surface-800/80 border border-surface-700/50 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-40"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            onClick={() => pressKey("backspace")}
            disabled={disabled}
            aria-label="Backspace"
            className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 transition-all disabled:opacity-30"
          >
            <Delete size={16} />
          </button>
          <button
            onClick={() => pressKey("enter")}
            disabled={disabled}
            aria-label="Enter"
            className="p-2 rounded-lg text-accent hover:bg-accent/10 transition-all disabled:opacity-30"
          >
            <CornerDownLeft size={16} />
          </button>
        </div>
      </div>

      {/* ── Special Keys ──────────────────── */}
      <div className="grid grid-cols-5 gap-1.5">
        {SPECIAL_KEYS.map((k) => (
          <button
            key={k.key}
            onClick={() => pressKey(k.key)}
            disabled={disabled}
            className="btn-control h-10 text-[11px] font-medium text-surface-300 gap-1 disabled:opacity-30"
          >
            {k.icon ? <k.icon size={k.iconSize} /> : k.label}
          </button>
        ))}
      </div>

      {/* ── Action Row ────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => pressKey("space")}
          disabled={disabled}
          className="btn-control h-10 col-span-1 text-[11px] font-medium text-surface-300 gap-1 disabled:opacity-30"
        >
          <Space size={14} /> Space
        </button>
        <button
          onClick={() => pressKey("backspace")}
          disabled={disabled}
          className="btn-control h-10 text-[11px] font-medium text-surface-300 gap-1 disabled:opacity-30"
        >
          <Delete size={14} /> Backspace
        </button>
        <button
          onClick={() => pressKey("enter")}
          disabled={disabled}
          className="btn-control h-10 text-[11px] font-medium text-accent gap-1 disabled:opacity-30"
        >
          <CornerDownLeft size={14} /> Enter
        </button>
      </div>

      {/* ── Shortcuts Toggle ──────────────── */}
      <button
        onClick={() => setShowShortcuts(!showShortcuts)}
        className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-surface-400 hover:text-surface-200 transition-colors"
      >
        <ChevronUp
          size={12}
          className={`transition-transform ${showShortcuts ? "rotate-180" : ""}`}
        />
        Shortcuts
      </button>

      {/* ── Shortcuts Grid ────────────────── */}
      {showShortcuts && (
        <div className="grid grid-cols-5 gap-1.5 pb-2">
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              onClick={() => pressCombo(s.keys)}
              disabled={disabled}
              className="btn-control h-12 flex-col gap-0.5 text-[9px] font-medium text-surface-400 disabled:opacity-30"
            >
              {s.icon && <s.icon size={12} />}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Function Keys ─────────────────── */}
      <div className="grid grid-cols-6 gap-1 mt-auto">
        {Array.from({ length: 12 }, (_, i) => (
          <button
            key={`f${i + 1}`}
            onClick={() => pressKey(`f${i + 1}`)}
            disabled={disabled}
            className="btn-control h-8 text-[10px] font-mono text-surface-500 disabled:opacity-30"
          >
            F{i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
