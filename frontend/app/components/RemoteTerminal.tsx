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
          <TerminalIcon size={14} className="text-accent/60" />
          <h2 className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-300">SHELL</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            title="Clear output"
            className="btn-control w-7 h-7 text-surface-500"
          >
            <span className="text-[9px] font-mono tracking-wider">CLR</span>
          </button>
          <button
            onClick={resetTerminal}
            disabled={disabled}
            title="Reset terminal to home"
            className="btn-control w-7 h-7 text-surface-500 disabled:opacity-30"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* CWD Badge */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <span className="text-[9px] font-mono bg-surface-900/90 border border-surface-700/30 text-accent/60 px-2 py-0.5 rounded truncate max-w-full tracking-wider">
          {shortCwd}
        </span>
      </div>

      {/* Output scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-surface-950 border border-surface-700/25 p-3 font-mono text-[11px] space-y-3"
      >
        {history.length === 0 && !running && (
          <p className="text-surface-600 text-center py-8 text-[10px] tracking-wider">
            // enter command below
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
              <span className="text-accent/70 break-all">
                {entry.command}
              </span>
            </div>

            {/* stdout */}
            {entry.stdout && (
              <pre className="text-surface-400 whitespace-pre-wrap break-all pl-4 leading-relaxed text-[10px]">
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
                <pre className="text-danger/80 whitespace-pre-wrap break-all leading-relaxed text-[10px]">
                  {entry.stderr}
                </pre>
              </div>
            )}

            {/* Exit code if non-zero */}
            {entry.exit_code !== 0 && (
              <span className="text-[9px] text-danger/50 pl-4 font-mono">
                exit:{entry.exit_code}
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
          placeholder={disabled ? "// awaiting link" : "$ _"}
          disabled={disabled || running}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 px-3 py-2 rounded-lg text-[11px] font-mono bg-surface-900/90 border border-surface-700/40 placeholder:text-surface-600 text-surface-200 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all disabled:opacity-30"
        />
        <button
          onClick={executeCommand}
          disabled={disabled || running || !command.trim()}
          className="btn-control w-9 h-9 text-accent bg-accent/8 border-accent/15 disabled:opacity-30 disabled:text-surface-600"
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
