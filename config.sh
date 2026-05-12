# Hello World

apt-get update
apt-get -y upgrade
apt -y install tree
apt -y install python3-pip
apt -y install python3-full
apt -y install python3-venv
apt -y install sqlite3
apt -y install python3-colorlog

pip3 install time --break-system-packages
pip3 install RPi.GPIO --break-system-packages

#RASPICONFIG

# IMU
echo "Installing ICM20948 IMU"
apt -y install git
cd /home/user || exit
git -y clone https://github.com/pimoroni/icm20948-python
cd /home/user/icm20948-python || exit
./install.sh -n
cd /home/user || exit
pip3 install icm20948 --break-system-packages
echo "ICM20948 IMU installed successfully"

# GPS
echo "Installing GPS"
cd /home/user || exit
apt -y install --upgrade python3-setuptools
apt -y install python3-venv
python3 -m venv env --system-site-packages
source env/bin/activate
pip3 install --upgrade adafruit-python-shell --break-system-packages
wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
sudo -E venv PATH=$PATH python3 raspi-blinka.py
pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
cd /home/user || exit
echo "GPS installed successfully"

#
echo "Initializing database"
cd /home/user || exit
touch sys.db
sqlite3 sys.db "CREATE TABLE imu_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,

    accel_x REAL NOT NULL,
    accel_y REAL NOT NULL,
    accel_z REAL NOT NULL,

    gyro_x REAL NOT NULL,
    gyro_y REAL NOT NULL,
    gyro_z REAL NOT NULL,

    mag_x REAL NOT NULL,
    mag_y REAL NOT NULL,
    mag_z REAL NOT NULL,

    session_id INTAGER NOT NULL);"
sqlite3 sys.db "CREATE TABLE gps_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,

    lat REAL NOT NULL,
    lon REAL NOT NULL,
    p_lat VARCHAR NOT NULL,
    p_lon VARCHAR NOT NULL,

    fix_qual REAL,
    n_satellites INTAGER,

    alt REAL,
    alt_geoid REAL,

    sog_kn REAL NOT NULL,
    sog_kmh REAL,
    cog REAL NOT NULL,

    dilution REAL,
    session_id INTAGER NOT NULL);"
sqlite3 sys.db "CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    start DATETIME NOT NULL,
    stop DATETIME,

    name VARCHAR);"
cd /home/user || exit
echo "Database initialized successfully"

# Download code
echo "Downloading code"
cd /home/user || exit
git -y clone https://github.com/isao-px/abraxas.git
mv abraxas/*.py /home/user/
rm -rf abraxas
echo "Code downloaded successfully"

# Cleanup
rm config.sh