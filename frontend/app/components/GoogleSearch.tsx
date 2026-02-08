"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Search,
  Globe,
  ExternalLink,
  ArrowRight,
  Clock,
} from "lucide-react";

export default function GoogleSearch() {
  const { send, status } = useWebSocket();
  const disabled = status !== "connected";

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "url">("search");
  const [recent, setRecent] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pc_control_recent");
      if (saved) setRecent(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecent = (item: string) => {
    const updated = [item, ...recent.filter((r) => r !== item)].slice(0, 8);
    setRecent(updated);
    try {
      localStorage.setItem("pc_control_recent", JSON.stringify(updated));
    } catch {}
  };

  const handleSubmit = useCallback(() => {
    const val = query.trim();
    if (!val || disabled) return;

    if (mode === "search") {
      send("google_search", { query: val });
      saveRecent(val);
    } else {
      send("url_open", { url: val });
      saveRecent(val);
    }
    setQuery("");
  }, [query, mode, disabled, send]);

  return (
    <div className="px-1 space-y-4">
      {/* ── Mode Toggle ───────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-800/80 border border-surface-700/30">
        <button
          onClick={() => setMode("search")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === "search"
              ? "bg-accent/15 text-accent border border-accent/20"
              : "text-surface-400 border border-transparent"
          }`}
        >
          <Search size={13} /> Google Search
        </button>
        <button
          onClick={() => setMode("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === "url"
              ? "bg-accent/15 text-accent border border-accent/20"
              : "text-surface-400 border border-transparent"
          }`}
        >
          <Globe size={13} /> Open URL
        </button>
      </div>

      {/* ── Input ─────────────────────────── */}
      <div className="relative">
        {mode === "search" ? (
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
          />
        ) : (
          <Globe
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
          />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={
            disabled
              ? "Connect to search…"
              : mode === "search"
              ? "Search Google…"
              : "Enter URL (e.g. github.com)"
          }
          disabled={disabled}
          className="w-full pl-9 pr-12 py-3 rounded-xl text-sm bg-surface-800/80 border border-surface-700/50 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-40"
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-accent hover:bg-accent/10 transition-all disabled:opacity-30"
        >
          {mode === "search" ? (
            <ArrowRight size={16} />
          ) : (
            <ExternalLink size={16} />
          )}
        </button>
      </div>

      {/* ── Quick Links ───────────────────── */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "YouTube", url: "youtube.com" },
          { label: "GitHub", url: "github.com" },
          { label: "Gmail", url: "mail.google.com" },
          { label: "ChatGPT", url: "chat.openai.com" },
          { label: "Twitter", url: "x.com" },
          { label: "Reddit", url: "reddit.com" },
          { label: "Netflix", url: "netflix.com" },
          { label: "Maps", url: "maps.google.com" },
        ].map((link) => (
          <button
            key={link.url}
            onClick={() => {
              if (!disabled) send("url_open", { url: link.url });
            }}
            disabled={disabled}
            className="btn-control h-10 text-[10px] font-medium text-surface-400 disabled:opacity-30"
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* ── Recent ────────────────────────── */}
      {recent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-surface-500 uppercase tracking-wider flex items-center gap-1">
            <Clock size={10} /> Recent
          </p>
          <div className="space-y-1">
            {recent.map((item, i) => (
              <button
                key={`${item}-${i}`}
                onClick={() => {
                  setQuery(item);
                  if (!disabled) {
                    if (item.includes(".")) send("url_open", { url: item });
                    else send("google_search", { query: item });
                  }
                }}
                disabled={disabled}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-surface-400 hover:bg-surface-800/50 transition-all text-left disabled:opacity-30"
              >
                {item.includes(".") ? (
                  <Globe size={11} className="shrink-0" />
                ) : (
                  <Search size={11} className="shrink-0" />
                )}
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
