#!/usr/bin/env python
from classes import *
import logging
import traceback
from gpiozero import Button
import subprocess
import os
import signal
import time
import sys

button = Button(24, pull_up=True)
witness_button = False
session_is_running = False
session = None

def bouton_pressed():
    global witness_button
    witness_button = True
button.when_pressed = bouton_pressed

logging.info("Starting")
logging.info("Interface is standing by, ready for a new session")

while True:
    try:
        if witness_button:
            logging.debug("Button pressed")
            if session_is_running:
                session_is_running = False
                if session:
                    logging.debug("Sending SIGUSR1 to master.py")
                    os.kill(session.pid, signal.SIGUSR1)
                logging.info("Interface is standing by, ready for a new session")
            else:
                session_is_running = True
                logging.debug("Launching master.py")
                session = subprocess.Popen(["env/bin/python3", "master.py"])
            time.sleep(1)
            witness_button = False

        time.sleep(0.1)
    except KeyboardInterrupt:
        logging.info("Shutting down due to a KeyboardInterrupt")
        if session_is_running and session:
            logging.debug("Terminating ongoing session")
            session.terminate()
        sys.exit(0)
    except Exception as e:
        logging.critical(f"Major failure : a critical error crashed interface.py : {e}")
        logging.warning("Attempting to safely terminate the ongoing session and reboot")
        logging.critical(traceback.format_exc())
        try:
            if session:
                session.terminate()
                logging.debug("Terminating ongoing session")
        except Exception as e:
            logging.error("Failed to stop the ongoing session")
        logging.warning("Interface.py is exiting")
        emergency_reboot()
        sys.exit(1)