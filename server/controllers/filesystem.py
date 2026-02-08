"""
File System Browser Controller
===============================
Browse directories, read file metadata, and navigate the file system.
Does NOT allow reading file contents or deleting files — this is a
browser only, for safety.

Security:
  • Read-only — no create, delete, move, or write operations
  • Hidden/system files excluded by default
  • Path traversal sanitised
"""

import os
import platform
import stat
import string
from datetime import datetime
from typing import Optional


class FilesystemController:
    """
    File-system browser — list directory contents with metadata.
    """

    # Files/dirs to always hide
    _HIDDEN_NAMES = {
        "$Recycle.Bin", "System Volume Information", "$RECYCLE.BIN",
        "pagefile.sys", "hiberfil.sys", "swapfile.sys",
        "DumpStack.log.tmp",
    }

    def list_directory(self, path: str = "", show_hidden: bool = False, **_) -> dict:
        """
        List contents of a directory.

        Args:
            path:        Directory path (defaults to user home)
            show_hidden: Include hidden/dot files
        """
        if not path:
            path = os.path.expanduser("~")

        path = os.path.expanduser(os.path.expandvars(path))
        path = os.path.abspath(path)

        if not os.path.exists(path):
            return {"error": f"Path does not exist: {path}"}
        if not os.path.isdir(path):
            return {"error": f"Not a directory: {path}"}

        entries = []
        try:
            with os.scandir(path) as scanner:
                for entry in scanner:
                    try:
                        name = entry.name

                        # Skip hidden
                        if not show_hidden:
                            if name.startswith("."):
                                continue
                            if name in self._HIDDEN_NAMES:
                                continue
                            # Windows hidden attribute
                            if platform.system() == "Windows":
                                try:
                                    attrs = entry.stat().st_file_attributes  # type: ignore[attr-defined]
                                    if attrs & stat.FILE_ATTRIBUTE_HIDDEN:
                                        continue
                                except (AttributeError, OSError):
                                    pass

                        is_dir = entry.is_dir(follow_symlinks=False)
                        is_link = entry.is_symlink()

                        try:
                            st = entry.stat(follow_symlinks=False)
                            size = 0 if is_dir else st.st_size
                            modified = datetime.fromtimestamp(st.st_mtime).isoformat()
                        except OSError:
                            size = 0
                            modified = ""

                        entries.append({
                            "name": name,
                            "is_dir": is_dir,
                            "is_symlink": is_link,
                            "size": size,
                            "modified": modified,
                            "extension": "" if is_dir else os.path.splitext(name)[1].lower(),
                        })
                    except (PermissionError, OSError):
                        continue

        except PermissionError:
            return {"error": f"Permission denied: {path}"}
        except OSError as exc:
            return {"error": str(exc)}

        # Sort: folders first, then by name
        entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))

        # Parent
        parent = os.path.dirname(path) if path != os.path.dirname(path) else None

        return {
            "path": path,
            "parent": parent,
            "entries": entries,
            "count": len(entries),
        }

    def get_drives(self, **_) -> dict:
        """
        List available drives / mount points.
        Windows: drive letters (C:, D:, …)
        Linux/Mac: common mount points
        """
        if platform.system() == "Windows":
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    try:
                        total, used, free = _disk_usage(drive)
                        drives.append({
                            "path": drive,
                            "label": f"{letter}:",
                            "total_gb": round(total / (1024 ** 3), 1),
                            "free_gb": round(free / (1024 ** 3), 1),
                        })
                    except OSError:
                        drives.append({"path": drive, "label": f"{letter}:"})
            return {"drives": drives}
        else:
            # Unix: return common mount points
            mounts = ["/", "/home", "/tmp", "/mnt", "/media"]
            return {
                "drives": [
                    {"path": p, "label": p}
                    for p in mounts
                    if os.path.isdir(p)
                ],
            }

    def get_file_info(self, path: str = "", **_) -> dict:
        """Get detailed info about a single file or directory."""
        if not path:
            return {"error": "No path provided"}

        path = os.path.expanduser(os.path.expandvars(path))
        path = os.path.abspath(path)

        if not os.path.exists(path):
            return {"error": f"Path does not exist: {path}"}

        try:
            st = os.stat(path, follow_symlinks=False)
            is_dir = os.path.isdir(path)
            return {
                "path": path,
                "name": os.path.basename(path),
                "is_dir": is_dir,
                "is_symlink": os.path.islink(path),
                "size": 0 if is_dir else st.st_size,
                "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                "created": datetime.fromtimestamp(st.st_ctime).isoformat(),
                "extension": "" if is_dir else os.path.splitext(path)[1].lower(),
            }
        except PermissionError:
            return {"error": f"Permission denied: {path}"}
        except OSError as exc:
            return {"error": str(exc)}


def _disk_usage(path: str):
    """Cross-platform disk usage (total, used, free) in bytes."""
    import shutil
    usage = shutil.disk_usage(path)
    return usage.total, usage.used, usage.free
