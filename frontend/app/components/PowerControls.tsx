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
    label: "Lock",
    icon: Lock,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/15",
    action: "power_lock",
    confirm: false,
    description: "Lock the screen",
  },
  {
    id: "sleep",
    label: "Sleep",
    icon: Moon,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/15",
    action: "power_sleep",
    confirm: true,
    description: "Put PC to sleep",
  },
  {
    id: "logout",
    label: "Log Out",
    icon: LogOut,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/15",
    action: "power_logout",
    confirm: true,
    description: "Sign out of current session",
  },
  {
    id: "restart",
    label: "Restart",
    icon: RotateCcw,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/15",
    action: "power_restart",
    confirm: true,
    description: "Restart the PC",
  },
  {
    id: "shutdown",
    label: "Shut Down",
    icon: Power,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/15",
    action: "power_shutdown",
    confirm: true,
    description: "Shut down the PC",
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
        <Power size={16} className="text-surface-400" />
        <h2 className="text-sm font-semibold text-surface-200">
          Power Controls
        </h2>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => handleAction(item)}
            disabled={disabled}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all disabled:opacity-30 ${
              confirming === item.id
                ? "bg-red-500/10 border-red-500/30"
                : `${item.bg} hover:brightness-110`
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                confirming === item.id ? "bg-red-500/15" : "bg-surface-800/50"
              }`}
            >
              {confirming === item.id ? (
                <AlertTriangle size={18} className="text-red-400" />
              ) : (
                <item.icon size={18} className={item.color} />
              )}
            </div>

            <div className="flex-1 text-left">
              <p
                className={`text-sm font-medium ${
                  confirming === item.id ? "text-red-300" : "text-surface-200"
                }`}
              >
                {confirming === item.id
                  ? `Tap again to confirm ${item.label}`
                  : item.label}
              </p>
              <p className="text-[10px] text-surface-500 mt-0.5">
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
            className="text-[10px] text-center text-surface-500 pt-2"
          >
            Tap again to confirm, or wait to cancel
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
