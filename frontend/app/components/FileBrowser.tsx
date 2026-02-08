"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Folder,
  File,
  HardDrive,
  ChevronRight,
  ArrowLeft,
  Home,
  RefreshCw,
  Loader2,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Code,
  Link2,
  FileQuestion,
} from "lucide-react";

interface FileEntry {
  name: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  modified: string;
  extension: string;
}

interface DriveInfo {
  path: string;
  label: string;
  total_gb?: number;
  free_gb?: number;
}

// Map extensions to icons
function getFileIcon(ext: string, isDir: boolean, isLink: boolean) {
  if (isLink) return Link2;
  if (isDir) return Folder;

  const map: Record<string, React.ElementType> = {
    // Documents
    ".txt": FileText, ".md": FileText, ".pdf": FileText,
    ".doc": FileText, ".docx": FileText, ".xls": FileText,
    ".xlsx": FileText, ".csv": FileText, ".log": FileText,
    // Code
    ".js": Code, ".ts": Code, ".tsx": Code, ".jsx": Code,
    ".py": Code, ".java": Code, ".cpp": Code, ".c": Code,
    ".h": Code, ".css": Code, ".html": Code, ".json": Code,
    ".xml": Code, ".yaml": Code, ".yml": Code, ".sql": Code,
    ".sh": Code, ".bat": Code, ".ps1": Code, ".rs": Code,
    ".go": Code, ".rb": Code, ".php": Code,
    // Images
    ".png": Image, ".jpg": Image, ".jpeg": Image,
    ".gif": Image, ".svg": Image, ".bmp": Image,
    ".ico": Image, ".webp": Image,
    // Video
    ".mp4": Film, ".avi": Film, ".mkv": Film,
    ".mov": Film, ".wmv": Film, ".webm": Film,
    // Audio
    ".mp3": Music, ".wav": Music, ".flac": Music,
    ".aac": Music, ".ogg": Music, ".wma": Music,
    // Archives
    ".zip": Archive, ".rar": Archive, ".7z": Archive,
    ".tar": Archive, ".gz": Archive,
  };

  return map[ext] || FileQuestion;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function FileBrowser() {
  const { sendAndWait, status } = useWebSocket();
  const disabled = status !== "connected";

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [showDrives, setShowDrives] = useState(false);

  const navigate = useCallback(
    async (path?: string) => {
      if (disabled) return;
      setLoading(true);
      try {
        const payload: Record<string, unknown> = {};
        if (path) payload.path = path;

        const data = (await sendAndWait("fs_list", payload)) as {
          path?: string;
          parent?: string;
          entries?: FileEntry[];
          count?: number;
          error?: string;
        } | null;

        if (data?.error) {
          // Permission denied etc — stay where we are
          return;
        }

        if (data) {
          setEntries(data.entries || []);
          setCurrentPath(data.path || "");
          setParentPath(data.parent || null);
          setFileCount(data.count || 0);
          setShowDrives(false);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [sendAndWait, disabled]
  );

  const fetchDrives = useCallback(async () => {
    if (disabled) return;
    const data = (await sendAndWait("fs_drives")) as {
      drives?: DriveInfo[];
    } | null;
    if (data?.drives) setDrives(data.drives);
    setShowDrives(true);
  }, [sendAndWait, disabled]);

  // Initial load
  useEffect(() => {
    if (status === "connected") {
      navigate();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Breadcrumb segments
  const pathSegments = currentPath
    ? currentPath.split(/[/\\]/).filter(Boolean)
    : [];

  // Reconstruct a navigable path from segments
  const buildPath = (upToIndex: number) => {
    const sep = currentPath.includes("/") ? "/" : "\\";
    const segments = pathSegments.slice(0, upToIndex + 1);
    // On Windows, first segment is drive letter like "C:" — needs trailing separator
    if (segments.length === 1 && segments[0].endsWith(":")) {
      return segments[0] + sep;
    }
    return segments.join(sep);
  };

  return (
    <div className="flex flex-col h-full px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Folder size={14} className="text-accent/50" />
          <h2 className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-300">FS</h2>
          <span className="text-[9px] text-surface-600 bg-surface-900/80 px-1.5 py-0.5 rounded font-mono">
            {fileCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchDrives}
            disabled={disabled}
            title="Drives"
            className="btn-control w-7 h-7 text-surface-500 disabled:opacity-30"
          >
            <HardDrive size={12} />
          </button>
          <button
            onClick={() => navigate()}
            disabled={disabled}
            title="Home"
            className="btn-control w-7 h-7 text-surface-500 disabled:opacity-30"
          >
            <Home size={12} />
          </button>
          <button
            onClick={() => navigate(currentPath)}
            disabled={disabled}
            title="Refresh"
            className="btn-control w-7 h-7 text-surface-500 disabled:opacity-30"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {!showDrives && (
        <div className="flex items-center gap-0.5 mb-2 shrink-0 overflow-x-auto">
          {parentPath !== null && (
            <button
              onClick={() => navigate(parentPath)}
              aria-label="Go to parent directory"
              title="Back"
              className="p-1 rounded text-surface-500 hover:text-accent hover:bg-accent/8 transition-colors shrink-0"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {pathSegments.map((seg, i) => {
            return (
              <div key={i} className="flex items-center shrink-0">
                {i > 0 && (
                  <ChevronRight size={10} className="text-surface-600 mx-0.5" />
                )}
                <button
                  onClick={() => navigate(buildPath(i))}
                  className="text-[9px] text-surface-500 font-mono hover:text-accent px-1 py-0.5 rounded transition-colors truncate max-w-[80px]"
                  title={seg}
                >
                  {seg}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drives view */}
      {showDrives && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          <p className="text-[10px] font-mono text-surface-500 mb-2 tracking-wider">// select drive:</p>
          {drives.map((drive) => (
            <button
              key={drive.path}
              onClick={() => navigate(drive.path)}
              className="w-full flex items-center gap-3 bg-surface-900/60 border border-surface-700/20 rounded-lg px-3 py-2.5 hover:border-accent/25 hover:bg-accent/5 transition-all"
            >
              <HardDrive size={18} className="text-accent/70 shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-mono font-medium text-surface-300">
                  {drive.label}
                </div>
                {drive.total_gb !== undefined && (
                  <div className="text-[9px] text-surface-600 font-mono">
                    {drive.free_gb}G free / {drive.total_gb}G
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      {!showDrives && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-surface-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center py-8 text-surface-500 text-xs">
              Empty directory
            </p>
          ) : (
            entries.map((entry) => {
              const IconComponent = getFileIcon(
                entry.extension,
                entry.is_dir,
                entry.is_symlink
              );
              return (
                <button
                  key={entry.name}
                  onClick={() => {
                    if (entry.is_dir) {
                      const sep = currentPath.includes("/") ? "/" : "\\";
                      navigate(currentPath + sep + entry.name);
                    }
                  }}
                  aria-label={entry.is_dir ? `Open folder ${entry.name}` : entry.name}
                  className={`w-full flex items-center gap-2 rounded px-2.5 py-1.5 transition-all ${
                    entry.is_dir
                      ? "hover:bg-accent/5 hover:border-accent/20 cursor-pointer"
                      : "cursor-default"
                  } bg-surface-900/40 border border-surface-700/15`}
                >
                  <IconComponent
                    size={14}
                    className={`shrink-0 ${
                      entry.is_dir
                        ? "text-accent/60"
                        : entry.is_symlink
                        ? "text-yellow-400"
                        : "text-surface-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <span
                      className={`text-[11px] font-mono truncate block ${
                        entry.is_dir
                          ? "font-medium text-surface-300"
                          : "text-surface-400"
                      }`}
                    >
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] text-surface-600 w-16 text-right font-mono">
                      {entry.is_dir ? "" : formatSize(entry.size)}
                    </span>
                    <span className="text-[9px] text-surface-600 w-20 text-right hidden sm:block font-mono">
                      {formatDate(entry.modified)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
