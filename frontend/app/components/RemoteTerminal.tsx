"use client";

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Terminal as TerminalIcon,
  Send,
  RotateCcw,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface HistoryEntry {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd: string;
}

export default function RemoteTerminal() {
  const { sendAndWait, status } = useWebSocket();
  const disabled = status !== "connected";

  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cwd, setCwd] = useState("");
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  // Fetch initial cwd
  useEffect(() => {
    if (status === "connected") {
      sendAndWait("terminal_cwd").then((data: unknown) => {
        const d = data as { cwd?: string } | null;
        if (d?.cwd) setCwd(d.cwd);
      });
    }
  }, [status, sendAndWait]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, running]);

  const executeCommand = useCallback(async () => {
    const cmd = command.trim();
    if (!cmd || disabled || running) return;

    setCommand("");
    setRunning(true);
    setCmdHistory((prev) => [cmd, ...prev].slice(0, 50));
    setHistoryIdx(-1);

    try {
      const data = (await sendAndWait("terminal_execute", {
        command: cmd,
      })) as {
        stdout?: string;
        stderr?: string;
        exit_code?: number;
        cwd?: string;
        error?: string;
      } | null;

      if (data) {
        const entry: HistoryEntry = {
          id: ++idCounter.current,
          command: cmd,
          stdout: data.stdout || "",
          stderr: data.error || data.stderr || "",
          exit_code: data.exit_code ?? -1,
          cwd: data.cwd || cwd,
        };
        setHistory((prev) => [...prev, entry]);
        if (data.cwd) setCwd(data.cwd);
      }
    } catch {
      setHistory((prev) => [
        ...prev,
        {
          id: ++idCounter.current,
          command: cmd,
          stdout: "",
          stderr: "Request failed — connection error",
          exit_code: -1,
          cwd,
        },
      ]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  }, [command, disabled, running, sendAndWait, cwd]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(next);
        setCommand(cmdHistory[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setCommand(cmdHistory[next]);
      } else {
        setHistoryIdx(-1);
        setCommand("");
      }
    }
  };

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const resetTerminal = useCallback(async () => {
    const data = (await sendAndWait("terminal_reset")) as {
      cwd?: string;
    } | null;
    if (data?.cwd) setCwd(data.cwd);
    setHistory([]);
    setCmdHistory([]);
    setHistoryIdx(-1);
  }, [sendAndWait]);

  // Shorten cwd for display
  const shortCwd = cwd
    ? cwd.replace(/^C:\\Users\\[^\\]+/, "~").replace(/\\/g, "/")
    : "~";

  return (
    <div className="flex flex-col h-full px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-200">Terminal</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            title="Clear output"
            className="btn-control w-8 h-8 text-surface-400"
          >
            <span className="text-xs font-bold">CLS</span>
          </button>
          <button
            onClick={resetTerminal}
            disabled={disabled}
            title="Reset terminal to home"
            className="btn-control w-8 h-8 text-surface-400 disabled:opacity-30"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* CWD Badge */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <span className="text-[10px] font-mono bg-surface-800/80 border border-surface-700/40 text-surface-400 px-2 py-0.5 rounded-md truncate max-w-full">
          {shortCwd}
        </span>
      </div>

      {/* Output scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-surface-900/80 border border-surface-700/30 p-3 font-mono text-xs space-y-3"
      >
        {history.length === 0 && !running && (
          <p className="text-surface-500 text-center py-8">
            Type a command below to get started
          </p>
        )}

        {history.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Command line */}
            <div className="flex items-start gap-1">
              <ChevronRight
                size={12}
                className="text-accent mt-0.5 shrink-0"
              />
              <span className="text-accent-light break-all">
                {entry.command}
              </span>
            </div>

            {/* stdout */}
            {entry.stdout && (
              <pre className="text-surface-300 whitespace-pre-wrap break-all pl-4 leading-relaxed">
                {entry.stdout}
              </pre>
            )}

            {/* stderr */}
            {entry.stderr && (
              <div className="flex items-start gap-1 pl-4">
                <AlertCircle
                  size={11}
                  className="text-red-400 mt-0.5 shrink-0"
                />
                <pre className="text-red-400/80 whitespace-pre-wrap break-all leading-relaxed">
                  {entry.stderr}
                </pre>
              </div>
            )}

            {/* Exit code if non-zero */}
            {entry.exit_code !== 0 && (
              <span className="text-[10px] text-red-400/60 pl-4">
                exit code: {entry.exit_code}
              </span>
            )}
          </div>
        ))}

        {running && (
          <div className="flex items-center gap-2 text-surface-400">
            <Loader2 size={12} className="animate-spin" />
            <span>Running…</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 mt-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connect first…" : "Enter command…"}
          disabled={disabled || running}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono bg-surface-800/80 border border-surface-700/50 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-40"
        />
        <button
          onClick={executeCommand}
          disabled={disabled || running || !command.trim()}
          className="btn-control w-10 h-10 text-accent bg-accent/10 border-accent/20 disabled:opacity-30 disabled:text-surface-500"
        >
          {running ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
