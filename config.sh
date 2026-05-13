#!/bin/bash

touch sys.log
exec > sys.log 2>&1
echo "Starting configuration script at $(date +%Y%m%d_%H%M%S)"

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
git clone https://github.com/pimoroni/icm20948-python
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

# Download code
echo "Downloading code"
cd /home/user || exit
git clone https://github.com/isao-px/abraxas.git
mv abraxas/*.py /home/user/
mv abraxas/config.sql /home/user/config.sql
rm -rf abraxas
echo "Code downloaded successfully"

# DB
echo "Initializing database"
cd /home/user || exit
touch sys.db
sqlite3 sys.db < config.sql
echo "Database initialized successfully"

# Cleanup
rm config.sql
echo "Configuration script completed at $(date +%Y%m%d_%H%M%S)"
rm config.sh