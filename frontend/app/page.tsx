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
import {
  MousePointer2,
  Keyboard as KeyboardIcon,
  LayoutGrid,
  Zap,
  Monitor,
} from "lucide-react";

// ── Tab definitions ─────────────────────────────────────────────────────────
type TabId = "touchpad" | "keyboard" | "tools" | "screen" | "controls";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: "touchpad", label: "Pad", icon: MousePointer2 },
  { id: "keyboard", label: "Keys", icon: KeyboardIcon },
  { id: "screen", label: "Screen", icon: Monitor },
  { id: "tools", label: "Tools", icon: LayoutGrid },
  { id: "controls", label: "Control", icon: Zap },
];

// ── Sub-tabs for Tools page ─────────────────────────────────────────────────
type ToolsSubTab = "apps" | "search" | "media";

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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
              <MousePointer2 size={14} className="text-accent" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-surface-100">
              PC Control
            </h1>
          </div>
          {status === "connected" && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-connected" />
              <span className="text-[10px] text-emerald-400 font-medium">
                LIVE
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
            <div className="flex gap-1 p-1 rounded-xl bg-surface-800/80 border border-surface-700/30 shrink-0">
              {(
                [
                  { id: "search" as ToolsSubTab, label: "Search" },
                  { id: "apps" as ToolsSubTab, label: "Apps" },
                  { id: "media" as ToolsSubTab, label: "Media" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setToolsSubTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    toolsSubTab === t.id
                      ? "bg-accent/15 text-accent border border-accent/20"
                      : "text-surface-400 border border-transparent"
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
            </div>
          </div>
        )}

        {activeTab === "controls" && <PowerControls />}
      </main>

      {/* ── Bottom Tab Bar ────────────────── */}
      <nav className="tab-bar shrink-0 px-4 pb-2 pt-1">
        <div className="flex items-center justify-around rounded-2xl bg-surface-800/90 border border-surface-700/30 backdrop-blur-lg py-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl transition-all ${
                  active
                    ? "text-accent"
                    : "text-surface-500 hover:text-surface-300"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-all ${
                    active ? "bg-accent/10" : ""
                  }`}
                >
                  <tab.icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                </div>
                <span
                  className={`text-[9px] font-semibold tracking-wide ${
                    active ? "text-accent" : ""
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
