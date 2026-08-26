#!/usr/bin/env python
from classes import *
import time
import signal
import sqlite3
import json
import paho.mqtt.client as mqtt
from datetime import datetime
from icm20948 import ICM20948

# Interruption depuis master.py ou par Ctrl+C
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

def acquisition():
    mag_x, mag_y, mag_z = imu.read_magnetometer_data()
    accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z = imu.read_accelerometer_gyro_data()
    return mag_x, mag_y, mag_z, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z

# MQTT
BROKER_ADDRESS = "localhost"
TOPIC_PREFIX = "capteur/imu"
CLIENT_ID = __file__
def on_connect(client, userdata, flags, rc):
    logging.debug(f"Connected to MQTT broker : {rc}")
client = mqtt.Client(callback_api_version=2, client_id=CLIENT_ID)
client.on_connect = on_connect
try:
    client.connect(BROKER_ADDRESS)
    logging.debug(f"MQTT connexion successfuly established")
except Exception as e:
    logging.error(f"MQTT connexion failed : {e}")

sys_data_base = SysDataBase(__file__)

imu = ICM20948()
Hz = 5
period = 1 / Hz

logging.info(f"Starting")
logging.debug(f"Saves the imu informations into {sys_data_base.db_name}")

compteur = 0
try:
    while running:
        start = time.monotonic()
        compteur += 1
        timestamp = datetime.now().isoformat()

        imu_data = acquisition()

        try:
            sys_data_base.cursor.execute(
                "INSERT INTO imu_data (timestamp, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, mag_x, mag_y, mag_z, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (timestamp, *imu_data, sys_data_base.session_id)
            )
            # Valider l'écriture une fois par seconde
            if compteur >= Hz:
                compteur = 0
                sys_data_base.conn.commit()

        except sqlite3.IntegrityError as e:
            logging.error(f"Integrity error: {e}")

        try:
            client.publish(f"{TOPIC_PREFIX}/pitch", str(imu_data[4]), retain=True)
            client.publish(f"{TOPIC_PREFIX}/roll", str(imu_data[3]), retain=True)
        except Exception as e:
            logging.warning(f"MQTT transfert error : {e}")

        # Gestion de la fréquence
        remaining = period - (time.monotonic() - start)
        if remaining > 0 and running:
            time.sleep(remaining)

except Exception as e:
    logging.error(f"The execution was interrupted: {e}")

finally:
    sys_data_base.terminate_database_connexion()
    logging.info(f"{__file__} terminated")