#!/usr/bin/env python
from classes import *
import sys
import queue
import paho.mqtt.client as mqtt
from datetime import datetime
import time
import signal

# Constantes
BROKER_ADDRESS = "localhost"
CLIENT_ID = __file__
PERIODE = 5

# Interruption depuis master.py ou par Ctrl+C
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

# Connexion à la base de données
sys_data_base = SysDataBase(__file__)
session_id = sys_data_base.session_id
try:
    session_id = sys.argv[1]
except Exception as e:
    session_id = sys_data_base.session_id

# Queue pour MQTT
q = queue.Queue()

# MQTT
def on_connect(client, userdata, flags, rc):
    logging.debug(f"Connected to MQTT broker : {rc}")
    client.subscribe("capteur/anemo/full")
    client.subscribe("capteur/gps/full")
    client.subscribe("capteur/imu/full")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode('utf-8')
    logging.debug(f"Received message on topic {topic} : {payload}")
    q.put((datetime.now().isoformat(), topic, payload))

client = mqtt.Client(callback_api_version=2, client_id=CLIENT_ID)
client.on_connect = on_connect
client.on_message = on_message
try:
    client.connect(BROKER_ADDRESS)
    logging.debug(f"MQTT connexion successfully established")
except Exception as e:
    logging.error(f"MQTT connexion failed : {e}")

client.loop_start()

logging.info(f"Starting {__file__}")
logging.debug(f"Using session_id = {session_id}, recording data into {sys_data_base.db_name}")

try:
    last_commit = time.time()
    while running:
        item = q.get()

        # Anemo data
        if item[1] == "capteur/anemo/full":
            try:
                sys_data_base.cursor.execute(
                    "INSERT INTO anemo_data (timestamp, awa, aws, session_id) VALUES (?, ?, ?, ?)",
                    (item[0], *item, session_id)
                )
            except sqlite3.IntegrityError as e:
                logging.error(f"Integrity error: {e}")

        # GPS data
        elif item[1] == "capteur/gps/full":
            try:
                sys_data_base.cursor.execute(
                    "INSERT INTO gps_data (timestamp, lat, lon, p_lat, p_lon, fix_qual, n_satellites, alt, alt_geoid, sog_kn, sog_kmh, cog, dilution, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (item[0], *item, session_id)
                )
            except sqlite3.IntegrityError as e:
                logging.error(f"Integrity error: {e}")

        # IMU data
        elif item[1] == "capteur/imu/full":
            try:
                sys_data_base.cursor.execute(
                    "INSERT INTO imu_data (timestamp, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, mag_x, mag_y, mag_z, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (item[0], *item, session_id)
                )
            except sqlite3.IntegrityError as e:
                logging.error(f"Integrity error: {e}")

        q.task_done()

        if time.time() - last_commit >= PERIODE:
            sys_data_base.conn.commit()
            last_commit = time.time()

finally:
    logging.debug("Closing database connection")
    sys_data_base.terminate_database_connexion()
    logging.info(f"{__file__} terminated")