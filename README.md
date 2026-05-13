# Abraxas
Lightweight and portable system developped to monitor inshore sailing training, aiming at improving performance by giving more ressource for the coaching.

## Documentation
For full documentation, read [Documentation.pdf](https://github.com/isao-px/Abraxas/blob/main/Documentation.pdf) (French)

## Hardwear
The full hardwear setup is described in the documentation, but for the instalation you'll only need a networked connected Raspberry Pi Zero 2 initialized with a decetly recent version of Raspberry Pi OS Lite (64-bit).

## Full install
You'll need to have Raspberry Pi OS Lite (64-bit) working on your Raspberry, on which the username is "user". The Raspberry has to be network connected.

First download the config.sh file, then make it executable and run it as root. Thw installation should start and be conducted entirely automaticaly.
```
cd /home/user
curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/main/config.sh
sudo chmod +x config.sh
sudo ./config.sh
```
If everything goes well, a few minutes later, the Raspberry will reboot, and you should have a cleaned up, ready to use system.
