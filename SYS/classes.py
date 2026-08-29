#!/usr/bin/env python
import sqlite3
import socket
import colorlog
import logging
import threading
import time
import subprocess

handler = colorlog.StreamHandler()
handler.setFormatter(colorlog.ColoredFormatter(
    "%(log_color)s%(asctime)s | %(filename)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
log = logging.getLogger()
log.addHandler(handler)

file_handler = logging.FileHandler('sys.log')
file_formatter = logging.Formatter(
    "%(asctime)s | %(filename)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(file_formatter)
log.addHandler(file_handler)

log.setLevel(logging.DEBUG)

class SysDataBase:
    def __init__(self, filename):
        self.filename = filename

        self.db_name = "sys.db"
        # Connexion inter-thread pour atteindre les callbacks gpiozero (thread distant)
        self.conn = sqlite3.connect(self.db_name, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self.session_id = self.conn.execute("SELECT max(id) FROM sessions;").fetchone()[0]
        self.session_id = int(self.session_id) if self.session_id else 0

    def terminate_database_connexion(self):
        try:
            self.conn.commit()
        except Exception as e:
            logging.warning(f"The final flush was interrupted: {e}")
        try:
            self.conn.close()
        except Exception as e:
            logging.error(f"Failed to close the database connection: {e}")

    def actualise_session_id(self):
        self.session_id += 1

class GPIOController:
    def __init__(self):
        self.s = None
        self.sock_path = '/tmp/gpio_daemon.sock'
        self._create_socket()

    def _create_socket(self):
        try:
            self.s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        except Exception as e:
            logging.error(f"Failed to create socket: {e}")
            self.s = None

    def connect_daemon(self):
        if self.s is None:
            self._create_socket()
        try:
            self.s.connect(self.sock_path)
        except Exception as e:
            logging.error(f"Failed to connect to gpio daemon: {e}")
            raise

    def action(self, led_id, action):
        if self.s is None:
            logging.warning("Socket not created—attempting to recreate and reconnect")
            self._create_socket()
            try:
                self.connect_daemon()
            except Exception:
                logging.error("Reconnect failed; skipping GPIO action")
                return
        try:
            self.s.send(f"{led_id}:{action}".encode())
        except (BrokenPipeError, OSError) as e:
            logging.warning(f"Socket send failed ({e}); attempting reconnect and resend")
            try:
                self.cleanup()
            except Exception:
                pass
            # recreate and try once
            self._create_socket()
            try:
                self.connect_daemon()
                self.s.send(f"{led_id}:{action}".encode())
            except Exception as e2:
                logging.error(f"Reconnect+send failed; giving up: {e2}")

    def receive_response(self):
        try:
            response = self.s.recv(1024).decode()
            return response
        except Exception as e:
            logging.error(f"Failed to receive from gpio daemon: {e}")
            return None

    def cleanup(self):
        try:
            if self.s:
                self.s.close()
        finally:
            self.s = None

def non_blocking(func):
    def wrapper(*args, **kwargs):
        thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
        thread.start()
        return thread
    return wrapper

def emergency_reboot():
    logging.warning("Emergency reboot initiated")
    time.sleep(1)
    subprocess.Popen(["sudo", "reboot"])
