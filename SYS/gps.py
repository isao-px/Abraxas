#!/usr/bin/env python
from classes import *
import time
import signal
import sys
from datetime import datetime
import board
import busio
import adafruit_gps
import serial
import sqlite3
import paho.mqtt.client as mqtt

# Interruption par master.py ou par Ctrl+C
running = True
def stop_handler(sig, frame):
    global running
    running = False
signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)

def acquisition():
    # Obligatoires
    lat = f"{gps.latitude:.6f}"
    lon = f"{gps.longitude:.6f}"
    p_lat = f"{gps.latitude_degrees} degs, {gps.latitude_minutes:2.4f} mins"
    p_lon = f"{gps.longitude_degrees} degs, {gps.longitude_minutes:2.4f} mins"
    fix_qual = gps.fix_quality

    # Facultatifs
    n_satellites = gps.satellites
    alt = gps.altitude_m
    alt_geoid = gps.height_geoid
    sog_kn = gps.speed_knots
    sog_kmh = gps.speed_kmh
    cog = gps.track_angle_deg
    dilution = gps.horizontal_dilution

    return lat, lon, p_lat, p_lon, fix_qual, n_satellites, alt, alt_geoid, sog_kn, sog_kmh, cog, dilution

# MQTT
BROKER_ADDRESS = "localhost"
TOPIC_PREFIX = "capteur/gps"
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

rx = board.RX
tx = board.TX
uart = serial.Serial("/dev/serial0", baudrate=9600, timeout=10)

# Create an GPS instance
gps = adafruit_gps.GPS(uart, debug=False)

# Turn on the basic GGA and RMC info, then set update rate to 2Hz
gps.send_command(b"PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0")
Hz = 2
period = 1/Hz
gps.send_command(b'PMTK220,(period*1000)')

logging.info(f"Starting")
logging.debug(f"Saves the gps informations into {sys_data_base.db_name}")

try:
    c = 0
    while running:
        gps.update()
        if not gps.has_fix:
            logging.warning(f"GPS does not have a fix, waiting for it")
            time.sleep(1)
            continue

        # If the GPS has a fix
        timestamp = datetime.now().isoformat()
        start = time.monotonic()
        c += 1

        gps_data = acquisition()

        try:
            client.publish(f"{TOPIC_PREFIX}/sog", str(gps_data[8]), retain=True)
            client.publish(f"{TOPIC_PREFIX}/cog", str(gps_data[10]), retain=True)
            logging.debug(f"MQTT transfert successfuly done : sog: {gps_data[8]}, cog: {gps_data[10]}")
        except Exception as e:
            logging.warning(f"MQTT transfert error : {e}")

        # Gestion de la fréquence
        remaining = period - (time.monotonic() - start)
        if remaining > 0 and running:
            time.sleep(remaining)

except Exception as e:
    logging.error(f"The execution was interrupted: {e}")

finally:
    if sys_data_base:
        logging.debug("Closing database connection")
        sys_data_base.conn.close()
    logging.info(f"{__file__} terminated")