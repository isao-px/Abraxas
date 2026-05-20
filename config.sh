#!/bin/bash

success() {
	echo -e "$(tput setaf 2)$1$(tput sgr0)"
}

info() {
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

counter=0
next_step() {
    counter=$((counter + 1))
    echo "Progress=$counter"
}

main() {
    info "Starting configuration script at $(date +%Y-%m-%d_%H:%M:%S)"

    # Détermination de l'utilisateur
    user=$(ls /home | head -n 1)
    next_step

    # Installations générales
    apt-get update
    next_step
    apt-get -y upgrade
    next_step
    apt -y install tree
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

    # pip3 install time --break-system-packages --root-user-action=ignore
    # next_step
    pip3 install RPi.GPIO --break-system-packages --root-user-action=ignore
    next_step

    # raspiconfig

    # IMU
    info "Installing ICM20948 IMU"
    apt -y install git
    next_step
    cd /home/"$user"/ || exit
    git clone https://github.com/pimoroni/icm20948-python
    next_step
    cd /home/"$user"/icm20948-python || exit
    ./install.sh
    next_step
    pip3 install icm20948 --break-system-packages --root-user-action=ignore
    success "ICM20948 IMU installed successfully"
    next_step

    # GPS
    info "Installing GPS"
    cd /home/"$user"/ || exit
    apt -y install --upgrade python3-setuptools
    next_step
    apt -y install python3-venv
    next_step
    python3 -m venv env --system-site-packages
    source env/bin/activate
    next_step
    pip3 install --upgrade adafruit-python-shell --break-system-packages --root-user-action=ignore
    next_step
    wget https://raw.githubusercontent.com/adafruit/Raspberry-Pi-Installer-Scripts/master/raspi-blinka.py
    sudo -E venv PATH="$PATH" python3 raspi-blinka.py
    next_step
    pip3 install adafruit-circuitpython-gps --break-system-packages --root-user-action=ignore
    success "GPS installed successfully"
    next_step

    # Download code
    info "Downloading code"
    cd /home/"$user"/ || exit
    git clone https://github.com/isao-px/abraxas.git
    next_step
    mv /home/"$user"/abraxas/SYS/*.py /home/"$user"/
    mv /home/"$user"/abraxas/config.sql /home/"$user"/config.sql
    next_step
    rm -rf /home/"$user"/abraxas
    success "Code downloaded successfully"
    next_step

    # DB
    info "Initializing database"
    cd /home/"$user"/ || exit
    if [ -f /home/"$user"/sys.db ]; then
        echo "Database already exists, replacing it"
        rm /home/"$user"/sys.db
    fi
    touch /home/"$user"/sys.db
    next_step
    sqlite3 /home/"$user"/sys.db < config.sql
    success "Database initialized successfully"
    next_step

    # Configuration of cron
    info "Configuring cron"
    chmod +x /home/"$user"/interface.py
    next_step
    touch /tmp/cron_config
    crontab -u "$user" -l > /tmp/cron_config
    echo "@reboot python3 /home/$user/interface.py" >> /tmp/cron_config
    next_step
    crontab -u "$user" /tmp/cron_config
    rm /tmp/cron_config
    echo "Current cron configuration for $user:"
    crontab -u "$user" -l
    success "cron configured successfully"
    next_step

    # Cleanup
    cd /home/"$user"/ || exit
    apt -y autoremove
    next_step
    rm /home/"$user"/config.sql
    rm /home/"$user"/config.sh
    success "Configuration script completed at $(date +%Y-%m-%d_%H:%M:%S)"
    info "The Raspberry will reboot now"
    next_step
}

user_check

curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/proper-installation-project/progress_bar.sh
source "progress_bar.sh"

main > >(progress_bar::process "Configuring the Raspberry" 30)
reboot
