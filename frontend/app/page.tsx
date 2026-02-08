"use client";

import { useState } from "react";
import { WebSocketProvider, useWebSocket } from "./hooks/useWebSocket";
import { WebRTCProvider } from "./hooks/useWebRTC";
import ConnectionBar from "./components/ConnectionBar";
import Touchpad from "./components/Touchpad";
import Keyboard from "./components/Keyboard";
import PowerControls from "./components/PowerControls";
import AppLauncher from "./components/AppLauncher";
import GoogleSearch from "./components/GoogleSearch";
import MediaVolume from "./components/MediaVolume";
import ScreenViewer from "./components/ScreenViewer";
import RemoteTerminal from "./components/RemoteTerminal";
import ProcessManager from "./components/ProcessManager";
import FileBrowser from "./components/FileBrowser";
import {
  MousePointer2,
  Keyboard as KeyboardIcon,
  LayoutGrid,
  Zap,
  Monitor,
  Terminal,
  Shield,
} from "lucide-react";

// ── Tab definitions ─────────────────────────────────────────────────────────
type TabId = "touchpad" | "keyboard" | "tools" | "screen" | "controls";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: "touchpad", label: "PAD", icon: MousePointer2 },
  { id: "keyboard", label: "KEYS", icon: KeyboardIcon },
  { id: "screen", label: "STRM", icon: Monitor },
  { id: "tools", label: "TOOLS", icon: Terminal },
  { id: "controls", label: "SYS", icon: Zap },
];

// ── Sub-tabs for Tools page ─────────────────────────────────────────────────
type ToolsSubTab = "apps" | "search" | "media" | "terminal" | "processes" | "files";

// ── Inner App (needs context) ───────────────────────────────────────────────
function AppInner() {
  const { status } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabId>("touchpad");
  const [toolsSubTab, setToolsSubTab] = useState<ToolsSubTab>("search");

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      {/* ── Header ───────────────────────── */}
      <header className="shrink-0 px-4 pt-4 pb-2 space-y-3">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-accent/30 bg-accent/5 flex items-center justify-center shadow-glow-sm">
              <Shield size={13} className="text-accent" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-accent text-glow">
                NEXUS
              </h1>
              <p className="text-[8px] tracking-[0.15em] text-surface-500 uppercase">
                remote access
              </p>
            </div>
          </div>
          {status === "connected" && (
            <div className="flex items-center gap-1.5 bg-accent/5 border border-accent/15 rounded px-2 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent status-connected" />
              <span className="text-[9px] text-accent font-medium tracking-[0.15em] uppercase">
                linked
              </span>
            </div>
          )}
        </div>

        {/* Connection */}
        <ConnectionBar />
      </header>

      {/* ── Main Content ─────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {activeTab === "touchpad" && <Touchpad />}

        {activeTab === "keyboard" && <Keyboard />}

        {activeTab === "screen" && <ScreenViewer />}

        {activeTab === "tools" && (
          <div className="space-y-3 h-full flex flex-col">
            {/* Sub-tab bar */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-900/90 border border-surface-700/30 shrink-0 overflow-x-auto">
              {(
                [
                  { id: "search" as ToolsSubTab, label: "SRCH" },
                  { id: "apps" as ToolsSubTab, label: "APPS" },
                  { id: "media" as ToolsSubTab, label: "MEDIA" },
                  { id: "terminal" as ToolsSubTab, label: "SHELL" },
                  { id: "processes" as ToolsSubTab, label: "PROC" },
                  { id: "files" as ToolsSubTab, label: "FS" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setToolsSubTab(t.id)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all whitespace-nowrap px-1.5 tracking-wider ${
                    toolsSubTab === t.id
                      ? "bg-accent/10 text-accent border border-accent/20 text-glow"
                      : "text-surface-500 border border-transparent hover:text-surface-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {toolsSubTab === "search" && <GoogleSearch />}
              {toolsSubTab === "apps" && <AppLauncher />}
              {toolsSubTab === "media" && <MediaVolume />}
              {toolsSubTab === "terminal" && <RemoteTerminal />}
              {toolsSubTab === "processes" && <ProcessManager />}
              {toolsSubTab === "files" && <FileBrowser />}
            </div>
          </div>
        )}

        {activeTab === "controls" && <PowerControls />}
      </main>

      {/* ── Bottom Tab Bar ────────────────── */}
      <nav className="tab-bar shrink-0 px-3 pb-2 pt-1">
        <div className="flex items-center justify-around rounded-lg bg-surface-900/95 border border-surface-700/40 backdrop-blur-lg py-0.5">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all ${
                  active
                    ? "text-accent"
                    : "text-surface-600 hover:text-surface-400"
                }`}
              >
                <div
                  className={`p-1.5 rounded transition-all ${
                    active ? "bg-accent/8 shadow-glow-sm" : ""
                  }`}
                >
                  <tab.icon size={16} strokeWidth={active ? 2.5 : 1.5} />
                </div>
                <span
                  className={`text-[8px] font-semibold tracking-[0.15em] ${
                    active ? "text-accent text-glow" : ""
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ── Root Page ────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <WebSocketProvider>
      <WebRTCProvider>
        <AppInner />
      </WebRTCProvider>
    </WebSocketProvider>
  );
}
