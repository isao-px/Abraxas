#!/usr/bin/env python
from classes import *
import serial
import sys
import time
import signal
import sqlite3
import paho.mqtt.client as mqtt
from datetime import datetime

# Interruption depuis master.py ou par Ctrl+C
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

# Dico pour la conversion avec les multiples
TO_KNOTS = {'N': 1.0, 'M': 3600 / 1852, 'K': 1 / 1.852}

def acquisition():
    line = anemo.readline().decode('utf-8', errors='ignore').strip()
    if not line:
        return False
    try:
        fields = line.split('*')[0].split(',')
        if len(fields) < 6 or not fields[0].endswith('MWV'):
            logging.debug(f"Ignored sentence: {line}")
            return False
        angle, reference, speed, unit, status = fields[1:6]
        # Selon la doc par principe mais impossible d'avoir du vent réel
        if reference != 'R' or status != 'A':
            logging.debug(f"Ignored sentence (not a valid apparent wind): {line}")
            return False
        awa = float(angle) % 360
        aws = float(speed) * TO_KNOTS[unit]
        return round(awa, 1), round(aws, 2)
    except (ValueError, KeyError):
        logging.warning(f"Received data is not in the expected format: {line}")
        return False
    except Exception as e:
        logging.error(f"Error during data acquisition: {e}")
        return False

# MQTT
BROKER_ADDRESS = "localhost"
TOPIC_PREFIX = "capteur/anemo"
CLIENT_ID = __file__
def on_connect(client, userdata, flags, rc):
    logging.debug(f"Connected to MQTT broker : {rc}")
client = mqtt.Client(callback_api_version=2, client_id=CLIENT_ID)
client.on_connect = on_connect
try:
    client.connect(BROKER_ADDRESS)
    logging.debug(f"MQTT connexion successfully established")
except Exception as e:
    logging.error(f"MQTT connexion failed : {e}")

sys_data_base = False
try:
    session_id = sys.argv[1]
except Exception as e:
    sys_data_base = SysDataBase(__file__)
    session_id = sys_data_base.session_id

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
logging.debug(f"Sends the anemo informations by MQTT")

try:
    while running:
        timestamp = datetime.now().isoformat()

        anemo_data = acquisition()

        if anemo_data:
            try:
                client.publish(f"{TOPIC_PREFIX}/awa", str(anemo_data[0]), retain=True)
                client.publish(f"{TOPIC_PREFIX}/aws", str(anemo_data[1]), retain=True)
                client.publish(f"{TOPIC_PREFIX}/full", str(anemo_data), retain=True)
            except Exception as e:
                logging.warning(f"MQTT transfert error : {e}")

        # Gestion de la fréquence
        if anemo.in_waiting == 0 and running:
            time.sleep(1)

except Exception as e:
    logging.error(f"The execution was interrupted: {e}")

finally:
    if sys_data_base:
        logging.debug("Closing database connection")
        sys_data_base.conn.close()
    anemo.close()
    logging.info(f"{__file__} terminated")