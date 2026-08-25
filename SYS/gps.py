#!/usr/bin/env python
from classes import *
import time
import signal
from datetime import datetime
import board
import busio
import adafruit_gps
import serial
import sqlite3
import json
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
TOPIC = "capteur/gps"
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

        # Requête SQL
        try:
            sys_data_base.cursor.execute(
                "INSERT INTO gps_data (timestamp, lat, lon, p_lat, p_lon, fix_qual, n_satellites, alt, alt_geoid, sog_kn, sog_kmh, cog, dilution, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (timestamp, *gps_data, sys_data_base.session_id)
            )
            # Valider l'écriture
            if c >= Hz:
                c = 0
                sys_data_base.conn.commit()

        except sqlite3.IntegrityError as e:
            logging.warning(f"Integrity error: {e}")

        # Gestion de la fréquence
        remaining = period - (time.monotonic() - start)
        if remaining > 0 and running:
            time.sleep(remaining)

except Exception as e:
    logging.error(f"The execution was interrupted: {e}")

finally:
    sys_data_base.terminate_database_connexion()
    logging.info(f"{__file__} terminated")