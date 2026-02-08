"""App controller — open, close, list running applications."""

import subprocess
import platform
import os


# Pre-defined common Windows apps with their launch commands
COMMON_APPS = {
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "paint": "mspaint.exe",
    "file explorer": "explorer.exe",
    "task manager": "taskmgr.exe",
    "command prompt": "cmd.exe",
    "powershell": "powershell.exe",
    "settings": "ms-settings:",
    "control panel": "control.exe",
    "word": "winword.exe",
    "excel": "excel.exe",
    "powerpoint": "powerpnt.exe",
    "chrome": "chrome.exe",
    "firefox": "firefox.exe",
    "edge": "msedge.exe",
    "spotify": "spotify.exe",
    "discord": "discord.exe",
    "slack": "slack.exe",
    "vs code": "code.exe",
    "visual studio code": "code.exe",
    "obs": "obs64.exe",
    "vlc": "vlc.exe",
    "steam": "steam.exe",
    "terminal": "wt.exe",
    "snipping tool": "snippingtool.exe",
}


class AppController:
    def open_app(self, name: str = "", path: str = "", **_):
        """Open an application by friendly name or path."""
        if path:
            subprocess.Popen(path, shell=True)
            return {"opened": path}

        name_lower = name.lower().strip()
        exe = COMMON_APPS.get(name_lower)

        if exe:
            try:
                if exe.startswith("ms-"):
                    os.startfile(exe)
                else:
                    subprocess.Popen(exe, shell=True)
                return {"opened": name}
            except Exception as e:
                return {"error": f"Could not open {name}: {str(e)}"}

        # Fallback: try running it directly
        try:
            subprocess.Popen(name, shell=True)
            return {"opened": name}
        except Exception as e:
            return {"error": f"Could not open {name}: {str(e)}"}

    def list_apps(self, **_):
        """Return list of available quick-launch apps + running processes."""
        running = []
        if platform.system() == "Windows":
            try:
                import psutil
                seen: set[str] = set()
                for proc in psutil.process_iter(["name", "pid"]):
                    info = proc.info
                    if info["name"] and info["name"] not in seen:
                        seen.add(info["name"])
                        running.append({"name": info["name"], "pid": info["pid"]})
            except Exception:
                pass

        return {
            "quick_launch": list(COMMON_APPS.keys()),
            "running": running[:50],  # Limit to 50
        }

    def close_app(self, name: str = "", pid: int = None, **_):
        """Close an application by name or PID."""
        if pid:
            try:
                import psutil
                proc = psutil.Process(pid)
                proc.terminate()
                return {"closed": pid}
            except Exception as e:
                return {"error": str(e)}

        if platform.system() == "Windows":
            subprocess.Popen(f"taskkill /IM {name} /F", shell=True)
            return {"closed": name}

        subprocess.Popen(f"pkill -f {name}", shell=True)
        return {"closed": name}
