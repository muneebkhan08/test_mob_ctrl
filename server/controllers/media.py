"""Media controller — play/pause, next, prev, stop via virtual key presses."""

import pyautogui

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0


class MediaController:
    def play_pause(self, **_):
        pyautogui.press("playpause")
        return {"media": "play_pause"}

    def next_track(self, **_):
        pyautogui.press("nexttrack")
        return {"media": "next"}

    def prev_track(self, **_):
        pyautogui.press("prevtrack")
        return {"media": "prev"}

    def stop(self, **_):
        pyautogui.press("stop")
        return {"media": "stop"}
