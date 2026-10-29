"""
Utility to ensure ports 8000 (Backend API), 3000 (Web Frontend), and 8081 (Expo Metro)
are completely freed before launching the unified ecosystem.
"""

import os
import re
import subprocess
import sys

def free_ports(ports=(8000, 3000, 8081)):
    if sys.platform != "win32":
        return
    my_pid = str(os.getpid())
    for p in ports:
        try:
            cmd = f'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort {p} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"'
            out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
            for line in out.strip().splitlines():
                pid = line.strip()
                if pid and pid != "0" and pid != my_pid:
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    print(f"  [Cleaned] Terminated process on port {p} (PID {pid})")
        except Exception:
            pass

if __name__ == "__main__":
    free_ports()
