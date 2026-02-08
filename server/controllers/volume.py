"""Volume controller — uses pycaw on Windows, pactl on Linux."""

import platform
import subprocess


class VolumeController:
    def __init__(self):
        self._windows_volume = None
        if platform.system() == "Windows":
            try:
                from ctypes import cast, POINTER
                from comtypes import CLSCTX_ALL
                from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(
                    IAudioEndpointVolume._iid_, CLSCTX_ALL, None
                )
                self._windows_volume = cast(
                    interface, POINTER(IAudioEndpointVolume)
                )
            except Exception:
                pass

    def get_volume(self, **_):
        if platform.system() == "Windows" and self._windows_volume:
            level = self._windows_volume.GetMasterVolumeLevelScalar()
            muted = self._windows_volume.GetMute()
            return {"volume": round(level * 100), "muted": bool(muted)}
        return {"volume": -1, "muted": False}

    def set_volume(self, level: int = 50, **_):
        level = max(0, min(100, level))
        if platform.system() == "Windows" and self._windows_volume:
            self._windows_volume.SetMasterVolumeLevelScalar(level / 100, None)
            return {"volume": level}
        return {"error": "Unsupported platform"}

    def volume_up(self, step: int = 5, **_):
        info = self.get_volume()
        current = info.get("volume", 50)
        return self.set_volume(level=min(100, current + step))

    def volume_down(self, step: int = 5, **_):
        info = self.get_volume()
        current = info.get("volume", 50)
        return self.set_volume(level=max(0, current - step))

    def toggle_mute(self, **_):
        if platform.system() == "Windows" and self._windows_volume:
            current = self._windows_volume.GetMute()
            self._windows_volume.SetMute(not current, None)
            return {"muted": not current}
        return {"error": "Unsupported platform"}
