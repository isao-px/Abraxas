# Abraxas
Lightweight and portable system developed to monitor inshore sailing training, aiming at improving performance by giving more resource for the coaching.

## Documentation
For full documentation, read [Documentation.pdf](https://github.com/isao-px/Abraxas/blob/main/Documentation.pdf) (French)

## Hardware
The full hardware setup is described in the documentation, but for the installation you'll only need a network connected Raspberry Pi Zero 2 initialized with a decently recent version of [Raspberry Pi OS Lite (64-bit)](https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-04-21/2026-04-21-raspios-trixie-arm64-lite.img.xz).

## Full install

### Disclaimer
Please pay attention to the fact that the installation shall only be conducted as root. As it runs system-wide, it is very likely that every other previous installation, depedencies on the Raspberry may be corrupted. Furthermore, the installation provides no security against file replacement, so previous work saved on the Raspberry might very well disappear without warning. Therefore, **it is highly recommended to run the installation only on an empty system.**

To proceed with the installation, you'll need to have [Raspberry Pi OS Lite (64-bit)](https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-04-21/2026-04-21-raspios-trixie-arm64-lite.img.xz) working on your Raspberry. The Raspberry has to be network connected. To install the OS, it's recommended to use [Raspberry Pi Imager](https://www.raspberrypi.com/software/).

First, download the config.sh file, then make it executable and run it as root. The installation should start and be conducted entirely automatically.
```
cd
curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/main/config.sh
sudo chmod +x config.sh
sudo ./config.sh
```
If everything goes well, a few minutes later, the Raspberry will reboot, and you should have a cleaned up, ready to use system.
