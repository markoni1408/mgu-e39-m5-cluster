# BMW E39 M5 Digital Cluster for iDrive 7 / 8 (MGU)

<p align="center">
  <a href="https://buymeacoffee.com/makiidrajf0" target="_blank">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Marko%20DEV-orange.svg?style=for-the-badge&logo=buy-me-a-coffee" alt="Buy Me A Coffee">
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Platform-BMW%20MGU%20(iDrive%207%2F8)-blue.svg?style=for-the-badge" alt="Platform: BMW MGU">
  &nbsp;
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License: MIT">
</p>

<h3 align="center">
  Entwickelt mit Leidenschaft von <strong>Marko DEV</strong>
</h3>

<p align="center">
  Eine detailgetreue, hochauflösende digitale Nachbildung des legendären <strong>BMW E39 M5 Kombiinstruments</strong> für moderne BMW Head Units mit <strong>iDrive 7 und iDrive 8 (MGU / MGU22)</strong> über <code>cluster-render</code>.
</p>

---

## ☕ Unterstütze meine Arbeit / Buy Me a Coffee

Dieses Design und die gesamte Entwicklungsarbeit wurden mit viel Liebe zum Detail in unzähligen Stunden auf die Beine gestellt. Wenn dir mein E39 M5 Tacho-Design gefällt und du zukünftige Updates, Optimierungen und neue Features unterstützen möchtest, freue ich mich riesig über deine Unterstützung:

👉 **[https://buymeacoffee.com/makiidrajf0](https://buymeacoffee.com/makiidrajf0)**

<p align="center">
  <a href="https://buymeacoffee.com/makiidrajf0" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="220">
  </a>
</p>

*Vielen Dank für jeden Support – es hilft mir enorm, weiterhin eigenständige Custom-Designs für die Community bereitzustellen!*

---

## 📸 Screenshots & Animations-Phasen

<p align="center">
  <img src="docs/images/e39-sweep.png" width="920" alt="E39 M5 5-Nadel Sweep und Check Control Nadeltest">
  <br>
  <em>Phase 1: Synchroner 5-Nadel Sweep bis zum Anschlag, Lampentest und Check Control "OK"</em>
</p>

<table align="center">
  <tr>
    <th align="center">Phase 2: /// M-POWER</th>
    <th align="center">Phase 3: Marko DEV Signature</th>
    <th align="center">Phase 4: Live-Fahrbetrieb & 8-Gang DKG</th>
  </tr>
  <tr>
    <td><img src="docs/images/e39-mpower.png" width="300" alt="M-Power Boot-Animation"></td>
    <td><img src="docs/images/e39-marko-dev.png" width="300" alt="Marko DEV Boot-Screen"></td>
    <td><img src="docs/images/e39-live.png" width="300" alt="Live Telemetrie Ansicht"></td>
  </tr>
</table>

<table align="center">
  <tr>
    <th align="center">7- & 8-Gang Steptronic / DKG Inversions-Display</th>
    <th align="center">5-Segment Service-Intervall-Anzeige (SIA)</th>
  </tr>
  <tr>
    <td><img src="docs/images/e39-gear-display.png" width="350" alt="Steptronic 8-Gang Anzeige"></td>
    <td><img src="docs/images/e39-service-indicator.png" width="350" alt="Originalgetreue E39 Serviceanzeige"></td>
  </tr>
</table>

---

## 🙏 Danksagung & Inspirationen

Ein Projekt wie dieses entsteht nicht im luftleeren Raum. Ich möchte mich an dieser Stelle ganz herzlich bei allen Pionieren und Entwicklern der Open-Source-Community bedanken, an deren großartiger Vorarbeit wir uns orientieren durften:

1. **Dem BMW E39 M5 Original-Cockpit (BMW M GmbH):**  
   Das zeitlose analoge Cockpit des E39 M5 (S62) mit seinen weißen Ziffern, kursiven Skalenbeschriftungen, orangen Nadeln, dem LED-Vorwarnfeld und dem warmen bernsteinfarbenen Nacht-Glühen war und bleibt die ultimative visuelle Inspiration.
2. **[cauliflowermossgrape](https://github.com/cauliflowermossgrape/idrive7-apps):**  
   Für das **MGU App Kit** und die saubere Anbindung an die MGU-Lifecycle- und CDS-Fahrzeugsignale.
3. **[Robert Nisipeanu](https://github.com/robertnisipeanu/idrive-apps):**  
   Für **`cluster-render`** und den nativen WebGL-Client, der es überhaupt erst möglich macht, eigene Grafiken und Shader flüssig direkt auf das Kombiinstrument des Fahrzeugs zu rendern.
4. **Der Car-Hacking- & BMW-Community:**  
   Vielen Dank an alle Enthusiasten und Tester, die Feedback gegeben und das Testen auf echten Head Units begleitet haben!

---

## 🛠️ Wie wir das Ganze aufgebaut haben (Architektur & Engineering)

Dieses Kombiinstrument wurde von Grund auf so konstruiert, dass es maximale optische Authentizität mit den strikten Hardware- und Performance-Grenzen der BMW MGU vereint:

### 1. Mathematische Zeigergeometrie & Physischer Overlay-Shader (`z: 10`)
* **5 Analoge Nadeln:** Tacho (300 km/h), Drehzahlmesser (8.000 U/min), Öltemperatur (°C), Kühlwassertemperatur und Tankanzeige.
* **Zeiger über den Zahlen:** Bei einfachen 2D-Flächen werden Zeiger oft unschön von Ziffern oder Beschriftungen überdeckt. Wir haben in [`shared/shaders.js`](file:///C:/Users/Lenovo%202024/orca/workspaces/test-bmw-mgu2/test-bmw-mgu-infos-repos/shared/shaders.js) einen separaten physikalischen Shader-Overlay-Pass auf Layer `z: 10` implementiert. Dadurch gleiten alle 5 Nadeln physikalisch **über** den Skalenzahlen.

### 2. Die 4-Phasen Start-Animations-Sequenz (Nadeltest)
Beim Starten der Zündung durchläuft das Kombiinstrument eine realistische Selbsttest-Sequenz (0,0 s – 7,0 s) in [`shared/hud.js`](file:///C:/Users/Lenovo%202024/orca/workspaces/test-bmw-mgu2/test-bmw-mgu-infos-repos/shared/hud.js):
* **Phase 1 (0,0 – 2,6 s):** Alle 5 Nadeln vollziehen synchron einen weichen Sweep bis zum maximalen Skalenanschlag und zurück. Gleichzeitig blinkt das rote Drehzahlbegrenzer-Band auf, alle Kontrolllampen leuchten auf und das Service-Intervall zeigt volle 5 grüne Balken. Im Bordcomputer (OBC) läuft die Check-Control-Diagnose: `CHECK` &rarr; `CONTROL` &rarr; `CHECK CONTROL OK`.
* **Phase 2 (2,6 – 4,8 s):** Die Nadeln fallen auf die Leerlaufposition zurück. Das OBC-Display blendet die pulsierende Signatur `>> /// M-POWER <<` ein.
* **Phase 3 (4,8 – 7,0 s):** Im OBC-Display erscheint zentriert das Entwickler-Branding `MARKO DEV` in nativer Punktmatrix.
* **Phase 4 (ab 7,0 s):** Nahtloser Wechsel in die Live-Fahrtelemetrie (Geschwindigkeit, Reichweite, Durchschnittsverbrauch, Motortemperaturen, Tageskilometerzähler).

### 3. Dynamisches LED-Vorwarnfeld (LED-Drehzahlband)
* Wie beim echten BMW M5 wandert das gelbe und rote LED-Vorwarnband im Drehzahlmesser abhängig von der realen Motoröltemperatur dynamisch zwischen 4.000 U/min (kalter Motor) und 7.000 U/min (betriebswarmer Motor).

### 4. 7- & 8-Gang Steptronic / DKG Matrix (ZF 8HP)
* Da die meisten modernen Fahrzeuge 7- oder 8-Gang-Getriebe besitzen, wurde das klassische E39-Gitter (`P R N D S M`) erweitert.
* Über eine zweistufige Render-Logik (Hintergrund-String `12345678` auf `z: 6` und aktiver Inversions-Block mit inverser schwarzer Schrift auf `z: 7`) werden Geisterzahlen und Doppelbelichtungen vollständig verhindert.

### 5. 5-Segment Service-Intervall-Anzeige (SIA)
* Nachbildung des BMW Service-Systems mit 5 grünen Leuchtbalken, die mit zunehmender Fahrleistung abnehmen.
* Bei Erreichen des Intervalls leuchten das gelbe Uhrensymbol und der `OILSERVICE`- bzw. `INSPEKTION`-Schriftzug auf; bei Überziehung schaltet die Anzeige auf das rote Warnquadrat.

### 6. Hardware-Budget & 60 FPS Performance
* **Layer-Budget:** Exakt 8 Layer (2 Effect Passes, 6 dynamic Texture Sheets) – exakt innerhalb des MGU-Grenzwerts.
* **VRAM-Footprint:** Nur ca. 5,2 MiB VRAM (deutlich unter dem 16 MiB MGU-Limit).
* **Flüssiges Rendering:** Null Garbage-Collection im Renderloop garantiert ruckelfreie 60 Bilder pro Sekunde.

---

## 💻 Lokales Testen im Simulator (Software Bench)

Du kannst das Design direkt auf deinem PC oder Mac im Browser ohne Auto testen:

```bash
# 1. Bench Server starten
node bench/server.js

# 2. Simulator-Instanz starten
node bench/run-app.js apex_dash
```

Öffne anschließend **`http://localhost:18078/bench/page.html`** in Google Chrome oder Microsoft Edge. Dort kannst du mit Live-Schiebereglern für Drehzahl, Geschwindigkeit, Gänge (1 bis 8) und Temperaturen das gesamte Tacho interaktiv steuern.

---

## 📦 Paket für das Auto bauen

Das fertige `.mgu`-Installationspaket für den MGU Store oder die SSH-Installation baust du mit:

```bash
python kit/tools/build.py apex_dash
```

Das Paket wird automatisch in `dist/apex_dash@1.2.0.mgu` abgelegt.

---

## ⚖️ Rechtlicher Hinweis & Disclaimer

### Deutsch
> **WICHTIGER HINWEIS:**  
> Dieses Software-Projekt ist ein **inoffizielles, nicht-kommerzielles Fan- und Forschungsprojekt von Marko DEV**.
> 
> 1. **Markenrechte:** Die Bezeichnungen „BMW“, „M“, „M-Power“, „M5“, „E39“, „iDrive“, „Steptronic“ sowie das BMW-Logo und das M-Streifen-Design sind eingetragene Marken der **Bayerische Motoren Werke AG (BMW AG)** bzw. der **BMW M GmbH**. Dieses Projekt steht in **keinerlei geschäftlicher Verbindung, Partnerschaft oder Unterstützung durch die BMW AG**. Alle genannten Markennamen dienen ausschließlich zur Identifikation und Beschreibung der visuellen Ästhetik.
> 2. **Kein BMW-Proprietärcode:** Dieses Repository enthält **keinen urheberrechtlich geschützten BMW-Originalcode**, keine internen BMW-Firmware-Dateien und keine proprietären BMW SDKs. Alle Shader, Layouts und Skripte wurden eigenständig im Rahmen von Clean-Room-Entwicklung / Interoperabilität (§ 69e UrhG) geschrieben.
> 3. **Haftungsausschluss (StVZO):** Die Nutzung dieser Software erfolgt **vollständig auf eigene Gefahr**. Die Software ist ausschließlich für Show-, Diagnose-, Bildungs- und Rennstreckenzwecke (Off-Road) bestimmt. Sie ist **nicht für den öffentlichen Straßenverkehr (StVZO) zugelassen**. Der Entwickler übernimmt keinerlei Haftung für Fehlfunktionen, Schäden am Fahrzeug oder an Steuergeräten sowie für das Erlöschen von Garantie oder Betriebserlaubnis.

### English
> **IMPORTANT NOTICE:**  
> This software repository is an **independent, non-commercial community project by Marko DEV**.
> 
> 1. **Trademarks:** "BMW", "M", "M-Power", "M5", "E39", "iDrive", "Steptronic", and the BMW roundel and M tri-color emblems are registered trademarks of **Bayerische Motoren Werke AG (BMW AG)** and **BMW M GmbH**. This project is not affiliated with, endorsed by, or sponsored by BMW AG. All trademarks are used solely for identification and stylistic reference.
> 2. **Clean-Room Code:** This repository contains **no proprietary BMW binary code**, private certificates, or internal BMW firmware. All render passes, shaders, and layout logic are original implementations created for interoperability research.
> 3. **Road Safety & Liability Disclaimer:** Use this software **entirely at your own risk**. This project is intended strictly for off-road, track, diagnostic, educational, or exhibition purposes. It is **not certified for public road use**. The author accepts no liability for vehicle damage, hardware faults, ECU failure, warranty invalidation, or traffic penalties.

---

## 📜 Lizenz & Credits

- **E39 M5 Cluster Design & Start Sequence:** **Marko DEV**
- **Kaffee-Spende:** [https://buymeacoffee.com/makiidrajf0](https://buymeacoffee.com/makiidrajf0)
- **MGU App Kit:** [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps) (MIT License)
- **Cluster Renderer:** [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps) (MPL-2.0 License)
- **Typografie:** Barlow, Michroma & Orbitron (SIL Open Font License 1.1)

Der eigene Code dieses Projekts ist unter der **[MIT License](LICENSE)** lizenziert.
