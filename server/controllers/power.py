"""Power controller — shutdown, restart, sleep, lock, logout."""

import subprocess
import platform


class PowerController:
    def shutdown(self, delay: int = 0, **_):
        if platform.system() == "Windows":
            subprocess.Popen(f"shutdown /s /t {delay}", shell=True)
        else:
            subprocess.Popen(f"shutdown -h +{delay // 60}", shell=True)
        return {"action": "shutdown", "delay": delay}

    def restart(self, delay: int = 0, **_):
        if platform.system() == "Windows":
            subprocess.Popen(f"shutdown /r /t {delay}", shell=True)
        else:
            subprocess.Popen(f"shutdown -r +{delay // 60}", shell=True)
        return {"action": "restart", "delay": delay}

    def sleep(self, **_):
        if platform.system() == "Windows":
            subprocess.Popen(
                "rundll32.exe powrprof.dll,SetSuspendState 0,1,0", shell=True
            )
        else:
            subprocess.Popen("systemctl suspend", shell=True)
        return {"action": "sleep"}

    def lock(self, **_):
        if platform.system() == "Windows":
            subprocess.Popen("rundll32.exe user32.dll,LockWorkStation", shell=True)
        else:
            subprocess.Popen("loginctl lock-session", shell=True)
        return {"action": "lock"}

    def logout(self, **_):
        if platform.system() == "Windows":
            subprocess.Popen("shutdown /l", shell=True)
        else:
            subprocess.Popen("loginctl terminate-user $USER", shell=True)
        return {"action": "logout"}
