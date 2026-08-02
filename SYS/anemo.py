#!/usr/bin/env python
from classes import *
import serial
import time
import signal
import sqlite3
from datetime import datetime

# Interruption depuis master.py ou par Ctrl+C
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

def acquisition():
    line = anemo.readline().decode('utf-8').strip()
    if line:
        try:
            direct = ""
            force = ""
            arg = 1
            for i in line[7:]:
                if i != "," and arg == 1:
                    direct += i
                elif i != "," and arg == 3:
                    force += i
                elif i == ",":
                    arg += 1
            return direct, force
        except IndexError:
            logging.warning(f"Received data is not in the expected format: {line}")
            return False
        except Exception as e:
            logging.error(f"Error during data acquisition: {e}")
            return False

sys_data_base = SysDataBase(__file__)

anemo = serial.Serial(
    port='/dev/ttyUSB0',
    baudrate=9600,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE,
    bytesize=serial.EIGHTBITS,
    timeout=1
)
anemo.reset_input_buffer()
anemo.reset_output_buffer()
time.sleep(0.1)

logging.info(f"Starting")
logging.debug(f"Saves the anemo informations into {sys_data_base.db_name}")

try:
    while running:
        start = time.monotonic()
        timestamp = datetime.now().isoformat()

        anemo_data = acquisition()

        if anemo_data:
            print(anemo_data)
            """
            try:
                sys_data_base.cursor.execute(
                    "INSERT INTO anemo_data (timestamp, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, mag_x, mag_y, mag_z, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (timestamp, *anemo_data, sys_data_base.session_id)
                )
                sys_data_base.conn.commit()
    
            except sqlite3.IntegrityError as e:
                logging.error(f"Integrity error: {e}")
            """

        # Gestion de la fréquence
        if anemo.in_waiting == 0 and running:
            time.sleep(0.01)

except Exception as e:
    logging.error(f"The execution was interrupted: {e}")

finally:
    sys_data_base.terminate_database_connexion()
    anemo.close()
    logging.info(f"{__file__} terminated")