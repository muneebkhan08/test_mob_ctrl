"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebSocket, type ConnectionStatus } from "../hooks/useWebSocket";
import {
  Wifi,
  WifiOff,
  Loader2,
  Monitor,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "pccontrol_last_ip";
const SERVER_PORT = 8765;

export default function ConnectionBar() {
  const { status, serverIp, connect, disconnect, lastError, pcInfo, isDeployed } =
    useWebSocket();
  const [inputIp, setInputIp] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Pre-fill last-used IP from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInputIp(saved);
    } catch {
      // ignore
    }
  }, []);

  // When deployed (Vercel), clicking "Go" redirects to the PC server URL
  const handleGo = useCallback(() => {
    const ip = inputIp.trim();
    if (!ip) return;

    // Save the IP for next time
    try {
      localStorage.setItem(STORAGE_KEY, ip);
    } catch {
      // ignore
    }

    if (isDeployed) {
      // Redirect the browser to the PC server, which serves the full app
      const host = ip.includes(":") ? ip : `${ip}:${SERVER_PORT}`;
      window.location.href = `http://${host}`;
    } else {
      connect(ip);
    }
  }, [inputIp, isDeployed, connect]);

  const statusConfig: Record<
    ConnectionStatus,
    { color: string; bg: string; icon: React.ReactNode; label: string }
  > = {
    disconnected: {
      color: "text-red-400",
      bg: "bg-red-500/5 border-red-500/15",
      icon: <WifiOff size={14} />,
      label: isDeployed ? "NO LINK" : "OFFLINE",
    },
    connecting: {
      color: "text-yellow-400",
      bg: "bg-yellow-500/5 border-yellow-500/15",
      icon: <Loader2 size={14} className="animate-spin" />,
      label: "LINKING...",
    },
    connected: {
      color: "text-accent",
      bg: "bg-accent/5 border-accent/15",
      icon: <Wifi size={14} />,
      label: "CONNECTED",
    },
  };

  const s = statusConfig[status];

  return (
    <div className="w-full">
      {/* ── Status Bar ─────────────────────────── */}
      <div
        className={`glass flex items-center justify-between px-3 py-2 rounded-lg ${s.bg} border transition-all duration-300`}
      >
        <div className="flex items-center gap-2">
          <div className={`${s.color} transition-colors`}>{s.icon}</div>
          <div>
            <p className={`text-[10px] font-semibold tracking-[0.1em] uppercase ${s.color}`}>{s.label}</p>
            {status === "connected" && pcInfo && (
              <p className="text-[9px] text-surface-500 font-mono">
                {(pcInfo as Record<string, string>).hostname} :: {serverIp}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "connected" ? (
            <button
              onClick={disconnect}
              className="px-2.5 py-1 rounded text-[10px] font-medium tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20 transition-all"
            >
              DROP
            </button>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded text-surface-500 hover:text-accent transition-colors"
              aria-label="Toggle connection panel"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded Connect / Redirect Form ──── */}
      <AnimatePresence>
        {expanded && status !== "connected" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 px-1 space-y-3">
              {/* ── IP Input Row ── */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Monitor
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-600"
                  />
                  <input
                    type="text"
                    value={inputIp}
                    onChange={(e) => setInputIp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGo()}
                    placeholder="target ip (e.g. 192.168.1.42)"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs font-mono bg-surface-900/90 border border-surface-700/40 placeholder:text-surface-600 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 transition-all text-surface-300"
                    autoComplete="off"
                    autoCorrect="off"
                    inputMode="url"
                  />
                </div>
                <button
                  onClick={handleGo}
                  disabled={!inputIp.trim() || status === "connecting"}
                  className="px-4 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase bg-accent/15 text-accent border border-accent/30 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/25 active:scale-95 transition-all shadow-glow-sm flex items-center gap-1.5"
                >
                  {status === "connecting" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isDeployed ? (
                    <>
                      <ExternalLink size={14} />
                      Go
                    </>
                  ) : (
                    "Connect"
                  )}
                </button>
              </div>

              {/* ── Error ── */}
              {lastError && !isDeployed && (
                <p className="text-[10px] font-mono text-red-400 bg-red-500/5 border border-red-500/10 rounded px-3 py-2">
                  [ERR] {lastError}
                </p>
              )}

              {/* ── Deployed: explanation ── */}
              {isDeployed && (
                <div className="text-[10px] font-mono bg-accent/5 border border-accent/10 rounded-lg px-3 py-2.5 space-y-1.5">
                  <p className="text-accent font-bold tracking-wider uppercase text-[9px]">
                    // PROTOCOL
                  </p>
                  <p className="text-surface-400 leading-relaxed">
                    Enter target IP → tap <span className="text-accent">LINK</span> →
                    redirect to local server → auto-connect.
                  </p>
                  <p className="text-surface-500 leading-relaxed">
                    Both devices must share the same network. Run{" "}
                    <code className="bg-surface-800 px-1.5 py-0.5 rounded text-accent/80 border border-surface-700/30">
                      ipconfig
                    </code>{" "}
                    on target machine.
                  </p>
                </div>
              )}

              {/* ── Local: help text ── */}
              {!isDeployed && (
                <p className="text-[9px] text-surface-600 leading-relaxed font-mono">
                  // start server on target → enter IP → same network required
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
