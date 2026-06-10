import subprocess
import time
import sys
import os

print("Starting background randomizer scheduler daemon loop...")
script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cloud_random_scheduler.py")

while True:
    try:
        print(f"Executing scheduler tick at {time.strftime('%Y-%m-%d %H:%M:%S')}...")
        # Run the scheduler script
        subprocess.run([sys.executable, script_path], check=True)
    except Exception as e:
        print(f"Error executing scheduler: {e}")
    
    # Sleep for 10 minutes (600 seconds)
    time.sleep(600)
