"use client";

import { useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Power,
  RotateCcw,
  Moon,
  Lock,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PowerAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  action: string;
  confirm: boolean;
  description: string;
}

const ACTIONS: PowerAction[] = [
  {
    id: "lock",
    label: "LOCK",
    icon: Lock,
    color: "text-amber-400",
    bg: "bg-amber-500/6 border-amber-500/12",
    action: "power_lock",
    confirm: false,
    description: "Lock screen",
  },
  {
    id: "sleep",
    label: "SLEEP",
    icon: Moon,
    color: "text-blue-400",
    bg: "bg-blue-500/6 border-blue-500/12",
    action: "power_sleep",
    confirm: true,
    description: "Suspend to RAM",
  },
  {
    id: "logout",
    label: "LOGOUT",
    icon: LogOut,
    color: "text-purple-400",
    bg: "bg-purple-500/6 border-purple-500/12",
    action: "power_logout",
    confirm: true,
    description: "End session",
  },
  {
    id: "restart",
    label: "REBOOT",
    icon: RotateCcw,
    color: "text-orange-400",
    bg: "bg-orange-500/6 border-orange-500/12",
    action: "power_restart",
    confirm: true,
    description: "Restart system",
  },
  {
    id: "shutdown",
    label: "SHUTDOWN",
    icon: Power,
    color: "text-danger",
    bg: "bg-danger/6 border-danger/12",
    action: "power_shutdown",
    confirm: true,
    description: "Power off",
  },
];

export default function PowerControls() {
  const { send, status } = useWebSocket();
  const disabled = status !== "connected";

  const [confirming, setConfirming] = useState<string | null>(null);

  const handleAction = useCallback(
    (item: PowerAction) => {
      if (disabled) return;

      if (item.confirm && confirming !== item.id) {
        setConfirming(item.id);
        // Auto-cancel after 4 seconds
        setTimeout(() => setConfirming(null), 4000);
        return;
      }

      send(item.action);
      setConfirming(null);
    },
    [disabled, send, confirming]
  );

  return (
    <div className="px-1 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Power size={14} className="text-danger/60" />
        <h2 className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-300">
          PWR_CTRL
        </h2>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => handleAction(item)}
            disabled={disabled}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-all disabled:opacity-30 ${
              confirming === item.id
                ? "bg-danger/8 border-danger/25"
                : `${item.bg} hover:brightness-110`
            }`}
          >
            <div
              className={`p-1.5 rounded ${
                confirming === item.id ? "bg-danger/12" : "bg-surface-900/60"
              }`}
            >
              {confirming === item.id ? (
                <AlertTriangle size={16} className="text-danger" />
              ) : (
                <item.icon size={16} className={item.color} />
              )}
            </div>

            <div className="flex-1 text-left">
              <p
                className={`text-[11px] font-mono tracking-[0.1em] uppercase ${
                  confirming === item.id ? "text-danger" : "text-surface-300"
                }`}
              >
                {confirming === item.id
                  ? `// confirm ${item.label}?`
                  : item.label}
              </p>
              <p className="text-[9px] font-mono text-surface-600 mt-0.5 tracking-wider">
                {item.description}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[9px] text-center text-surface-600 pt-2 font-mono tracking-wider"
          >
            Tap again to confirm, or wait to cancel
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
