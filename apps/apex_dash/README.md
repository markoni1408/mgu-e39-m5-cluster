# Apex Dash

Redraws the instrument cluster through cluster-render. Seven dashes:

| Dash | Look |
|---|---|
| **E39 M5** | Authentic recreation of the iconic BMW E39 M5 instrument cluster. Dual-speedometer (300 km/h) & tachometer (8000 rpm) analog dial layout, synchronous 5-needle startup sweep self-test, Check Control OBC dot-matrix display (`CHECK` -> `CONTROL` -> `OK` -> `/// M-POWER` -> `MARKO DEV`), physical needle overlay over numbers, 5-segment Service-Interval display (SIA), warm-up LED band, and 7/8-speed Steptronic / DKG selector |
| **E39 M5 Night** | Authentic night view with amber gauge backlight illumination, glowing red needles, and dimmed background |
| **GT3** | The Cluster Themes GT3 dash, with the speed big in the middle card and the gear at the left, water and oil moved clear of BMW's warning strip |
| **Apex** | Gear and speed big across the top, rpm / oil / water cards left, boost / shift point / clock right, rev bar and last-shift grade below |
| **Apex Red** | Apex with a slanted race rev bar and the M tricolour stripe |
| **Circuit** | Rev ring and speed ring at the sides, the gear big in the middle, oil / water / boost cells under it |
| **Sprint** | Speed big on the left, gear big on the right, slanted rev bar and rpm up top |
| **M**, **Sport** | The two other dashes from Cluster Themes, unchanged (not yet tried on a car, per that app's notes) |

Shift lights, shift scoring and the cold-engine rev guard work as in Cluster Themes. New in 1.2:

- **Fuel %** replaces the boost readout in every dash (the tank size is `tankLitres` in app.json, 68 for a G30).
- **Warning colours:** oil past 125 °C, water past 112 °C and fuel under 15 % turn red. Any text item can do this with `"warn": {"signal": "coolant", "above": 112}`.
- **SHIFT** flashes red either side of the shift lights at the shift point, and the drive mode (COMFORT, SPORT ...) is written above the left side.
- **By drive mode** is on by default: Comfort uses Apex, Sport uses Sprint, Eco Pro uses Circuit. Change it in the settings.

## Clock

The clock follows the setting **Clock time zone** (default UTC+3, Iraq). "Unit clock" shows what the head unit's own clock says. If the time is still off, change that setting on the center screen until it matches the car.

## Placement

Apex, Apex Red, Circuit and Sprint keep clear of what BMW paints over the cluster: the black box over the middle (nothing big between y 300 and 420 there), the warning strip at the bottom centre (nothing below y 585 between x 570 and 1150), and the hood over the top corners. BMW's own warning lights stay visible; the app never hides them.

## Install

Use one cluster app at a time: cluster-render has a single screen slot. Set **Cluster Themes** to Off (or remove it) before using Apex Dash. Needs **cluster-render** from the `robertnisipeanu/idrive-apps` Store source.

## Changing a dash

Each dash is a file in `hud/layouts/` (`gt3.json`, `apex.json`, `apex_red.json`, `circuit.json`, `sprint.json`). Open it in any text editor; every item has `x`, `y`, `w`, `h` (pixels on the 1920 x 720 screen), `text` (what it shows), `font` and `color`. Colours come from the theme in `shared/hud_themes.js` (`accent`, `fg`, `dim`, `line`). `design/gen_apex_layouts.py` regenerates Apex, Apex Red, Circuit and Sprint from a few numbers. To try a change without rebuilding, copy the edited file to the app's `data/layouts/` folder on the unit; the app reloads it by itself.

Built on bimmer-lab/apps (MIT) and the MGU App Kit (MIT). See NOTICE.
