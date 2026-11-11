# E39 M5 Digital Cluster (Marko DEV)

Custom instrument cluster layout recreating the classic BMW E39 M5 gauge cluster for BMW iDrive 7 and 8 head units (MGU / MGU22) through `cluster-render`.

## Dashes

| Dash | Look |
|---|---|
| **E39 M5 Cluster** | Faithful daylight recreation of the BMW E39 M5 instrument cluster: dual 300 km/h speedometer and 8,000 RPM tachometer with italic numerals, oil temperature dial, coolant temperature, fuel gauge, dynamic 5-needle startup sweep self-test, Check Control OBC animation, dynamic LED warm-up arch (Vorwarnfeld), 5-segment Service-Interval display (SIA), and 7/8-speed Steptronic / DKG selector. |
| **E39 M5 Night Cluster** | Authentic night illumination featuring iconic BMW amber gauge backlighting, dimmed instrument faces, and illuminated fluorescent red/orange needles. |

## Startup Animation Sequence (0.0s – 7.0s)
1. **Phase 1 (0.0s – 2.6s):** Synchronous full-scale sweep of all 5 needles to maximum, rev-limiter LED flash, bulb self-test, full SIA green bars, and dot-matrix Check Control self-test (`CHECK` &rarr; `CONTROL` &rarr; `CHECK CONTROL OK`).
2. **Phase 2 (2.6s – 4.8s):** Needles return to idle; OBC animates `>> /// M-POWER <<` pulsing text.
3. **Phase 3 (4.8s – 7.0s):** OBC displays centered creator signature `MARKO DEV`.
4. **Phase 4 (7.0s+):** Transitions seamlessly to live telemetry (speed, fuel economy, coolant temp, oil temp, range, odometer).

## Transmission Matrix
Supports modern 7-speed and 8-speed BMW gearboxes (ZF 8HP / 7-Gang DKG) with a clear `P R N D S M` gear selector and inverted active gear indicator (`1 2 3 4 5 6 7 8`).

## Support the Creator
If you enjoy this custom design, you can support future development and updates:  
👉 **[Buy Me A Coffee: buymeacoffee.com/makiidrajf0](https://buymeacoffee.com/makiidrajf0)**
