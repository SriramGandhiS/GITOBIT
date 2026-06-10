import subprocess
import time
import sys
import os

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
server_path = os.path.join(DIRECTORY, "server.py")

print("Starting auto-restart server wrapper loop...")

while True:
    try:
        print(f"Starting server.py process at {time.strftime('%Y-%m-%d %H:%M:%S')}...")
        subprocess.run([sys.executable, server_path], check=True)
    except Exception as e:
        print(f"Server process exited or crashed: {e}")
    
    print("Restarting server in 2 seconds...")
    time.sleep(2)
