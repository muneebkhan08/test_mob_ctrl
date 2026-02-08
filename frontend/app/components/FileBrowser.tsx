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
    const segments = pathSegments.slice(0, upToIndex + 1);
    // On Windows, first segment is drive letter like "C:" — needs trailing backslash
    if (segments.length === 1 && segments[0].endsWith(":")) {
      return segments[0] + "\\";
    }
    return segments.join("\\");
  };

  return (
    <div className="flex flex-col h-full px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Folder size={16} className="text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-200">Files</h2>
          <span className="text-[10px] text-surface-500 bg-surface-800/60 px-1.5 py-0.5 rounded">
            {fileCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchDrives}
            disabled={disabled}
            title="Drives"
            className="btn-control w-8 h-8 text-surface-400 disabled:opacity-30"
          >
            <HardDrive size={14} />
          </button>
          <button
            onClick={() => navigate()}
            disabled={disabled}
            title="Home"
            className="btn-control w-8 h-8 text-surface-400 disabled:opacity-30"
          >
            <Home size={14} />
          </button>
          <button
            onClick={() => navigate(currentPath)}
            disabled={disabled}
            title="Refresh"
            className="btn-control w-8 h-8 text-surface-400 disabled:opacity-30"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {!showDrives && (
        <div className="flex items-center gap-0.5 mb-2 shrink-0 overflow-x-auto">
          {parentPath !== null && (
            <button
              onClick={() => navigate(parentPath)}
              className="p-1 rounded-md text-surface-400 hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
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
                  className="text-[10px] text-surface-400 hover:text-accent px-1 py-0.5 rounded transition-colors truncate max-w-[80px]"
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
          <p className="text-xs text-surface-400 mb-2">Select a drive:</p>
          {drives.map((drive) => (
            <button
              key={drive.path}
              onClick={() => navigate(drive.path)}
              className="w-full flex items-center gap-3 bg-surface-800/50 border border-surface-700/20 rounded-lg px-3 py-3 hover:border-accent/30 hover:bg-accent/5 transition-all"
            >
              <HardDrive size={20} className="text-accent shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium text-surface-200">
                  {drive.label}
                </div>
                {drive.total_gb !== undefined && (
                  <div className="text-[10px] text-surface-500">
                    {drive.free_gb}GB free / {drive.total_gb}GB total
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
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all ${
                    entry.is_dir
                      ? "hover:bg-accent/5 hover:border-accent/20 cursor-pointer"
                      : "cursor-default"
                  } bg-surface-800/30 border border-surface-700/15`}
                >
                  <IconComponent
                    size={16}
                    className={`shrink-0 ${
                      entry.is_dir
                        ? "text-accent-light"
                        : entry.is_symlink
                        ? "text-yellow-400"
                        : "text-surface-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <span
                      className={`text-xs truncate block ${
                        entry.is_dir
                          ? "font-medium text-surface-200"
                          : "text-surface-300"
                      }`}
                    >
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-surface-500 w-16 text-right">
                      {entry.is_dir ? "" : formatSize(entry.size)}
                    </span>
                    <span className="text-[10px] text-surface-600 w-20 text-right hidden sm:block">
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
