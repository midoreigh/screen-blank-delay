# Screen Blank Delay (GNOME Shell Extension)

[![GNOME Shell 45-50](https://img.shields.io/badge/GNOME%20Shell-45%20%7C%2046%20%7C%2047%20%7C%2048%20%7C%2049%20%7C%2050-blue.svg)](https://extensions.gnome.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A powerful, elegant GNOME Shell extension that lets you quickly select and customize your screen blank delay directly from the **Quick Settings menu** or the **Top Bar panel**, with independent **multi-monitor delay support**.

---

## ✨ Features

- ⚡ **Quick Settings Integration**: Easily change idle screen blank delay directly from the modern GNOME Quick Settings menu.
- 🕒 **One-Click Awake / Sleep Toggle**: Click the quick toggle button to instantly switch between keeping your screen awake (*Never*) and your preferred timeout.
- 🖥️ **Per-Monitor / Multi-Screen Delay Support**: Set individual blank timeouts for each connected monitor (e.g., have your secondary monitor blank after 3 minutes while keeping your main monitor on for 15 minutes).
- 🖱️ **Smart Pointer Wakeup**: Blanked secondary monitors wake up instantly as soon as your mouse cursor moves over them.
- 🎨 **Smooth Fade Transitions**: OLED and eye-friendly smooth fade transitions when blanking or waking displays.
- 📍 **Top Bar Indicator Option**: Choose whether to display in Quick Settings, Top Bar, or both.
- ⏱️ **Blank Now Action**: Instant "Blank Screen Now" for individual monitors or all screens.
- ⚙️ **Synchronized with GNOME Settings**: Changes are bidirectional and stay perfectly in sync with GNOME's built-in Power settings (`org.gnome.desktop.session idle-delay`).
- 🌐 **Modern & Standard Compliant**: Built strictly following GNOME Extensions review guidelines with ESM modules, Libadwaita preferences, GSettings schemas, and clean lifecycle cleanup.

---

## 💻 Compatibility

- **GNOME Shell**: 45, 46, 47, 48, 49, 50+
- **Display Servers**: Wayland and X11
- **Architectures**: x86_64, aarch64

---

## 🚀 Installation

### Option 1: From GNOME Extensions Store (Recommended)

*Coming soon on [extensions.gnome.org](https://extensions.gnome.org).*

### Option 2: Local Installation from Source

Clone this repository and run:

```bash
git clone https://github.com/midoreigh/screen-blank-delay.git
cd screen-blank-delay
make install
```

Then enable the extension:

```bash
gnome-extensions enable screen-blank-delay@midoreigh
```

*(On Wayland, log out and log back in or restart GNOME Shell if required for new extensions to register).*

---

## 🛠️ Configuration & Preferences

Open the extension preferences with:

```bash
gnome-extensions prefs screen-blank-delay@midoreigh
```

Or via the **Extensions** application / **Extension Settings…** in the Quick Settings menu.

### Available Settings:
- **Menu Visibility**:
  - Show in Quick Settings menu
  - Show in Top Bar panel
- **Screen Blank Behavior**:
  - Default global idle delay (1m, 2m, 3m, 5m, 8m, 10m, 12m, 15m, 30m, 1h, Never)
  - Smooth fade transition toggle
  - Wake screen on pointer hover toggle
- **Per-Screen Delay**:
  - Enable/disable per-monitor timeouts
  - Individual delay selection for each connected display (Follow System, 1m, 2m, 3m, 5m, 10m, 15m, 30m, 1h, Never)

---

## 📦 Building & Packaging

To create an extension zip archive for uploading to [extensions.gnome.org](https://extensions.gnome.org):

```bash
make package
```

This generates `screen-blank-delay@midoreigh.shell-extension.zip`.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0) - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

Developed by **midoreigh** (<midoreigh@gmail.com>).
Contributions, bug reports, and suggestions are welcome via GitHub Issues and Pull Requests!
