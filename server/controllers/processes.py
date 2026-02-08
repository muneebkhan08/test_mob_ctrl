"""
Process Manager Controller
==========================
Lists running processes with CPU/Memory stats and provides
kill/terminate capabilities by PID.

Uses psutil for cross-platform process management.
"""

import psutil


class ProcessController:
    """
    System process manager — list, sort, search, and kill processes.
    """

    def list_processes(
        self,
        sort_by: str = "memory",
        limit: int = 50,
        search: str = "",
        **_,
    ) -> dict:
        """
        List running processes sorted by memory or CPU usage.

        Args:
            sort_by: "memory" | "cpu" | "name" | "pid"
            limit:   Max number of processes to return (1–200)
            search:  Filter by process name (case-insensitive substring match)
        """
        limit = max(1, min(200, limit))
        processes = []

        # Collect process info — use oneshot() for efficient multi-attribute reads
        for proc in psutil.process_iter():
            try:
                with proc.oneshot():
                    pinfo = {
                        "pid": proc.pid,
                        "name": proc.name(),
                        "cpu_percent": round(proc.cpu_percent(interval=0), 1),
                        "memory_mb": round(proc.memory_info().rss / (1024 * 1024), 1),
                        "memory_percent": round(proc.memory_percent(), 1),
                        "status": proc.status(),
                        "username": "",
                    }
                    try:
                        pinfo["username"] = proc.username()
                    except (psutil.AccessDenied, psutil.NoSuchProcess):
                        pinfo["username"] = "SYSTEM"

                    # Apply search filter
                    if search:
                        if search.lower() not in pinfo["name"].lower():
                            continue

                    processes.append(pinfo)

            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Sort
        sort_keys = {
            "memory": lambda p: p["memory_mb"],
            "cpu": lambda p: p["cpu_percent"],
            "name": lambda p: p["name"].lower(),
            "pid": lambda p: p["pid"],
        }
        sort_fn = sort_keys.get(sort_by, sort_keys["memory"])
        reverse = sort_by in ("memory", "cpu")  # Descending for resource usage
        processes.sort(key=sort_fn, reverse=reverse)

        # System summary
        cpu_percent = psutil.cpu_percent(interval=0)
        mem = psutil.virtual_memory()

        return {
            "processes": processes[:limit],
            "total_count": len(processes),
            "system": {
                "cpu_percent": cpu_percent,
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": round(mem.total / (1024 ** 3), 1),
                "memory_used_gb": round(mem.used / (1024 ** 3), 1),
                "memory_percent": mem.percent,
            },
        }

    def kill_process(self, pid: int = 0, force: bool = False, **_) -> dict:
        """
        Terminate or force-kill a process by PID.

        Args:
            pid:   Process ID to kill
            force: If True, uses SIGKILL (force). If False, uses SIGTERM (graceful).
        """
        if not pid:
            return {"error": "No PID provided"}

        # Safety: don't allow killing critical system processes
        protected_pids = {0, 4}  # Idle, System on Windows
        if pid in protected_pids:
            return {"error": f"Cannot kill protected system process (PID {pid})"}

        try:
            proc = psutil.Process(pid)
            proc_name = proc.name()

            if force:
                proc.kill()   # SIGKILL
            else:
                proc.terminate()  # SIGTERM

            # Wait briefly for it to actually die
            try:
                proc.wait(timeout=3)
                return {
                    "killed": True,
                    "pid": pid,
                    "name": proc_name,
                    "method": "kill" if force else "terminate",
                }
            except psutil.TimeoutExpired:
                return {
                    "killed": False,
                    "pid": pid,
                    "name": proc_name,
                    "error": "Process did not exit within 3s. Try force kill.",
                }

        except psutil.NoSuchProcess:
            return {"error": f"Process {pid} does not exist"}
        except psutil.AccessDenied:
            return {"error": f"Access denied for PID {pid}. May need admin rights."}
        except Exception as exc:
            return {"error": str(exc)}

    def get_process_detail(self, pid: int = 0, **_) -> dict:
        """Get detailed info about a specific process."""
        if not pid:
            return {"error": "No PID provided"}

        try:
            proc = psutil.Process(pid)
            with proc.oneshot():
                info = {
                    "pid": proc.pid,
                    "name": proc.name(),
                    "exe": "",
                    "cmdline": [],
                    "status": proc.status(),
                    "cpu_percent": round(proc.cpu_percent(interval=0.1), 1),
                    "memory_mb": round(proc.memory_info().rss / (1024 * 1024), 1),
                    "memory_percent": round(proc.memory_percent(), 1),
                    "threads": proc.num_threads(),
                    "username": "",
                    "create_time": proc.create_time(),
                }
                try:
                    info["exe"] = proc.exe()
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    pass
                try:
                    info["cmdline"] = proc.cmdline()
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    pass
                try:
                    info["username"] = proc.username()
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    info["username"] = "SYSTEM"

            return info

        except psutil.NoSuchProcess:
            return {"error": f"Process {pid} does not exist"}
        except psutil.AccessDenied:
            return {"error": f"Access denied for PID {pid}"}
