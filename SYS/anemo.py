import serial
import time

# Configuration du port série
# Remplacez '/dev/ttyUSB0' par votre port si différent
anemo = serial.Serial(
    port='/dev/ttyUSB0',
    baudrate=9600,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE,
    bytesize=serial.EIGHTBITS,
    timeout=1
)

# Important : Purge les tampons d'entrée et de sortie pour éviter les données résiduelles
anemo.reset_input_buffer()
anemo.reset_output_buffer()

# Laissez un très court instant pour la stabilisation matérielle (optionnel mais recommandé)
time.sleep(0.1)

try:
    while True:
        if anemo.in_waiting > 0:
            # Lecture d'une ligne complète (jusqu'au caractère de retour chariot)
            line = anemo.readline().decode('utf-8').strip()
            if line:
                print(f"Donnée reçue : {line}")
except KeyboardInterrupt:
    print("\nLecture arrêtée.")
finally:
    anemo.close()
