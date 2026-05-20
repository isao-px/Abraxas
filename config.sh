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
		info "User check passed, running as $(whoami)"
	else
		fatal "Script should be running as root. Try 'sudo ./config.sh'"
	fi
}

main() {
    info "Starting configuration script at $(date +%Y-%m-%d_%H:%M:%S)"

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

    pip3 install time --break-system-packages --root-user-action=ignore
    pip3 install RPi.GPIO --break-system-packages --root-user-action=ignore

    # raspiconfig

    # IMU
    info "Installing ICM20948 IMU"
    apt -y install git
    cd /home/"$user"/ || exit
    git clone https://github.com/pimoroni/icm20948-python
    cd /home/"$user"/icm20948-python || exit
    ./install.sh
    pip3 install icm20948 --break-system-packages --root-user-action=ignore
    success "ICM20948 IMU installed successfully"

    # GPS
    info "Installing GPS"
    cd /home/"$user"/ || exit
    apt -y install --upgrade python3-setuptools
    apt -y install python3-venv
    python3 -m venv env --system-site-packages
    source env/bin/activate
    pip3 install --upgrade adafruit-python-shell --break-system-packages --root-user-action=ignore
    wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
    sudo -E venv PATH="$PATH" python3 raspi-blinka.py
    pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
    success "GPS installed successfully"

    # Download code
    info "Downloading code"
    cd /home/"$user"/ || exit
    git clone https://github.com/isao-px/abraxas.git
    mv /home/"$user"/abraxas/SYS/*.py /home/"$user"/
    mv /home/"$user"/abraxas/config.sql /home/"$user"/config.sql
    rm -rf /home/"$user"/abraxas
    success "Code downloaded successfully"

    # DB
    info "Initializing database"
    cd /home/"$user"/ || exit
    if [ -f /home/"$user"/sys.db ]; then
        echo "Database already exists, replacing it"
        rm /home/"$user"/sys.db
    fi
    touch /home/"$user"/sys.db
    sqlite3 /home/"$user"/sys.db < config.sql
    success "Database initialized successfully"

    # Configuration of cron
    info "Configuring cron"
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
    success "Configuration script completed at $(date +%Y-%m-%d_%H:%M:%S)"
    info "The Raspberry will reboot now"
}

source "progress_bar.sh"

user_check
main > >(progress_bar::process "Doing some stuff" 50)
reboot
