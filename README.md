# BMW E39 M5 Cluster & Apex Dash for iDrive 7 / 8 (MGU)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: BMW MGU](https://img.shields.io/badge/Platform-BMW%20MGU%20(iDrive%207%2F8)-blue.svg)](#requirements)
[![Render: cluster--render](https://img.shields.io/badge/Renderer-cluster--render%20WebGL-orange.svg)](#renderer)
[![Created by: Marko DEV](https://img.shields.io/badge/Custom%20Dev-Marko%20DEV-red.svg)](#features)

Custom digital instrument cluster application for BMW Head Units running **iDrive 7 and iDrive 8 (MGU / MGU22)** via `cluster-render`. Features a faithful, high-definition recreation of the legendary **BMW E39 M5** instrument cluster alongside modern race and sport dash layouts (GT3, Apex, Circuit, Sprint).

---

## 📸 Screenshots & Startup Sequence

<p align="center">
  <img src="docs/images/e39-sweep.png" width="900" alt="E39 M5 5-Needle Sweep and Check Control Self-Test">
  <br><em>Phase 1: Synchronous 5-Needle Sweep, Bulb Self-Test, and OBC "CHECK CONTROL OK"</em>
</p>

<table align="center">
  <tr>
    <th align="center">Phase 2: /// M-POWER</th>
    <th align="center">Phase 3: Marko DEV Signature</th>
    <th align="center">Phase 4: Live Telemetry & 8-Speed DKG</th>
  </tr>
  <tr>
    <td><img src="docs/images/e39-mpower.png" width="300" alt="M-Power Boot Animation"></td>
    <td><img src="docs/images/e39-marko-dev.png" width="300" alt="Marko DEV Splash Screen"></td>
    <td><img src="docs/images/e39-live.png" width="300" alt="E39 M5 Live Cluster Driving View"></td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center">7- & 8-Speed Steptronic / DKG</th>
    <th align="center">5-Segment Service Indicator (SIA)</th>
  </tr>
  <tr>
    <td><img src="docs/images/e39-gear-display.png" width="350" alt="Inverted 8-Speed Gear Matrix"></td>
    <td><img src="docs/images/e39-service-indicator.png" width="350" alt="Authentic E39 Service Interval Bar"></td>
  </tr>
</table>

---

## ✨ Features

### 🏁 Authentic E39 M5 Instrument Cluster
- **Authentic Dial Geometry:** 300 km/h dual-scale speedometer, 8,000 RPM tachometer with iconic italic numerals, oil temperature gauge in lower tach, engine coolant, and fuel gauge.
- **Physical Needle Overlay (`z: 10`):** Dedicated shader pass draws needle pointers physically over the numerical dial markings, eliminating flat clipping.
- **Full Startup Needle Sweep & Self-Test (0.0s – 7.0s):**
  - **Phase 1 (0.0s – 2.6s):** Synchronous full-scale sweep of all 5 needles, rev limiter LED strobe, and initial bulb self-test.
  - **OBC Sequence:** 5x7 dot-matrix authentic amber display cycles: `CHECK` &rarr; `CONTROL` &rarr; `CHECK CONTROL OK`.
  - **Phase 2 (2.6s – 4.8s):** Needles settle at idle; OBC animates `>> /// M-POWER <<` pulsing text.
  - **Phase 3 (4.8s – 7.0s):** Centered `MARKO DEV` creator watermark in dot-matrix font.
  - **Phase 4 (7.0s+):** Seamless handoff into live telemetry cycling (Speed, Range, Engine Temp, Fuel Consumption, Odometer).
- **Steptronic / DKG 7- and 8-Speed Selector:**
  - Designed for modern 7-speed and 8-speed BMW transmissions (ZF 8HP / M DKG).
  - Clean `P R N D S M` gear matrix with inverted active gear block (`1 2 3 4 5 6 7 8`).
- **Dynamic LED Warm-Up Arch (Vorwarnfeld):**
  - Rev limit arch dynamically opens and closes between 4,000 RPM and 7,000 RPM depending on oil temperature, just like the real S62 engine.
- **Service-Interval Display (SIA):**
  - 5 green countdown blocks that decrease over time/mileage.
  - Yellow clock symbol and `OILSERVICE` / `INSPEKTION` banner when service is due; red indicator when overdue.
- **Day & Night Illumination:**
  - Classic daylight dials with glowing orange needles.
  - Ambient amber backlight night view triggered automatically via vehicle light sensor.

### 🏎️ Additional Dash Layouts
- **GT3:** Center-focused race layout with prominent gear, tach curve, and peripheral vitals.
- **Apex & Apex Red:** Modern digital layout with slanted rev bar, M tri-color branding, and shift scoring.
- **Circuit & Sprint:** Ring-based and twin-card layouts optimized for high-speed readability.

---

## ⚡ Performance & Hardware Budgets
Designed strictly within BMW MGU hardware limitations:
- **Max Drawing Layers:** 8 layers (2 effect passes, 6 dynamic texture sheets).
- **VRAM Allocation:** ~5.2 MiB (well below the 16 MiB MGU GPU limit).
- **Smooth 60 FPS:** Low-overhead fragment shaders with zero DOM garbage collection during rendering loops.

---

## 🛠️ Build & Installation

### Requirements
- Python 3.9+
- Node.js 18+ (for local bench testing)
- A BMW vehicle running **iDrive 7 (MGU)** with root SSH access or **MGU Store** installed, plus `cluster-render` by Robert Nisipeanu.

### Building the Package
To build the `.mgu` installable package:
```bash
python kit/tools/build.py apex_dash
```
The output package will be placed in `dist/apex_dash@1.2.0.mgu`.

### Local Simulation & Bench Testing
You can run and test the cluster directly on PC / Mac using the built-in software bench:
```bash
# 1. Start the bench server
node bench/server.js

# 2. Run the apex_dash simulator
node bench/run-app.js apex_dash
```
Open `http://localhost:18078/bench/page.html` in your browser (Google Chrome / Microsoft Edge) to view the live interactive cluster with real-time slider controls for RPM, Speed, Gear, and Temperature.

---

## 📁 Repository Structure
```
├── apps/
│   └── apex_dash/               # Apex Dash & E39 M5 cluster application
│       ├── app.json             # App manifest & settings
│       ├── main.js              # Runtime entry point
│       └── hud/
│           ├── fonts/           # Dot-matrix and dial glyph definitions
│           └── layouts/         # Layout JSONs (e39_m5.json, e39_m5_night.json, etc.)
├── bench/                       # Local headless testing server & simulator
├── design/                      # Layout generators and math scripts
├── docs/                        # Documentation and screenshot assets
├── kit/                         # MGU App Kit build system and packaging scripts
└── shared/
    ├── hud.js                   # HUD and cluster drawing engine & state machine
    ├── hud_themes.js            # Color schemes and palettes
    └── shaders.js               # WebGL shaders (needles, warm-up LEDs, dials)
```

---

## ⚖️ Legal Disclaimer & Trademark Notice

### Deutsch (Rechtlicher Hinweis)
> **WICHTIGER HINWEIS:**  
> Dieses Software-Projekt ist ein **inoffizielles, nicht-kommerzielles Fan- und Forschungsprojekt** von Enthusiasten für Enthusiasten.
> 
> 1. **Markenrechte:** Die Bezeichnungen „BMW“, „M“, „M-Power“, „M5“, „E39“, „iDrive“, „Steptronic“ sowie das BMW-Logo und das M-Streifen-Design sind eingetragene Marken der **Bayerische Motoren Werke AG (BMW AG)**. Dieses Projekt steht in keinerlei geschäftlicher Verbindung, Billigung, Partnerschaft oder Unterstützung durch die BMW AG. Alle genannten Markennamen dienen ausschließlich zur Identifikation der Kompatibilität und des visuellen Stils.
> 2. **Keine proprietären Binaries:** Dieses Repository enthält **keinen urheberrechtlich geschützten Original-Code**, keine internen BMW-Firmware-Dateien und keine proprietären BMW SDK-Bibliotheken. Der gesamte Render-Code, die Shader und Layouts wurden unabhängig im Rahmen von Clean-Room-Entwicklung / Interoperabilitätsforschung (§ 69e UrhG) erstellt.
> 3. **Haftungsausschluss & Straßenverkehr (StVZO):** Die Nutzung dieser Software erfolgt **vollständig auf eigene Gefahr**. Die Software ist ausschließlich für Show-, Diagnose-, Bildungs- und Rennstreckenzwecke (Off-Road) bestimmt. Sie ist **nicht für den öffentlichen Straßenverkehr (StVZO)** typgeprüft oder zugelassen. Der Entwickler übernimmt keinerlei Haftung für Fehlfunktionen, direkte oder indirekte Schäden am Fahrzeug, an elektronischen Steuergeräten (ECU/MGU) oder für das Erlöschen der Betriebserlaubnis oder Garantie.

### English (Disclaimer)
> **IMPORTANT NOTICE:**  
> This software repository is an **independent, non-commercial community and research project** developed by enthusiasts.
> 
> 1. **Trademarks:** "BMW", "M", "M-Power", "M5", "E39", "iDrive", "Steptronic", and the BMW propeller and M stripes emblems are registered trademarks of **Bayerische Motoren Werke AG (BMW AG)**. This project is not affiliated with, endorsed by, or associated with BMW AG in any way. All brand names and trademarks are used strictly for identification and compatibility purposes.
> 2. **Clean-Room Implementation:** This repository contains **no proprietary BMW binary code**, confidential firmware, or copyrighted software. All shaders, layout scripts, and telemetry logic are original, independent implementations created for interoperability research.
> 3. **Road Safety & Liability Disclaimer:** Use this software **entirely at your own risk**. This project is intended strictly for off-road, track, diagnostic, educational, or show use. It is **not certified for public road use**. The author accepts no responsibility or liability for any vehicle malfunctions, ECU/cluster damage, hardware faults, loss of warranty, or traffic violations resulting from the use of this code.

---

## 📜 Credits & License
- Custom E39 M5 Cluster & Start Sequence: **Marko DEV**
- Base MGU App Kit: [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps) (MIT License)
- Cluster Renderer: [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps) (MPL-2.0 License)
- Fonts: Barlow & Michroma (SIL Open Font License 1.1)

Project source code is released under the **[MIT License](LICENSE)**.
Third-party notices are detailed in [apps/apex_dash/NOTICE](apps/apex_dash/NOTICE).
