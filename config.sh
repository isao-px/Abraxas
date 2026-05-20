#!/bin/bash

cd ~ || exit
# touch sys.log
# exec > sys.log 2>&1
echo "Starting configuration script at $(date +%Y%m%d_%H%M%S)"

user_check() {
	if [ "$(id -u)" -eq 0 ]; then
		echo "User check passed, running as $(whoami)"
	else
		fatal "Script should be running as root. Try 'sudo ./install.sh'\n"
	fi
}
user_check

# Détermination de l'utilisateur
user=$(ls /home | head -n 1)

# Installations générales
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

# RASPICONFIG
raspiconfig

# IMU
echo "Installing ICM20948 IMU"
apt -y install git
cd ~ || exit
git clone https://github.com/pimoroni/icm20948-python
cd icm20948-python || exit
./install.sh -n
cd ~ || exit
pip3 install icm20948 --break-system-packages
echo "ICM20948 IMU installed successfully"

# GPS
echo "Installing GPS"
cd ~ || exit
apt -y install --upgrade python3-setuptools
apt -y install python3-venv
python3 -m venv env --system-site-packages
source env/bin/activate
pip3 install --upgrade adafruit-python-shell --break-system-packages
wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
sudo -E venv PATH="$PATH" python3 raspi-blinka.py
pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
cd ~ || exit
echo "GPS installed successfully"

# Download code
echo "Downloading code"
cd ~ || exit
git clone https://github.com/isao-px/abraxas.git
mv abraxas/SYS/*.py .
mv abraxas/config.sql config.sql
rm -rf abraxas
cd ~ || exit
echo "Code downloaded successfully"

# DB
echo "Initializing database"
cd ~ || exit
if [ ! -f sys.db ]; then
    touch sys.db
    sqlite3 sys.db < config.sql
else
    echo "Database already exists"
fi
cd ~ || exit
echo "Database initialized successfully"

# Configuration of cron
chmod +x interface.py
crontab -u "$user" -l > /tmp/cron_config
"@reboot python3 /home/$user/interface.py" >> /tmp/cron_config
crontab -u "$user" /tmp/cron
rm /tmp/cron_config

# Cleanup
cd ~ || exit
rm config.sql
echo "Configuration script completed at $(date +%Y%m%d_%H%M%S)"
# rm config.sh
echo "The Raspberry will reboot now"
reboot
