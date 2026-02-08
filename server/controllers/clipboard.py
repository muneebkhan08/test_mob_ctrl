"""Clipboard controller — get/set clipboard text."""

import subprocess
import platform


class ClipboardController:
    def get_text(self, **_):
        if platform.system() == "Windows":
            try:
                result = subprocess.run(
                    ["powershell", "-command", "Get-Clipboard"],
                    capture_output=True,
                    text=True,
                )
                return {"text": result.stdout.strip()}
            except Exception as e:
                return {"error": str(e)}
        return {"error": "Unsupported platform"}

    def set_text(self, text: str = "", **_):
        if platform.system() == "Windows":
            try:
                # Escape single quotes for PowerShell
                safe = text.replace("'", "''")
                subprocess.run(
                    ["powershell", "-command", f"Set-Clipboard -Value '{safe}'"],
                    capture_output=True,
                )
                return {"copied": True}
            except Exception as e:
                return {"error": str(e)}
        return {"error": "Unsupported platform"}
