"""System info controller — CPU, RAM, battery, etc."""

import platform
import socket


class SystemInfoController:
    def get_info(self, **_):
        info = {
            "hostname": socket.gethostname(),
            "platform": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
        }

        try:
            import psutil

            info["cpu_percent"] = psutil.cpu_percent(interval=0.5)
            mem = psutil.virtual_memory()
            info["memory"] = {
                "total_gb": round(mem.total / (1024 ** 3), 1),
                "used_gb": round(mem.used / (1024 ** 3), 1),
                "percent": mem.percent,
            }

            battery = psutil.sensors_battery()
            if battery:
                info["battery"] = {
                    "percent": battery.percent,
                    "plugged": battery.power_plugged,
                }
        except ImportError:
            pass

        return info
