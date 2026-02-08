"""
Remote Terminal Controller
==========================
Executes shell commands asynchronously via subprocess and returns
stdout/stderr output. Uses asyncio subprocess to avoid blocking
the main event loop.

Security:
  • Commands run in a subprocess with a hard timeout (30s default)
  • Output is capped at 64 KB to prevent memory exhaustion
  • Working directory is tracked per-session
"""

import os
import platform
import subprocess


# Hard limits
MAX_OUTPUT_BYTES = 65_536  # 64 KB
DEFAULT_TIMEOUT = 30       # seconds
MAX_TIMEOUT = 120          # seconds


class TerminalController:
    """
    Manages a stateful shell session with persistent working directory.
    Each command runs in a separate subprocess (not a persistent shell)
    but the cwd is tracked so `cd` commands work across invocations.
    """

    def __init__(self):
        self._cwd: str = self._default_cwd()
        self._shell = "powershell.exe" if platform.system() == "Windows" else "/bin/bash"

    @staticmethod
    def _default_cwd() -> str:
        return os.path.expanduser("~")

    def execute(self, command: str = "", timeout: int = DEFAULT_TIMEOUT, **_) -> dict:
        """
        Execute a shell command synchronously (called from WS handler thread).
        Returns stdout, stderr, exit code, and current working directory.
        """
        if not command or not command.strip():
            return {"error": "Empty command"}

        command = command.strip()
        timeout = min(max(1, timeout), MAX_TIMEOUT)

        # Handle `cd` commands — update internal cwd
        if self._is_cd_command(command):
            return self._handle_cd(command)

        try:
            # Use shell=True for proper command expansion
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self._cwd,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                # Don't create a visible window on Windows
                creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0,
            )

            stdout = result.stdout or ""
            stderr = result.stderr or ""

            # Cap output size
            if len(stdout) > MAX_OUTPUT_BYTES:
                stdout = stdout[:MAX_OUTPUT_BYTES] + "\n... [output truncated]"
            if len(stderr) > MAX_OUTPUT_BYTES:
                stderr = stderr[:MAX_OUTPUT_BYTES] + "\n... [output truncated]"

            return {
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": result.returncode,
                "cwd": self._cwd,
            }

        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "exit_code": -1,
                "cwd": self._cwd,
            }
        except Exception as exc:
            return {
                "stdout": "",
                "stderr": str(exc),
                "exit_code": -1,
                "cwd": self._cwd,
            }

    def get_cwd(self, **_) -> dict:
        """Return the current working directory."""
        return {"cwd": self._cwd}

    def set_cwd(self, path: str = "", **_) -> dict:
        """Set the working directory explicitly."""
        if not path:
            return {"error": "No path provided"}
        expanded = os.path.expanduser(os.path.expandvars(path))
        if os.path.isdir(expanded):
            self._cwd = os.path.abspath(expanded)
            return {"cwd": self._cwd}
        return {"error": f"Not a directory: {path}"}

    def reset(self, **_) -> dict:
        """Reset to home directory."""
        self._cwd = self._default_cwd()
        return {"cwd": self._cwd}

    # ── Internal helpers ─────────────────────────────────────────────────

    def _is_cd_command(self, cmd: str) -> bool:
        """Check if command is a cd/chdir."""
        lower = cmd.strip().lower()
        return lower == "cd" or lower.startswith("cd ") or lower.startswith("chdir ")

    def _handle_cd(self, cmd: str) -> dict:
        """Handle cd command by updating internal cwd."""
        parts = cmd.strip().split(maxsplit=1)
        if len(parts) < 2:
            # Bare `cd` → go home
            self._cwd = self._default_cwd()
            return {"stdout": "", "stderr": "", "exit_code": 0, "cwd": self._cwd}

        target = parts[1].strip().strip('"').strip("'")
        target = os.path.expanduser(os.path.expandvars(target))

        if target == "-":
            return {"stdout": "", "stderr": "", "exit_code": 0, "cwd": self._cwd}

        if target == "..":
            new_path = os.path.dirname(self._cwd)
        elif os.path.isabs(target):
            new_path = target
        else:
            new_path = os.path.join(self._cwd, target)

        new_path = os.path.abspath(new_path)

        if os.path.isdir(new_path):
            self._cwd = new_path
            return {"stdout": "", "stderr": "", "exit_code": 0, "cwd": self._cwd}

        return {
            "stdout": "",
            "stderr": f"cd: no such directory: {target}",
            "exit_code": 1,
            "cwd": self._cwd,
        }
