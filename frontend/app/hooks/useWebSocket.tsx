"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ── Types ───────────────────────────────────────────────────────────────────
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface WSMessage {
  action: string;
  payload?: Record<string, unknown>;
  id?: string;
}

interface WSContextValue {
  status: ConnectionStatus;
  serverIp: string;
  connect: (ip: string) => void;
  disconnect: () => void;
  send: (action: string, payload?: Record<string, unknown>) => void;
  sendAndWait: (
    action: string,
    payload?: Record<string, unknown>
  ) => Promise<unknown>;
  lastError: string | null;
  pcInfo: Record<string, unknown> | null;
  isDeployed: boolean;
}

const WSContext = createContext<WSContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────
const SERVER_PORT = 8765;
const RECONNECT_DELAY = 3000;

/**
 * Detect if running on the Vercel-deployed site (or any external host).
 * When deployed, we can’t connect via WebSocket — we redirect instead.
 */
function checkIsDeployed(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  if (port === String(SERVER_PORT)) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  return true;
}

/**
 * Detect if the frontend is being served from the PC server itself.
 * If so, we can auto-connect using the page's hostname (no manual IP needed).
 */
function getAutoServerIp(): string | null {
  if (typeof window === "undefined") return null;
  const { hostname, port } = window.location;
  // If served from the Python server (port 8765), use same hostname
  if (port === String(SERVER_PORT)) return hostname;
  return null;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [serverIp, setServerIp] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [pcInfo, setPcInfo] = useState<Record<string, unknown> | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, (data: unknown) => void>>(new Map());
  const idCounterRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Detect deployed state on mount
  useEffect(() => {
    setIsDeployed(checkIsDeployed());
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (ip: string) => {
      cleanup();
      setServerIp(ip);
      setLastError(null);
      setStatus("connecting");

      // If the IP already contains a port (e.g. "192.168.1.5:8765"), use as-is
      // Otherwise append the default server port
      const host = ip.includes(":") ? ip : `${ip}:${SERVER_PORT}`;
      const url = `ws://${host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setLastError(null);
        // Request system info on connect
        const id = `__init_${Date.now()}`;
        ws.send(JSON.stringify({ action: "system_info", id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle pending request-response
          if (data.id && pendingRef.current.has(data.id)) {
            pendingRef.current.get(data.id)!(data.data);
            pendingRef.current.delete(data.id);
          }
          // Capture system info
          if (data.id?.startsWith("__init_") && data.data) {
            setPcInfo(data.data);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        // Only auto-reconnect when served from the PC server (same origin)
        if (ip && !checkIsDeployed()) {
          reconnectTimerRef.current = setTimeout(() => connect(ip), RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        setLastError("Connection failed. Check the IP and ensure the server is running.");
      };
    },
    [cleanup]
  );

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("disconnected");
    setServerIp("");
    setPcInfo(null);
    setLastError(null);
  }, [cleanup]);

  const send = useCallback((action: string, payload?: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, payload }));
    }
  }, []);

  const sendAndWait = useCallback(
    (action: string, payload?: Record<string, unknown>) => {
      return new Promise<unknown>((resolve) => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) {
          resolve(null);
          return;
        }
        const id = `req_${++idCounterRef.current}_${Date.now()}`;
        pendingRef.current.set(id, resolve);
        ws.send(JSON.stringify({ action, payload, id }));

        // Timeout after 35 s (covers terminal commands with 30s default timeout)
        setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id);
            resolve(null);
          }
        }, 35000);
      });
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // Auto-connect when served from the Python server (same origin)
  useEffect(() => {
    const autoIp = getAutoServerIp();
    if (autoIp && status === "disconnected") {
      connect(autoIp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WSContext.Provider
      value={{
        status,
        serverIp,
        connect,
        disconnect,
        send,
        sendAndWait,
        lastError,
        pcInfo,
        isDeployed,
      }}
    >
      {children}
    </WSContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useWebSocket() {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error("useWebSocket must be used inside WebSocketProvider");
  return ctx;
}
