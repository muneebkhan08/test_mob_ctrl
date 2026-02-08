"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  AppWindow,
  Search,
  X,
  Loader2,
  Terminal,
  Chrome,
  FileText,
  Calculator,
  Palette,
  Folder,
  Settings,
  Music,
  MessageCircle,
  Code,
  Gamepad2,
  MonitorPlay,
} from "lucide-react";

// Icon mapping for common apps
const APP_ICONS: Record<string, React.ElementType> = {
  chrome: Chrome,
  firefox: Chrome,
  edge: Chrome,
  notepad: FileText,
  calculator: Calculator,
  paint: Palette,
  "file explorer": Folder,
  settings: Settings,
  spotify: Music,
  discord: MessageCircle,
  slack: MessageCircle,
  "vs code": Code,
  "visual studio code": Code,
  terminal: Terminal,
  powershell: Terminal,
  "command prompt": Terminal,
  steam: Gamepad2,
  vlc: MonitorPlay,
};

export default function AppLauncher() {
  const { send, sendAndWait, status } = useWebSocket();
  const disabled = status !== "connected";

  const [search, setSearch] = useState("");
  const [apps, setApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load app list on connect
  useEffect(() => {
    if (status === "connected") {
      setLoading(true);
      sendAndWait("app_list").then((data: unknown) => {
        const d = data as { quick_launch?: string[] } | null;
        if (d?.quick_launch) setApps(d.quick_launch);
        setLoading(false);
      });
    }
  }, [status, sendAndWait]);

  const openApp = useCallback(
    (name: string) => {
      if (!disabled) send("app_open", { name });
    },
    [disabled, send]
  );

  const filteredApps = search
    ? apps.filter((a) => a.toLowerCase().includes(search.toLowerCase()))
    : apps;

  const getIcon = (name: string) => {
    return APP_ICONS[name.toLowerCase()] || AppWindow;
  };

  return (
    <div className="px-1 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AppWindow size={16} className="text-surface-400" />
        <h2 className="text-sm font-semibold text-surface-200">App Launcher</h2>
      </div>

      {/* ── Search ────────────────────────── */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={disabled ? "Connect first…" : "Search apps…"}
          disabled={disabled}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm bg-surface-800/80 border border-surface-700/50 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-40"
          autoComplete="off"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-300 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Custom Launch ─────────────────── */}
      {search && !filteredApps.includes(search.toLowerCase()) && (
        <button
          onClick={() => {
            openApp(search);
            setSearch("");
          }}
          disabled={disabled}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent font-medium transition-all hover:bg-accent/15 disabled:opacity-30"
        >
          <Terminal size={16} />
          Run &quot;{search}&quot;
        </button>
      )}

      {/* ── App Grid ──────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-surface-500" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {filteredApps.map((name) => {
            const Icon = getIcon(name);
            return (
              <button
                key={name}
                onClick={() => openApp(name)}
                disabled={disabled}
                className="btn-control flex-col gap-1.5 py-3 px-2 h-auto disabled:opacity-30"
              >
                <Icon size={20} className="text-surface-300" />
                <span className="text-[9px] font-medium text-surface-400 truncate w-full text-center capitalize">
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
