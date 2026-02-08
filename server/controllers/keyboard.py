"""Keyboard controller — press keys, combos, type text."""

import pyautogui

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0


class KeyboardController:
    # Map friendly names to pyautogui key names
    KEY_MAP = {
        "enter": "enter",
        "return": "enter",
        "tab": "tab",
        "space": "space",
        "backspace": "backspace",
        "delete": "delete",
        "escape": "esc",
        "esc": "esc",
        "up": "up",
        "down": "down",
        "left": "left",
        "right": "right",
        "home": "home",
        "end": "end",
        "pageup": "pageup",
        "pagedown": "pagedown",
        "capslock": "capslock",
        "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4",
        "f5": "f5", "f6": "f6", "f7": "f7", "f8": "f8",
        "f9": "f9", "f10": "f10", "f11": "f11", "f12": "f12",
        "ctrl": "ctrl",
        "alt": "alt",
        "shift": "shift",
        "win": "win",
        "super": "win",
        "meta": "win",
        "printscreen": "printscreen",
        "insert": "insert",
        "numlock": "numlock",
        "scrolllock": "scrolllock",
        "pause": "pause",
    }

    def _resolve_key(self, key: str) -> str:
        return self.KEY_MAP.get(key.lower(), key)

    def press(self, key: str = "", **_):
        """Press a single key."""
        resolved = self._resolve_key(key)
        pyautogui.press(resolved)
        return {"pressed": resolved}

    def combo(self, keys: list = None, **_):
        """Press a key combination like Ctrl+C."""
        if not keys:
            return {"error": "No keys provided"}
        resolved = [self._resolve_key(k) for k in keys]
        pyautogui.hotkey(*resolved)
        return {"combo": resolved}

    def type_text(self, text: str = "", **_):
        """Type a string of text."""
        pyautogui.typewrite(text, interval=0.02) if text.isascii() else self._type_unicode(text)
        return {"typed": len(text)}

    @staticmethod
    def _type_unicode(text: str):
        """Handle non-ASCII text via clipboard paste."""
        import subprocess
        # Escape single quotes for PowerShell
        safe = text.replace("'", "''")
        subprocess.run(
            ["powershell", "-command", f"Set-Clipboard -Value '{safe}'"],
            capture_output=True,
        )
        pyautogui.hotkey("ctrl", "v")
