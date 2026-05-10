#!/usr/bin/env python
from classes import *
import subprocess
import sys
import time
import logging
from datetime import datetime
import signal

ending_session = False

def handle_usr1(signum, frame):
    global ending_session
    ending_session = True
signal.signal(signal.SIGUSR1, handle_usr1)

def shutdown():
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
    time.sleep(5)
    for proc in processes:
        if proc.poll() is None:
            logging.warning(f"Process {proc} did not terminate in time, sending SIGKILL.")
            proc.kill()

sys_data_base = SysDataBase(__file__)
logging.info("Starting")

try:
    timestamp = datetime.now().isoformat()
    sys_data_base.cursor.execute(
        "INSERT INTO sessions (start, stop, name) VALUES (?, ?, ?)",
        (timestamp, None, None)
    )
    sys_data_base.conn.commit()
    sys_data_base.actualise_session_id()
    logging.debug(f"Session {sys_data_base.session_id} created")
except Exception as e:
    logging.error(f"Failed to create a new session : {e}")
    sys.exit(1)

try:
    logging.debug("Launching imu.py")
    logging.debug("Launching gps.py")
    logging.debug("Launching vid.py")
    processes = [
        subprocess.Popen(["python3", "imu.py"]),
        subprocess.Popen(["python3", "gps.py"]),
        subprocess.Popen(["python3", "vid.py", str(sys_data_base.session_id)]),
    ]
except Exception as e:
    logging.critical(f"Failed to launch the dependencies : {e}")
    shutdown()
    sys.exit(1)

try:
    while not ending_session:
        signal.pause()
except Exception as e:
    logging.critical(f"Failed to terminate the subprocesses : {e}")
    shutdown()
    sys.exit(1)

if ending_session:
    shutdown()
    for proc in processes:
        proc.wait()
    logging.debug("All subprocesses terminated.")

    try:
        timestamp = datetime.now().isoformat()
        sys_data_base.cursor.execute(
            "UPDATE sessions SET stop = ? WHERE id = (SELECT max(id) FROM sessions);",
            (timestamp,)
        )
        sys_data_base.terminate_database_connexion()
        logging.debug(f"Session {sys_data_base.session_id} ended, connexion closed")
    except Exception as e:
        logging.error(f"Failed to properly end the session : {e}")
        sys.exit(1)

    logging.debug("Session properly ended")
    logging.debug("launching grp.py")
    fusion = subprocess.run(["python3", "grp.py", str(sys_data_base.session_id)])
    logging.info(f"Master terminated for session {sys_data_base.session_id}")
    sys.exit(0)