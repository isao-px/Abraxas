# Abraxas
Lightweight and portable system developed to monitor inshore sailing training, aiming at improving performance by providing no-nonsense resources for the coaching.

## Documentation
For full documentation and project description, read :
| PDF      | Typst    |
|:-------- |:-------- |
|[Abraxas - Documentation.pdf](https://kdrive.infomaniak.com/2/app/136914/share/3886bf72-c4e0-4f9a-8e1f-7bd9e311ac93/files/294825/download) (French)|[Abraxas - Documentation.typ](https://github.com/isao-px/Abraxas_typst/blob/main/main_fr.typ) (French)|
|[Abraxas - Documentation.pdf](https://kdrive.infomaniak.com/2/app/136914/share/b201cae0-3f2e-4263-b3e3-23ac7567736a/files/295061/download) (English)|[Abraxas - Documentation.typ](https://github.com/isao-px/Abraxas_typst/blob/main/main_en.typ) (English)|

## Hardware
The full hardware setup is described in the documentation, but for the installation you'll only need a network connected Raspberry Pi Zero or a Raspberry Pi Zero 2.

## Installation with Abraxas OS (recommended)
If you have a Raspberry Pi Zero or a Raspberry Pi Zero 2 with a blank SD card and you don't want to go through a long lasting initialization process, this one is for you.

You can get an image of a fully set up version of Raspberry Pi OS Lite for Abraxas. You only have to flash it to your SD card, insert it in your Raspberry, and your Abraxas will be operational since the first boot without any further configuration.

- [Abraxas OS for Raspberry Pi Zero](https://kdrive.infomaniak.com/2/app/136914/share/12fb5b5c-fca6-4178-a3ab-39abaff42644/files/295125/download)
- [Abraxas OS for Raspberry Pi Zero 2](https://kdrive.infomaniak.com/2/app/136914/share/683f44f9-902b-4258-8ae8-b9af6a489d83/files/295128/download)

## Full install

> ### Disclaimer
> Please pay attention to the fact that the installation shall only be conducted as root. As it runs system-wide, it is very likely that every other previous installation, depedencies on the Raspberry may be corrupted. Furthermore, the installation provides no security against file replacement, so previous work saved on the Raspberry might very well disappear without warning. Therefore, **it is highly recommended to run the installation only on an empty system.**

To proceed with the installation, you'll need to have a decently recent version of [Raspberry Pi OS Lite (64-bit)](https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-04-21/2026-04-21-raspios-trixie-arm64-lite.img.xz) running on your Raspberry. The Raspberry has to be network connected. To install the OS, it's recommended to use [Raspberry Pi Imager](https://www.raspberrypi.com/software/).

First, download the config.sh file, then make it executable and run it as root. The installation should start and be conducted entirely automatically.
```
cd
curl -LO https://raw.githubusercontent.com/isao-px/Abraxas/refs/heads/main/config.sh
sudo chmod +x config.sh
sudo ./config.sh
```
If everything goes well, a few minutes later, the Raspberry will reboot, and you should have a cleaned up, ready to use system.

## Related repositories
- [Abraxas - server](https://github.com/isao-px/Abraxas_server)
- [Abraxas - 3D files](https://github.com/isao-px/Abraxas_3D-files)
- [Abraxas - PCB](https://github.com/isao-px/Abraxas_PCB)
- [Abraxas - Typst](https://github.com/isao-px/Abraxas_typst)
