"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Activity,
  Search,
  X,
  Skull,
  RefreshCw,
  Cpu,
  HardDrive,
  ArrowUpDown,
  Info,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  status: string;
  username: string;
}

interface SystemSummary {
  cpu_percent: number;
  cpu_count: number;
  memory_total_gb: number;
  memory_used_gb: number;
  memory_percent: number;
}

type SortBy = "memory" | "cpu" | "name" | "pid";

export default function ProcessManager() {
  const { sendAndWait, status } = useWebSocket();
  const disabled = status !== "connected";

  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [system, setSystem] = useState<SystemSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("memory");
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef(search);
  const sortByRef = useRef(sortBy);
  searchRef.current = search;
  sortByRef.current = sortBy;

  const fetchProcesses = useCallback(async () => {
    if (disabled) return;

    try {
      const data = (await sendAndWait("process_list", {
        sort_by: sortByRef.current,
        limit: 100,
        search: searchRef.current,
      })) as {
        processes?: ProcessInfo[];
        total_count?: number;
        system?: SystemSummary;
      } | null;

      if (data) {
        setProcesses(data.processes || []);
        setTotalCount(data.total_count || 0);
        if (data.system) setSystem(data.system);
      }
    } catch {
      /* ignore */
    }
  }, [sendAndWait, disabled]);

  // Initial fetch & auto-refresh every 5s
  useEffect(() => {
    if (status === "connected") {
      setLoading(true);
      fetchProcesses().finally(() => setLoading(false));
      refreshTimer.current = setInterval(fetchProcesses, 5000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [status, fetchProcesses]);

  // Re-fetch when search or sort changes (debounced by interval)
  useEffect(() => {
    if (status === "connected") {
      fetchProcesses();
    }
  }, [search, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const killProcess = useCallback(
    async (pid: number, force = false) => {
      if (disabled) return;
      setKilling(pid);
      try {
        const data = (await sendAndWait("process_kill", {
          pid,
          force,
        })) as { killed?: boolean; error?: string } | null;

        if (data?.killed) {
          // Remove from local list immediately
          setProcesses((prev) => prev.filter((p) => p.pid !== pid));
        }
      } catch {
        /* ignore */
      } finally {
        setKilling(null);
      }
    },
    [sendAndWait, disabled]
  );

  const fetchDetail = useCallback(
    async (pid: number) => {
      if (disabled) return;
      const data = (await sendAndWait("process_detail", { pid })) as Record<
        string,
        unknown
      > | null;
      if (data) setDetail(data);
    },
    [sendAndWait, disabled]
  );

  const sortLabels: Record<SortBy, string> = {
    memory: "Memory",
    cpu: "CPU",
    name: "Name",
    pid: "PID",
  };

  return (
    <div className="flex flex-col h-full px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-200">
            Processes
          </h2>
          <span className="text-[10px] text-surface-500 bg-surface-800/60 px-1.5 py-0.5 rounded">
            {totalCount}
          </span>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchProcesses().finally(() => setLoading(false));
          }}
          disabled={disabled}
          title="Refresh"
          className="btn-control w-8 h-8 text-surface-400 disabled:opacity-30"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* System Stats */}
      {system && (
        <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
          <div className="bg-surface-800/60 border border-surface-700/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu size={12} className="text-blue-400" />
              <span className="text-[10px] text-surface-400 font-medium">
                CPU
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-surface-200">
                {system.cpu_percent}%
              </span>
              <span className="text-[10px] text-surface-500">
                {system.cpu_count} cores
              </span>
            </div>
            <div className="w-full h-1 bg-surface-700/40 rounded-full mt-1">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min(system.cpu_percent, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-surface-800/60 border border-surface-700/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <HardDrive size={12} className="text-purple-400" />
              <span className="text-[10px] text-surface-400 font-medium">
                RAM
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-surface-200">
                {system.memory_percent}%
              </span>
              <span className="text-[10px] text-surface-500">
                {system.memory_used_gb}/{system.memory_total_gb}GB
              </span>
            </div>
            <div className="w-full h-1 bg-surface-700/40 rounded-full mt-1">
              <div
                className="h-full bg-purple-400 rounded-full transition-all"
                style={{ width: `${Math.min(system.memory_percent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter processes…"
            disabled={disabled}
            className="w-full pl-9 pr-9 py-2 rounded-xl text-xs bg-surface-800/80 border border-surface-700/50 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-40"
            autoComplete="off"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              title="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-300"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            aria-label="Sort processes"
            className="btn-control h-9 px-2.5 text-[10px] text-surface-400 flex items-center gap-1"
          >
            <ArrowUpDown size={12} />
            {sortLabels[sortBy]}
            <ChevronDown size={10} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface-800 border border-surface-700/50 rounded-xl shadow-lg py-1 min-w-[80px]">
              {(["memory", "cpu", "name", "pid"] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSortBy(s);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    sortBy === s
                      ? "text-accent bg-accent/10"
                      : "text-surface-300 hover:bg-surface-700/50"
                  }`}
                >
                  {sortLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Process list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {loading && processes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-surface-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : processes.length === 0 ? (
          <p className="text-center py-8 text-surface-500 text-xs">
            No processes found
          </p>
        ) : (
          processes.map((proc) => (
            <div
              key={proc.pid}
              className="flex items-center gap-2 bg-surface-800/50 border border-surface-700/20 rounded-lg px-3 py-2 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-surface-200 truncate">
                    {proc.name}
                  </span>
                  <span className="text-[10px] text-surface-500">
                    #{proc.pid}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-blue-400">
                    CPU {proc.cpu_percent}%
                  </span>
                  <span className="text-[10px] text-purple-400">
                    {proc.memory_mb}MB
                  </span>
                  <span
                    className={`text-[10px] ${
                      proc.status === "running"
                        ? "text-emerald-400"
                        : "text-surface-500"
                    }`}
                  >
                    {proc.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchDetail(proc.pid)}
                  title="Details"
                  aria-label={`Details for ${proc.name}`}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700/50 transition-colors"
                >
                  <Info size={13} />
                </button>
                <button
                  onClick={() => killProcess(proc.pid)}
                  disabled={killing === proc.pid}
                  title="Terminate"
                  aria-label={`Terminate ${proc.name}`}
                  className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
                >
                  {killing === proc.pid ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Skull size={13} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-800 border border-surface-700/50 rounded-2xl p-4 max-w-sm w-full max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-200">
                Process Detail
              </h3>
              <button
                onClick={() => setDetail(null)}
                aria-label="Close detail panel"
                title="Close"
                className="p-1 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700/50"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              {Object.entries(detail).map(([key, val]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-surface-500 shrink-0 w-28 text-right">
                    {key}:
                  </span>
                  <span className="text-surface-300 break-all">
                    {typeof val === "object"
                      ? JSON.stringify(val, null, 2)
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
