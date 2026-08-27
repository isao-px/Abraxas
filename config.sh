#!/bin/bash

success() {
	echo -e "$(tput setaf 2)$1$(tput sgr0)"
}

inform() {
	echo -e "$(tput setaf 6)$1$(tput sgr0)"
}

warning() {
	echo -e "$(tput setaf 1)WARNING:$(tput sgr0) $1"
}

fatal() {
	echo -e "$(tput setaf 1)FATAL:$(tput sgr0) $1"
	exit 1
}

user_check() {
	if [ "$(id -u)" -eq 0 ]; then
		inform "User check passed, running as $(whoami)"
	else
		fatal "Script should be running as root. Try 'sudo ./config.sh'"
	fi
}

counter=0
next_step() {
    counter=$((counter + 1))
    echo "Progress=$counter"
}

main() {
    next_step
    inform "Starting configuration script at $(date +%Y-%m-%d_%H:%M:%S)"

    # Détermination de l'utilisateur
    user=$(ls /home | head -n 1)

    # Installations générales
    inform "Updating and installing packages"
    apt-get update
    next_step
    apt-get -y upgrade
    next_step
    apt -y install tree
    next_step
    apt -y install git
    next_step
    apt -y install python3-pip
    next_step
    apt -y install python3-full
    next_step
    apt -y install python3-venv
    next_step
    apt -y install sqlite3
    next_step
    apt -y install python3-colorlog
    next_step
    apt -y install expect
    next_step
    apt -y install --upgrade python3-setuptools
    next_step
    apt -y install ffmpeg
    next_step
    apt -y install nodejs
    next_step
    apt -y install npm
    next_step

    pip3 install RPi.GPIO --break-system-packages --root-user-action=ignore
    next_step
    success "General packages installed successfully"

    # Configuration of serial
    inform "Configuring serial"
    sudo raspi-config nonint do_serial_cons 1
    sudo raspi-config nonint do_serial_hw 0
    next_step
    success "Serial configured successfully"

    # Download code
    inform "Downloading code"
    cd /home/"$user"/ || exit
    git clone https://github.com/isao-px/abraxas.git
    next_step
    mv /home/"$user"/abraxas/SYS/*.py /home/"$user"/
    mv /home/"$user"/abraxas/config.sql /home/"$user"/config.sql
    mv /home/"$user"/abraxas/auto_install.exp /home/"$user"/auto_install.exp
    rm -rf /home/"$user"/abraxas
    next_step
    success "Code downloaded successfully"

    # GPS
    inform "Installing GPS"
    cd /home/"$user"/ || exit
    python3 -m venv env --system-site-packages
    source env/bin/activate
    next_step
    pip3 install --upgrade adafruit-python-shell --break-system-packages --root-user-action=ignore
    next_step
    wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
    next_step
    sudo -E env PATH="$PATH" python3 raspi-blinka.py <<< "n"
    next_step
    pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
    next_step
    success "GPS installed successfully"

    # IMU
    inform "Installing ICM20948 IMU"
    cd /home/"$user"/ || exit
    git clone https://github.com/pimoroni/icm20948-python
    next_step
    mv /home/"$user"/auto_install.exp /home/"$user"/icm20948-python/auto_install.exp
    cd /home/"$user"/icm20948-python || exit
    chmod +x auto_install.exp
    ./auto_install.exp
    next_step
    pip3 install icm20948 --break-system-packages --root-user-action=ignore
    next_step
    success "ICM20948 IMU installed successfully"

    # Anemo
    inform "Installing Anemometer"
    cd /home/"$user"/ || exit
    # pip3 install pyserial --break-system-packages --root-user-action=ignore
    next_step
    success "Anemometer installed successfully"

    # DB
    inform "Initializing database"
    cd /home/"$user"/ || exit
    if [ -f /home/"$user"/sys.db ]; then
        inform "Database already exists, replacing it"
        rm /home/"$user"/sys.db
    fi
    next_step
    touch /home/"$user"/sys.db
    sqlite3 /home/"$user"/sys.db < config.sql
    chown user sys.db
    next_step
    success "Database initialized successfully"

	# Configuration of the server
	cd /home/"$user"/ || exit
	pip3 install paho-mqtt --break-system-packages --root-user-action
	next_step
	apt -y install mosquitto mosquitto-clients
	next_step
	systemctl start mosquitto
	systemctl enable mosquitto
	next_step
	
	mkdir server
	cd server
	next_step
	npm init -y
	next_step
	npm install express socket.io
	next_step
	npm install mqtt
	next_step
	cd /home/"$user"/ || exit
	success "Server successfully initialised"

    # Configuration of cron
    inform "Configuring cron"
    chmod +x /home/"$user"/interface.py
    touch /tmp/cron_config
    crontab -u "$user" -l > /tmp/cron_config
    echo "@reboot env/bin/python3 /home/$user/interface.py" >> /tmp/cron_config
	echo "@reboot node /home/$user/server/server.js" >> /tmp/cron_config
    next_step
    crontab -u "$user" /tmp/cron_config
    rm /tmp/cron_config
    echo "Current cron configuration for $user:"
    crontab -u "$user" -l
    next_step
    success "cron configured successfully"

    # Cleanup
    cd /home/"$user"/ || exit
    apt -y autoremove
    next_step
    rm /home/"$user"/config.sql
    rm /home/"$user"/config.sh
    rm /home/"$user"/raspi-blinka.py
    rm /home/"$user"/icm20948-python/auto_install.exp
    next_step
    success "Configuration script completed at $(date +%Y-%m-%d_%H:%M:%S)"
    inform "The Raspberry will reboot now"
}

user_check

inform "Installing progress bar script"
curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/main/progress_bar.sh
success "Progress bar script installed successfully"
source "progress_bar.sh"

inform "This might take a few minutes"
main > >(progress_bar::process "Configuring the Raspberry" 38) 2>&1
echo
echo
reboot
