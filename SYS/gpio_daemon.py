#!/usr/bin/env python3
import socket
import os
import sys
import threading
import RPi.GPIO as GPIO
from pip._internal.utils import logging
import classes as cls

# --- CONFIGURATION ---
SOCKET_PATH = '/tmp/gpio_daemon.sock'
LEDS = {
    '1': 13,
    '2': 20,
    '3': 21,
    '4': 26,
    '5': 19,
    'SESSION': 1
}
# ---------------------

def setup_gpio():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for name, pin in LEDS.items():
        try:
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.LOW)
        except Exception as e:
            cls.logging.error(f"Erreur config GPIO {pin} : {e}".encode())


def handle_client(conn):
    try:
        data = conn.recv(1024).decode('utf-8').strip()
        if not data:
            return

        # Format attendu : "ID:ETAT"
        parts = data.split(':')
        if len(parts) != 2:
            conn.send(b"ERROR: Format invalide (ID:ETAT)\n")
            cls.logging.error(f"Format invalide reçu : {data}\n".encode())
            return

        led_id, action = parts
        action = action.upper()

        if led_id not in LEDS:
            conn.send(f"ERROR: LED {led_id} inconnue\n".encode())
            cls.logging.error(f"LED {led_id} inconnue\n".encode())
            return

        pin = LEDS[led_id]
        response = b"OK\n"

        if action == 'ON':
            GPIO.output(pin, GPIO.HIGH)
        elif action == 'OFF':
            GPIO.output(pin, GPIO.LOW)
        elif action == 'TOGGLE':
            current = GPIO.input(pin)
            GPIO.output(pin, not current)
        elif action == 'STATUS':
            state = "HIGH" if GPIO.input(pin) else "LOW"
            response = f"STATUS:{state}\n".encode()
            conn.send(response)
            return
        else:
            conn.send(f"ERROR: Action '{action} inconnue\n".encode())
            cls.logging.error(f"Action '{action} inconnue\n".encode())
            return

        conn.send(response)
    except Exception as e:
        conn.send(f"ERROR: {str(e)}\n".encode())
        cls.logging.error(f"Erreur non gérée : {str(e)}\n".encode())
    finally:
        conn.close()


def main():
    # Nettoyage ancien socket
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)

    setup_gpio()

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(SOCKET_PATH)
    server.listen(5)

    # Permissions larges sur le socket
    os.chmod(SOCKET_PATH, 0o777)

    cls.logging.info(f"GPIO deamon is listening on socket {SOCKET_PATH}")

    try:
        while True:
            conn, _ = server.accept()
            thread = threading.Thread(target=handle_client, args=(conn,))
            thread.daemon = True
            thread.start()
    except KeyboardInterrupt:
        cls.logging.error("GPIO deamon is shutting down")
    finally:
        server.close()
        os.remove(SOCKET_PATH)
        GPIO.cleanup()


if __name__ == '__main__':
    main()