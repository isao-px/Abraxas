#!/usr/bin/env python
from classes import *
import subprocess
import sys
import signal
import threading
import time
import os
from datetime import datetime

# Interruption externe
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

sys_data_base = False
try:
    session_id = sys.argv[1]
except Exception as e:
    sys_data_base = SysDataBase(__file__)
    session_id = sys_data_base.session_id

start_time = None
first_folder = 'sessions'
os.makedirs(first_folder, exist_ok=True)
folder = os.path.join(first_folder, str(session_id))
os.makedirs(folder, exist_ok=True)

logging.info(f"Starting")
logging.debug(f"Destination folder for the .h264 videos : {folder}")

def watch_first_segment(folder):
    global start_time
    first_file = os.path.join(folder, "video_00000.h264")

    while not os.path.exists(first_file):
        time.sleep(0.01)

    start_time = datetime.now()
    with open(os.path.join(folder, "start.txt"), "w", encoding="utf-8") as fichier:
        fichier.write(str(start_time))

watcher = threading.Thread(target=watch_first_segment, args=(folder,))
watcher.daemon = True
watcher.start()

cmd = [
    "rpicam-vid",
    "-t", "0",
    "--segment", "2000",
    "--inline",
    "-o", os.path.join(folder, "video_%05d.h264"),
    "--nopreview",
    "--codec", "h264"
]

try:
    proc = subprocess.Popen(cmd)
except Exception as e:
    logging.error(f"Error at the launching: {e}")
    sys.exit(1)

try:
    while running:
        signal.pause()

finally:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=4)
        except subprocess.TimeoutExpired:
            logging.warning("Process did not terminate_database_connexion in time, sending SIGKILL.")
            proc.kill()
    if sys_data_base:
        logging.debug("Closing database connection")
        sys_data_base.conn.close()
    logging.info(f"{__file__} terminated")