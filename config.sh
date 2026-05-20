#!/bin/bash

cd ~ || exit
# touch sys.log
# exec > sys.log 2>&1
echo "Starting configuration script at $(date +%Y-%m-%d_%H:%M:%S)"

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

# raspiconfig

# IMU
echo "Installing ICM20948 IMU"
apt -y install git
cd /home/"$user"/ || exit
git clone https://github.com/pimoroni/icm20948-python
cd /home/"$user"/icm20948-python || exit
./install.sh -n
pip3 install icm20948 --break-system-packages
echo "ICM20948 IMU installed successfully"

# GPS
echo "Installing GPS"
cd /home/"$user"/ || exit
apt -y install --upgrade python3-setuptools
apt -y install python3-venv
python3 -m venv env --system-site-packages
source env/bin/activate
pip3 install --upgrade adafruit-python-shell --break-system-packages
wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
sudo -E venv PATH="$PATH" python3 raspi-blinka.py
pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
echo "GPS installed successfully"

# Download code
echo "Downloading code"
cd /home/"$user"/ || exit
git clone https://github.com/isao-px/abraxas.git
mv /home/"$user"/abraxas/SYS/*.py /home/"$user"/
mv /home/"$user"/abraxas/config.sql /home/"$user"/config.sql
rm -rf /home/"$user"/abraxas
echo "Code downloaded successfully"

# DB
echo "Initializing database"
cd /home/"$user"/ || exit
if [ ! -f /home/"$user"/sys.db ]; then
    touch /home/"$user"/sys.db
    sqlite3 /home/"$user"/sys.db < config.sql
else
    echo "Database already exists"
fi
echo "Database initialized successfully"

# Configuration of cron
chmod +x /home/"$user"/interface.py
touch /tmp/cron_config
crontab -u "$user" -l > /tmp/cron_config
"@reboot python3 /home/$user/interface.py" >> /tmp/cron_config
crontab -u "$user" /tmp/cron
rm /tmp/cron_config

# Cleanup
cd /home/"$user"/ || exit
rm /home/"$user"/config.sql
echo "Configuration script completed at $(date +%Y-%m-%d_%H:%M:%S)"
rm /home/"$user"/config.sh
echo "The Raspberry will reboot now"
reboot
