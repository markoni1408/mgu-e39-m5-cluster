'use strict';
/**
 * HUD colour themes. Layouts name colour *roles* ("fg", "dim", "arc", ...) and
 * the active theme fills them in, so every layout works in every theme.
 *
 * Colours are [r, g, b, a] 0-255. On the HUD, black is see-through glass, so a
 * theme only ever adds light. Dark blue is the weakest colour on a HUD in sun;
 * M's mid blue is kept brighter than the paint-chip M blue for that reason.
 *
 * bar: the shift bar's three zones. lowColor up to midAt, midColor up to the
 * red zone, highColor from there. midAt: 'shift' = where the shift zone starts
 * (redline - 1500), or a fraction of the bar (M climbs light blue -> blue at 50%).
 */
const THEMES = {
    classic: {
        name: 'Classic',
        fg: [243, 246, 250, 255], dim: [243, 246, 250, 148], track: [243, 246, 250, 36], arc: [243, 246, 250, 255],
        glow: 0.35, stripe: false,
        bar: { low: [243, 246, 250], mid: [255, 154, 60], high: [255, 75, 62], midAt: 'shift' },
        rev: { from: [120, 128, 140], to: [243, 246, 250] },
    },
    m: {
        name: 'M',
        fg: [243, 246, 250, 255], dim: [170, 205, 255, 158], track: [80, 150, 255, 41], arc: [79, 180, 255, 255],
        glow: 0.4, stripe: true,
        bar: { low: [79, 180, 255], mid: [51, 102, 255], high: [232, 38, 45], midAt: 0.5 },
        rev: { from: [51, 102, 255], to: [110, 170, 255] },
    },
    night: {
        name: 'Night',
        fg: [255, 179, 71, 255], dim: [255, 179, 71, 140], track: [255, 179, 71, 36], arc: [255, 179, 71, 255],
        glow: 0.3, stripe: false,
        bar: { low: [255, 179, 71], mid: [255, 179, 71], high: [255, 75, 62], midAt: 'shift' },
        rev: { from: [150, 95, 35], to: [255, 179, 71] },
    },
    // Cluster theme (a layout's own "theme"). The cluster is an LCD, not glass: black is solid black there,
    // and it covers BMW's gauges under it. Extra roles: bg (the screen), panel (box inside), line (box
    // frame), head (box header strip), ink (text on a header), accent (a highlighted header).
    // The car brightens dark tints (Nov 5 2026: a navy backdrop came out light steel blue), so until that curve
    // is measured every large area (bg, panel, well) is pure black in all the cluster themes.
    gt3: {
        name: 'GT3',
        fg: [244, 244, 244, 255], dim: [150, 154, 160, 255], track: [255, 255, 255, 26], arc: [244, 244, 244, 255],
        glow: 0, stripe: false,
        bar: { low: [57, 222, 72], mid: [255, 196, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [57, 222, 72], to: [57, 222, 72] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [205, 208, 214, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [255, 196, 0, 255], well: [0, 0, 0, 255], wellLine: [70, 74, 80, 255],
    },
    // Apex Dash themes (apps/apex_dash): black with one bright accent. Same roles as gt3 (the cluster is an LCD: black is solid).
    apex: {
        name: 'Apex',
        fg: [244, 247, 252, 255], dim: [128, 150, 178, 255], track: [255, 255, 255, 30], arc: [64, 196, 255, 255],
        glow: 0, stripe: false,
        bar: { low: [64, 196, 255], mid: [255, 196, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [64, 196, 255], to: [64, 196, 255] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [46, 128, 176, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [64, 196, 255, 255], well: [0, 0, 0, 255], wellLine: [60, 70, 84, 255],
    },
    apexred: {
        name: 'Apex Red',
        fg: [244, 244, 246, 255], dim: [150, 150, 160, 255], track: [255, 255, 255, 30], arc: [255, 40, 40, 255],
        glow: 0, stripe: true,
        bar: { low: [60, 220, 120], mid: [255, 196, 0], high: [255, 30, 30], midAt: 'shift' },
        rev: { from: [255, 40, 40], to: [255, 40, 40] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [150, 40, 40, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [255, 196, 0, 255], well: [0, 0, 0, 255], wellLine: [70, 60, 60, 255],
    },
    circuit: {
        name: 'Circuit',
        fg: [244, 247, 244, 255], dim: [140, 158, 140, 255], track: [255, 255, 255, 28], arc: [150, 235, 40, 255],
        glow: 0, stripe: false,
        bar: { low: [150, 235, 40], mid: [255, 196, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [150, 235, 40], to: [150, 235, 40] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [86, 130, 40, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [150, 235, 40, 255], well: [0, 0, 0, 255], wellLine: [60, 70, 60, 255],
    },
    sprint: {
        name: 'Sprint',
        fg: [250, 248, 240, 255], dim: [168, 150, 120, 255], track: [255, 255, 255, 30], arc: [255, 168, 0, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 168, 0], mid: [255, 120, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [255, 168, 0], to: [255, 42, 42] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [150, 100, 20, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [255, 168, 0, 255], well: [0, 0, 0, 255], wellLine: [70, 62, 48, 255],
    },
    // Sport (layout sport.json): BMW's Live Cockpit Sport view, blue speed and red revs round the map.
    // Extra roles: sblue / spink (the speed and rpm scale numbers), sred (the rpm caption).
    sportdash: {
        name: 'Sport',
        fg: [244, 247, 252, 255], dim: [150, 170, 205, 255], track: [70, 80, 100, 255], arc: [60, 215, 255, 255],
        glow: 0, stripe: false,
        bar: { low: [60, 215, 255], mid: [60, 215, 255], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [224, 26, 56], to: [224, 26, 56] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [60, 215, 255, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [60, 215, 255, 255], well: [0, 0, 0, 255], faint: [96, 110, 135, 255],
        sblue: [120, 170, 245, 255], spink: [236, 140, 140, 255], sred: [235, 60, 70, 255],
    },
    // M cluster look (layout m.json, after design/photos/ref-m8-cluster.png): black, white numbers with a chrome
    // fade, M red needles and setup bars. Extra roles: redTrack, chrome (bottom of a chrome fade), grey / grey2
    // (the dim gear number's fade), faint.
    mdash: {
        name: 'M',
        fg: [238, 241, 246, 255], dim: [132, 140, 152, 255], track: [104, 110, 120, 255], arc: [226, 36, 44, 255],
        glow: 0, stripe: false,
        bar: { low: [226, 36, 44], mid: [226, 36, 44], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [226, 36, 44], to: [226, 36, 44] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [196, 202, 212, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [226, 36, 44, 255], well: [0, 0, 0, 255], redTrack: [90, 16, 20, 255],
        chrome: [182, 188, 198, 255], grey: [160, 166, 176, 255], grey2: [104, 110, 122, 255], faint: [96, 104, 118, 255],
    },
    e39: {
        name: 'E39 M5',
        fg: [239, 220, 194, 255], dim: [234, 219, 198, 255], track: [255, 110, 20, 45], arc: [255, 110, 20, 255],
        glow: 0.14, stripe: false,
        bar: { low: [255, 132, 28], mid: [255, 184, 20], high: [245, 35, 25], midAt: 'shift' },
        rev: { from: [255, 120, 20], to: [255, 45, 25] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [255, 120, 24, 255], head: [255, 128, 24, 255],
        ink: [25, 7, 4, 255], accent: [255, 116, 72, 255], well: [0, 0, 0, 255], faint: [255, 110, 60, 78],
        ghost: [255, 90, 40, 28], wm: [255, 255, 255, 24],
    },
    e39n: {
        name: 'E39 M5 Night',
        fg: [255, 191, 99, 255], dim: [255, 184, 90, 255], track: [255, 110, 20, 45], arc: [255, 110, 20, 255],
        glow: 0.38, stripe: false,
        bar: { low: [255, 132, 28], mid: [255, 184, 20], high: [245, 35, 25], midAt: 'shift' },
        rev: { from: [255, 120, 20], to: [255, 45, 25] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [255, 120, 24, 255], head: [255, 128, 24, 255],
        ink: [25, 7, 4, 255], accent: [255, 154, 90, 255], well: [0, 0, 0, 255], faint: [255, 120, 60, 90],
        ghost: [255, 80, 30, 36], wm: [255, 140, 50, 20],
    },
    e39v2: {
        name: 'E39 M5 V2',
        fg: [239, 220, 194, 255], dim: [234, 219, 198, 255], track: [255, 110, 20, 45], arc: [255, 110, 20, 255],
        glow: 0.14, stripe: false,
        bar: { low: [255, 132, 28], mid: [255, 184, 20], high: [245, 35, 25], midAt: 'shift' },
        rev: { from: [255, 120, 20], to: [255, 45, 25] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [255, 120, 24, 255], head: [255, 128, 24, 255],
        ink: [25, 7, 4, 255], accent: [255, 116, 72, 255], well: [0, 0, 0, 255], faint: [255, 110, 60, 78],
        ghost: [255, 90, 40, 28], wm: [255, 255, 255, 24],
    },
    e39v2n: {
        name: 'E39 M5 V2 Night',
        fg: [255, 191, 99, 255], dim: [255, 184, 90, 255], track: [255, 110, 20, 45], arc: [255, 110, 20, 255],
        glow: 0.38, stripe: false,
        bar: { low: [255, 132, 28], mid: [255, 184, 20], high: [245, 35, 25], midAt: 'shift' },
        rev: { from: [255, 120, 20], to: [255, 45, 25] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [255, 120, 24, 255], head: [255, 128, 24, 255],
        ink: [25, 7, 4, 255], accent: [255, 154, 90, 255], well: [0, 0, 0, 255], faint: [255, 120, 60, 90],
        ghost: [255, 80, 30, 36], wm: [255, 140, 50, 20],
    },
};
// every theme: the shift-point red, used by "hot" (the gear and SHIFT at the shift point, the rev bar past it)
Object.keys(THEMES).forEach((k) => { THEMES[k].hot = [255, 42, 42, 255]; });

// Redline layout (after cauliflowermossgrape's Redline app): rev bar segments ramp rev.from -> rev.to up to
// the shift point; the shift lights run green -> yellow -> red in every theme; grade badges by verdict.
const LIGHTS = { green: [47, 210, 122], yellow: [255, 194, 26], red: [255, 42, 42], blue: [40, 110, 255] };
const VERDICT = {
    'SPOT ON': [47, 210, 122, 255], EARLY: [255, 194, 26, 255], LATE: [255, 138, 26, 255],
    LIMITER: [255, 42, 42, 255], 'COLD REV': [61, 139, 255, 255], COLD: [61, 139, 255, 255],
};

// The M tricolour stripe: light blue, dark blue, red (brightened for the HUD).
const M_STRIPE = [[79, 180, 255, 255], [47, 91, 216, 255], [232, 38, 45, 255]];

/** A colour from a role name ("fg") or a literal [r,g,b,a]. */
function color(theme, c) {
    if (Array.isArray(c)) return c;
    return theme[c] || theme.fg;
}

module.exports = { THEMES, M_STRIPE, LIGHTS, VERDICT, color };
