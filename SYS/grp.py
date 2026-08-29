#!/usr/bin/env python
from classes import *
import subprocess
import os
import sys

gpio_controller = GPIOController()
gpio_controller.connect_daemon()

@non_blocking
def blink():
    while True:
        gpio_controller.action('3', 'TOGGLE')
        time.sleep(1)

blink()

sys_data_base = False
try:
    session_id = sys.argv[1]
except Exception as e:
    sys_data_base = SysDataBase(__file__)
    session_id = sys_data_base.session_id
relative_path = os.path.join('sessions', str(session_id))
absolute_path = os.path.join(os.getcwd(), relative_path)

logging.info(f"Starting")
logging.debug(f"Saving the final .mp4 video as {relative_path}/final.mp4")

try:
    files = []
    for video in os.listdir(relative_path):
        if video.endswith(".h264"):
            files.append(os.path.join(absolute_path, video))
    files.sort()

    with open(os.path.join(relative_path, 'start.txt'), 'r', encoding='utf-8') as f:
        timestamp = f.read()

    with open("list.txt", "w") as f:
        for file in files:
            f.write(f"file '{os.path.abspath(file)}'\n")

    command = [
        'ffmpeg',
        '-fflags', '+genpts',
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-metadata', f'creation_time={timestamp}',
        os.path.join(relative_path, f"final.mp4")
    ]
    try:
        subprocess.run(command)
    except Exception as e:
        logging.error(f"FFmpeg raised an error : {e}")
        sys.exit(1)

    os.remove("list.txt")
    logging.debug("Videos properly merged")

except Exception as e:
    logging.error(f"Failed to merge videos : {e}")
    sys.exit(1)

finally:
    if sys_data_base:
        logging.debug("Closing database connection")
        sys_data_base.conn.close()
    if os.path.exists("list.txt"):
        os.remove("list.txt")
    gpio_controller.cleanup()
    logging.info(f"{__file__} terminated")