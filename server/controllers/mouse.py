"""Mouse controller — move, click, scroll, drag."""

import pyautogui

# Disable the fail-safe so edge moves don't crash
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0  # Remove default pause for snappier response


class MouseController:
    def __init__(self):
        self._dragging = False

    def move(self, dx: float = 0, dy: float = 0, **_):
        """Relative mouse movement."""
        pyautogui.moveRel(dx, dy, duration=0)
        return {"moved": [dx, dy]}

    def click(self, button: str = "left", **_):
        pyautogui.click(button=button)
        return {"clicked": button}

    def double_click(self, **_):
        pyautogui.doubleClick()
        return {"double_clicked": True}

    def right_click(self, **_):
        pyautogui.rightClick()
        return {"right_clicked": True}

    def scroll(self, dy: float = 0, dx: float = 0, **_):
        """Scroll vertically (dy) and horizontally (dx)."""
        if dy:
            pyautogui.scroll(int(dy))
        if dx:
            pyautogui.hscroll(int(dx))
        return {"scrolled": [dx, dy]}

    def drag_start(self, **_):
        self._dragging = True
        pyautogui.mouseDown()
        return {"drag": "started"}

    def drag_move(self, dx: float = 0, dy: float = 0, **_):
        if self._dragging:
            pyautogui.moveRel(dx, dy, duration=0)
        return {"drag_moved": [dx, dy]}

    def drag_end(self, **_):
        self._dragging = False
        pyautogui.mouseUp()
        return {"drag": "ended"}
