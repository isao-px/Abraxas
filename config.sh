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
    inform "Starting configuration script at $(date +%Y-%m-%d_%H:%M:%S)"

    # Détermination de l'utilisateur
    user=$(ls /home | head -n 1)

    # Installations générales
    inform "Updating and installing packages"
    apt-get update
    apt-get -y upgrade
    apt -y install tree
    apt -y install git
    apt -y install python3-pip
    apt -y install python3-full
    apt -y install python3-venv
    apt -y install sqlite3
    apt -y install python3-colorlog
    apt -y install expect
    success "General packages installed successfully"

    pip3 install RPi.GPIO --break-system-packages --root-user-action=ignore

    # Download code
    inform "Downloading code"
    cd /home/"$user"/ || exit
    git clone https://github.com/isao-px/abraxas.git
    mv /home/"$user"/abraxas/SYS/*.py /home/"$user"/
    mv /home/"$user"/abraxas/config.sql /home/"$user"/config.sql
    mv /home/"$user"/abraxas/auto_install.exp /home/"$user"/auto_install.exp
    rm -rf /home/"$user"/abraxas
    success "Code downloaded successfully"

    # GPS
    inform "Installing GPS"
    cd /home/"$user"/ || exit
    apt -y install --upgrade python3-setuptools
    apt -y install python3-venv
    python3 -m venv env --system-site-packages
    source env/bin/activate
    pip3 install --upgrade adafruit-python-shell --break-system-packages --root-user-action=ignore
    wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
    sudo -E env PATH="$PATH" python3 raspi-blinka.py <<< "n"
    pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
    success "GPS installed successfully"

    # IMU
    inform "Installing ICM20948 IMU"
    cd /home/"$user"/ || exit
    git clone https://github.com/pimoroni/icm20948-python
    mv /home/"$user"/auto_install.exp /home/"$user"/icm20948-python/auto_install.exp
    cd /home/"$user"/icm20948-python || exit
    chmod +x auto_install.exp
    ./auto_install.exp
    pip3 install icm20948 --break-system-packages --root-user-action=ignore
    success "ICM20948 IMU installed successfully"

    # DB
    inform "Initializing database"
    cd /home/"$user"/ || exit
    if [ -f /home/"$user"/sys.db ]; then
        inform "Database already exists, replacing it"
        rm /home/"$user"/sys.db
    fi
    touch /home/"$user"/sys.db
    sqlite3 /home/"$user"/sys.db < config.sql
    success "Database initialized successfully"

    # Configuration of cron
    inform "Configuring cron"
    chmod +x /home/"$user"/interface.py
    touch /tmp/cron_config
    crontab -u "$user" -l > /tmp/cron_config
    echo "@reboot python3 /home/$user/interface.py" >> /tmp/cron_config
    crontab -u "$user" /tmp/cron_config
    rm /tmp/cron_config
    echo "Current cron configuration for $user:"
    crontab -u "$user" -l
    success "cron configured successfully"

    # Cleanup
    cd /home/"$user"/ || exit
    apt -y autoremove
    rm /home/"$user"/config.sql
    rm /home/"$user"/config.sh
    rm /home/"$user"/raspi-blinka.py
    rm /home/"$user"/icm20948-python/auto_install.exp
    success "Configuration script completed at $(date +%Y-%m-%d_%H:%M:%S)"
    inform "The Raspberry will reboot now"
}

user_check

inform "Installing progress bar script"
curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/proper-installation-project/progress_bar.sh
progress "Progress bar script installed successfully"
source "progress_bar.sh"

main > >(progress_bar::process "Configuring the Raspberry" 30) 2>&1
reboot
