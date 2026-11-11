'use strict';
/**
 * The HUD's GLSL ES 1.00 fragment shaders for cluster-render "effect" layers, drawn on the
 * car's GPU. Kept as JS strings because the kit's build ships an app's top-level .js files
 * as they are (a data folder becomes a JSON-only pack). hud.js sends the uniforms.
 */
const SHIFTBAR = `// Segmented shift bar for a cluster-render "effect" layer (GLSL ES 1.00).
// v_uv is 0..1 across the layer, (0,0) at the top-left as on the car. Uniforms come from hud.js:
//   u_value   0..1, how much of the bar is lit (rpm / bar max)
//   u_size    layer size in px (w, h), for round corners and gaps in pixels
//   u_segs    segment count
//   u_low, u_mid, u_high   zone colours (rgb 0..1)
//   u_midAt, u_highAt      where the mid and high zones start (0..1 of the bar)
//   u_track   unlit segment colour (rgba, straight alpha)
//   u_flash   1 = at the redline: every lit segment shows the high colour
// Output is straight alpha. Whether cluster-render blends effect layers as
// straight or premultiplied alpha is not confirmed yet: check the edges on the car.
precision mediump float;
varying vec2 v_uv;
uniform float u_value;
uniform vec2 u_size;
uniform float u_segs;
uniform vec3 u_low;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform float u_midAt;
uniform float u_highAt;
uniform vec4 u_track;
uniform float u_flash;

void main() {
    float gapPx = 3.0;
    float slot = u_size.x / u_segs;                 // px per segment incl. gap
    float px = v_uv.x * u_size.x;
    float idx = floor(px / slot);
    float inSeg = px - idx * slot;                  // px into this slot
    float segW = slot - gapPx;
    float py = v_uv.y * u_size.y;           // px from the top

    // rounded-rect coverage for this segment, radius 2px, 1px soft edge
    vec2 hs = vec2(segW, u_size.y) * 0.5;
    vec2 p = vec2(inSeg, py) - hs;
    vec2 q = abs(p) - (hs - vec2(2.0));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 2.0;
    float cover = clamp(0.5 - d, 0.0, 1.0);
    if (inSeg > segW) cover = 0.0;
    if (cover <= 0.0) { gl_FragColor = vec4(0.0); return; }

    float pos = (idx + 0.5) / u_segs;               // segment centre, 0..1
    bool lit = pos <= u_value;
    vec3 c = pos >= u_highAt ? u_high : (pos >= u_midAt ? u_mid : u_low);
    if (u_flash > 0.5) c = u_high;
    gl_FragColor = lit ? vec4(c, cover) : vec4(u_track.rgb, u_track.a * cover);
}
`;

const ARC = `// Thin open arc gauge for a cluster-render "effect" layer (GLSL ES 1.00).
// u_start / u_sweep (radians, clockwise from 12 o'clock; a negative sweep runs anticlockwise), round
// ends, filled from the start. hud.js default: 270 degrees from the lower left, the gap at the bottom.
// Uniforms from hud.js:
//   u_value  0..1 of the sweep
//   u_size   layer size in px (w, h)
//   u_color  lit arc (rgb 0..1)
//   u_track  unlit arc (rgba, straight alpha)
//   u_width  stroke width in px
// Output is straight alpha (same open question as the shift bar shader above).
precision mediump float;
varying vec2 v_uv;
uniform float u_value;
uniform vec2 u_size;
uniform vec3 u_color;
uniform vec4 u_track;
uniform float u_width;
uniform float u_start;
uniform float u_sweep;

const float PI = 3.14159265359;

// distance from point p (centred, px) to the arc from angle a0 sweeping s, radius r
float arcDist(vec2 p, float r, float a0, float s) {
    float a = atan(p.x, p.y);           // clockwise from 12 o'clock, -PI..PI
    float rel = mod(a - a0 + 4.0 * PI, 2.0 * PI);
    if (rel <= s) return abs(length(p) - r);
    vec2 e0 = r * vec2(sin(a0), cos(a0));
    vec2 e1 = r * vec2(sin(a0 + s), cos(a0 + s));
    return min(length(p - e0), length(p - e1));   // round end caps
}

void main() {
    vec2 p = vec2(v_uv.x - 0.5, 0.5 - v_uv.y) * u_size;   // px from centre, +y up (v_uv is top-left)
    float start = u_start, sweep = u_sweep;
    if (sweep < 0.0) { p.x = -p.x; start = -start; sweep = -sweep; }   // anticlockwise = mirrored clockwise
    float r = min(u_size.x, u_size.y) * 0.5 - u_width * 0.5 - 1.0;
    float hw = u_width * 0.5;
    float dTrack = arcDist(p, r, start, sweep) - hw;
    float lit = clamp(u_value, 0.0, 1.0) * sweep;
    float dLit = lit > 0.001 ? arcDist(p, r, start, lit) - hw : 1e5;
    float cLit = clamp(0.5 - dLit, 0.0, 1.0);
    float cTrack = clamp(0.5 - dTrack, 0.0, 1.0);
    if (cLit > 0.0) gl_FragColor = vec4(u_color, cLit);
    else gl_FragColor = vec4(u_track.rgb, u_track.a * cTrack);
}
`;

const REVBAR = `// G20 Live Cockpit style rev bar for a cluster-render "effect" layer (GLSL ES 1.00), after
// cauliflowermossgrape's Redline app (MIT). From the top of the layer: u_top px for the shift-point and
// redline marks, then the bar (u_barH px, slanted: its top edge is u_slant px right of its bottom
// edge), then the scale ticks. The bar fills left to right in 500 rpm segments; each lit segment
// takes the ramp colour of its position up to the shift point (u_from -> u_to), all u_hot from the
// shift point on. Unlit: u_track, and u_hot faint past the redline. A white needle leads the fill;
// a thin slanted line holds the peak. Uniforms (rpm values are rpm, not 0..1):
//   u_size, u_top, u_barH, u_slant   px
//   u_max, u_value, u_shift, u_red, u_peak   rpm
//   u_from, u_to, u_hot   rgb 0..1;  u_track, u_tick, u_fg   rgba (straight alpha)
//   u_shiftNow   1 = at or past the shift point
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_top;
uniform float u_barH;
uniform float u_slant;
uniform float u_max;
uniform float u_value;
uniform float u_shift;
uniform float u_red;
uniform float u_peak;
uniform vec3 u_from;
uniform vec3 u_to;
uniform vec3 u_hot;
uniform vec4 u_track;
uniform vec4 u_tick;
uniform vec4 u_fg;
uniform float u_shiftNow;

vec4 over(vec4 top, vec4 under) {           // straight-alpha "top over under"
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    float px = v_uv.x * u_size.x;
    float py = v_uv.y * u_size.y;   // px from the top
    float bw = u_size.x - u_slant;            // bar length along the bottom edge
    float perRpm = bw / u_max;
    vec4 c = vec4(0.0);

    // marks above the bar: shift point (amber) and redline (red), at the bar's top edge
    if (py < u_top - 2.0) {
        float ds = abs(px - (u_shift * perRpm + u_slant));
        float dr = abs(px - (u_red * perRpm + u_slant));
        if (ds < 2.0) c = vec4(1.0, 0.76, 0.1, clamp(2.0 - ds, 0.0, 1.0));
        if (dr < 2.0) c = vec4(u_hot, clamp(2.0 - dr, 0.0, 1.0));
        gl_FragColor = c; return;
    }

    float by = py - u_top;                    // px down from the bar's top edge
    if (by <= u_barH) {
        float off = u_slant * (u_barH - by) / u_barH;
        float s = px - off;                   // px along the bar at this height
        float rpm = s / perRpm;
        float inside = clamp(s + 0.5, 0.0, 1.0) * clamp(bw - s + 0.5, 0.0, 1.0)
            * clamp(by + 0.5, 0.0, 1.0) * clamp(u_barH - by + 0.5, 0.0, 1.0);
        // slanted 3 px gap every 500 rpm
        float seg = floor(rpm / 500.0);
        float dGap = abs(s - floor(rpm / 500.0 + 0.5) * 500.0 * perRpm);
        float gap = rpm > 250.0 && rpm < u_max - 250.0 ? clamp(dGap - 1.0, 0.0, 1.0) : 1.0;
        vec4 bar;
        if (rpm <= u_value) {
            float f = clamp((seg * 500.0 + 250.0) / u_shift, 0.0, 1.0);
            vec3 col = u_shiftNow > 0.5 ? u_hot : mix(u_from, u_to, f);
            bar = vec4(col, 1.0);
        } else if (rpm >= u_red) bar = vec4(u_hot, 0.3);
        else bar = u_track;
        c = vec4(bar.rgb, bar.a * inside * gap);
        // peak: a thin slanted line where the rpm last peaked (only above the current rpm)
        if (u_peak > u_value + 60.0) {
            float dp = abs(s - u_peak * perRpm);
            vec3 pc = u_peak >= u_shift ? u_hot : mix(u_from, u_to, clamp(u_peak / u_shift, 0.0, 1.0));
            c = over(vec4(pc, clamp(1.5 - dp, 0.0, 1.0) * inside), c);
        }
        // needle: the bright leading edge of the fill
        if (u_value > 50.0) {
            float dn = abs(s - min(u_value, u_max) * perRpm);
            c = over(vec4(1.0, 1.0, 1.0, clamp(2.5 - dn, 0.0, 1.0) * clamp(by + 2.5, 0.0, 1.0) * clamp(u_barH - by + 2.5, 0.0, 1.0)), c);
        }
        gl_FragColor = c; return;
    }

    // scale ticks under the bar: every 500 rpm, longer every 1000, red from the redline
    float ty = by - u_barH - 4.0;
    if (ty >= 0.0) {
        float rpm = px / perRpm;
        float k = floor(rpm / 500.0 + 0.5);
        float d = abs(px - k * 500.0 * perRpm);
        bool major = mod(k, 2.0) < 0.5;
        float len = major ? 10.0 : 5.0;
        float hw = major ? 1.25 : 0.75;
        float a = clamp(hw + 0.5 - d, 0.0, 1.0) * (ty <= len ? 1.0 : 0.0);
        vec4 tc = k * 500.0 >= u_red ? vec4(u_hot, 1.0) : (major ? u_fg : u_tick);
        c = vec4(tc.rgb, tc.a * a);
    }
    gl_FragColor = c;
}
`;

const LIGHTS = `// Shift lights for a cluster-render "effect" layer (GLSL ES 1.00), after cauliflowermossgrape's Redline
// app (MIT): u_n rounded lights in a row, green -> yellow -> red from left to right. u_lit of them are
// on (they fill from a start rpm up to the shift point); u_strobe 1 = at the shift point: all red.
// The last u_tail lights are blue instead (the GT3 dash look; 0 = none). u_round 1 = round lights.
//   u_size px, u_n count, u_lit count (0..u_n), u_tail count, u_strobe 0/1, u_green/u_yellow/u_red/u_blue rgb,
//   u_off (alpha when off)
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_n;
uniform float u_lit;
uniform float u_tail;
uniform float u_round;
uniform float u_strobe;
uniform vec3 u_green;
uniform vec3 u_yellow;
uniform vec3 u_red;
uniform vec3 u_blue;
uniform float u_off;

void main() {
    float gapPx = 6.0;
    float slot = (u_size.x + gapPx) / u_n;
    float px = v_uv.x * u_size.x;
    float py = v_uv.y * u_size.y;
    float idx = floor(px / slot);
    float inSeg = px - idx * slot;
    float segW = slot - gapPx;
    if (inSeg > segW || idx >= u_n) { gl_FragColor = vec4(0.0); return; }
    vec2 hs = vec2(segW, u_size.y) * 0.5;
    vec2 p = vec2(inSeg, py) - hs;
    float r = u_round > 0.5 ? min(hs.x, hs.y) : min(4.0, hs.y);
    if (u_round > 0.5) hs = vec2(r);
    p = vec2(inSeg, py) - vec2(segW, u_size.y) * 0.5;
    vec2 q = abs(p) - (hs - vec2(r));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float cover = clamp(0.5 - d, 0.0, 1.0);
    float nMain = max(1.0, u_n - u_tail);
    float f = idx / max(1.0, nMain - 1.0);
    vec3 col = idx >= nMain ? u_blue : (f < 0.42 ? u_green : (f < 0.75 ? u_yellow : u_red));
    bool on = idx < u_lit;
    if (u_strobe > 0.5) { col = u_red; on = true; }
    gl_FragColor = vec4(col, cover * (on ? 1.0 : u_off));
}
`;

const FILL = `// Solid fill for a cluster-render "effect" layer (GLSL ES 1.00): u_color everywhere, except a
// see-through rounded hole u_hole (x, y, w, h px from the layer's top left; w = 0: no hole), radius u_holeR.
// On the cluster, an opaque fill hides BMW's own gauges under it; the hole lets the map window show.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_color;
uniform vec4 u_hole;
uniform float u_holeR;

void main() {
    vec2 p = vec2(v_uv.x * u_size.x, v_uv.y * u_size.y);
    float a = u_color.a;
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 q = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_holeR;
        a *= clamp(d + 0.5, 0.0, 1.0);
    }
    gl_FragColor = vec4(u_color.rgb, a);
}
`;

const BOX = `// Framed box for a cluster-render "effect" layer (GLSL ES 1.00), the race-dash readout box: a rounded
// frame u_border px wide in u_line, filled u_fill, with a header strip u_headH px tall in u_head across the
// top (0 = none). Colours rgba, straight alpha. u_size, u_border, u_headH, u_radius in px.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_fill;
uniform vec4 u_line;
uniform vec4 u_head;
uniform float u_headH;
uniform float u_border;
uniform float u_radius;

void main() {
    vec2 p = vec2(v_uv.x * u_size.x, v_uv.y * u_size.y);
    vec2 hs = u_size * 0.5;
    vec2 q = abs(p - hs) - (hs - vec2(u_radius));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;   // < 0 inside
    float outer = clamp(0.5 - d, 0.0, 1.0);
    if (outer <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec4 c = p.y < u_headH ? u_head : u_fill;
    float edge = clamp(d + u_border + 0.5, 0.0, 1.0);                       // 1 within the frame
    vec4 col = mix(c, u_line, edge);
    gl_FragColor = vec4(col.rgb, col.a * outer);
}
`;

const BOXES = `// The GT3 race dash's frame in one cluster-render "effect" layer (GLSL ES 1.00): the background u_bg over the
// whole layer, a see-through rounded hole for BMW's map (u_hole x, y, w, h in layer px, already inset; w 0 = none;
// corner radius u_holeR) and up to 12 framed readout boxes from the layout: each a rounded frame in u_line, filled
// u_fill, with a header strip across its top in u_head (or u_accent). Array uniforms (sent with type vec4):
//   u_box[i]       x, y, w, h in layer px
//   u_boxStyle[i]  header height px, border px, corner radius px, header kind (0 u_head, 1 u_accent)
//   u_n            boxes in use (the rest are skipped). Boxes must not overlap each other or the hole.
// Colours rgba, straight alpha. The loop bound is constant and the arrays are indexed by the loop counter only,
// as GLSL ES 1.00 requires.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_bg;
uniform vec4 u_hole;
uniform float u_holeR;
uniform float u_n;
uniform vec4 u_box[12];
uniform vec4 u_boxStyle[12];
uniform vec4 u_fill;
uniform vec4 u_line;
uniform vec4 u_head;
uniform vec4 u_accent;

// signed distance to the rounded rect r (x, y, w, h), radius rad; < 0 inside
float sdBox(vec2 p, vec4 r, float rad) {
    vec2 hs = r.zw * 0.5;
    vec2 q = abs(p - (r.xy + hs)) - (hs - vec2(rad));
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
vec4 over(vec4 top, vec4 under) {           // straight-alpha "top over under"
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

void main() {
    vec2 p = v_uv * u_size;
    vec4 c = u_bg;
    if (u_hole.z > 0.0) c.a *= clamp(sdBox(p, u_hole, u_holeR) + 0.5, 0.0, 1.0);
    for (int i = 0; i < 12; i++) {
        if (float(i) >= u_n) break;
        vec4 b = u_box[i];
        vec4 s = u_boxStyle[i];
        if (p.x < b.x - 1.0 || p.x > b.x + b.z + 1.0 || p.y < b.y - 1.0 || p.y > b.y + b.w + 1.0) continue;
        float d = sdBox(p, b, s.z);
        float outer = clamp(0.5 - d, 0.0, 1.0);
        if (outer <= 0.0) continue;
        vec4 inner = p.y < b.y + s.x ? (s.w > 0.5 ? u_accent : u_head) : u_fill;
        float edge = clamp(d + s.y + 0.5, 0.0, 1.0);               // 1 within the frame
        vec4 col = mix(inner, u_line, edge);
        c = over(vec4(col.rgb, col.a * outer), c);
    }
    gl_FragColor = c;
}
`;

const GRID = `// Calibration grid for a cluster-render "effect" layer (GLSL ES 1.00): a line every u_step px, a brighter
// one every u_major steps, a frame round the edge. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_step;
uniform float u_major;
uniform vec4 u_minor;
uniform vec4 u_majorC;

void main() {
    vec2 p = v_uv * u_size;
    vec2 m = mod(p, u_step);
    vec2 big = mod(p, u_step * u_major);
    bool edge = p.x < 2.0 || p.y < 2.0 || p.x > u_size.x - 2.0 || p.y > u_size.y - 2.0;
    if (edge || big.x < 2.0 || big.y < 2.0) gl_FragColor = u_majorC;
    else if (m.x < 1.0 || m.y < 1.0) gl_FragColor = u_minor;
    else gl_FragColor = vec4(0.0);
}
`;

const SEGBAR = `// Segmented level bar for a cluster-render "effect" layer (GLSL ES 1.00): u_segs segments, the first
// u_lit of them lit (brightening left to right), each slanted u_slant px. v_uv (0,0) is the top-left.
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_segs;
uniform float u_lit;
uniform vec4 u_on;
uniform vec4 u_offC;
uniform float u_slant;

void main() {
    vec2 p = v_uv * u_size;
    float x = p.x - u_slant * (1.0 - v_uv.y);
    float gap = 8.0;
    float slot = (u_size.x - u_slant + gap) / u_segs;
    float i = floor(x / slot);
    float fx = x - i * slot;
    float a = clamp(fx + 0.5, 0.0, 1.0) * clamp(slot - gap - fx + 0.5, 0.0, 1.0);
    if (i < 0.0 || i >= u_segs || a <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec4 col = i < u_lit ? vec4(u_on.rgb * mix(0.72, 1.0, fx / (slot - gap)), u_on.a) : u_offC;
    gl_FragColor = vec4(col.rgb, col.a * a);
}
`;

const MDASH = `// The M theme's whole backdrop in one cluster-render "effect" layer (GLSL ES 1.00), traced off a photo of a current
// M8's cluster (design/photos/ref-m8-cluster.png, warped to 1920x720): black, with a near-black card either side whose
// inner edge follows the rev blade, whose top edge is the photo's curve and whose bottom outer corner is a big round;
// the centre line with its bright end caps, the tyre block's car glyph and dividers (the eight values are text widgets),
// the two side dials over the cards (the photo's thin glass bracket, hatched bezel, red streaks), the tricolour mark
// and the four setup level bars (slanted segments, the one at the level red, the rest grey, as the M8 draws them).
// Positions in target px from the layout (hud.js). v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_card;      // left card: outer edge x, bottom y, bottom-outer corner radius, top-outer corner rounding (the right card is its mirror)
uniform vec3 u_cardCutR;  // the right card's lower outer corner, cut back on a circle (mirrored frame: cx, cy, r; r 0 = none): the M8's
                          // right card is cut further than its left one, so the oil dial's numbers sit on black
uniform vec3 u_cardTop;   // the left card's top edge, y = a x^2 + b x + c (traced off the M8 photo)
uniform float u_cardFill; // the card's grey level 0..1 (0 = black, outline only)
uniform vec4 u_blade;     // the left rev blade's outer edge: x at the bend, y of the bend, x per y px above / below it
uniform vec2 u_bladeB;    // the bend's roundness px, the card's gap from the blade px
uniform vec4 u_line;      // centre line x0, y, x1, cap length
uniform vec3 u_tyre;      // the tyre block's car glyph: centre x, y, scale (0 = none)
uniform vec4 u_gaugeL;    // left gauge centre x, y, radius, value 0..1
uniform vec4 u_gaugeR;    // right gauge
uniform vec3 u_mark;      // tricolour mark x, y, scale (0 = none)
uniform vec3 u_red;
uniform vec4 u_seg0;      // setup level bars x, y, w, h (a height of 0: none)
uniform vec4 u_seg1;
uniform vec4 u_seg2;
uniform vec4 u_seg3;
uniform vec4 u_segLit;    // the level per bar (1-based; 0 = none lit)
uniform vec4 u_segMax;    // segments per bar
uniform float u_segSlant; // px each segment leans

const float PI = 3.14159265;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

float sdRoundBox(vec2 p, vec4 r, float rad) {
    vec2 c = r.xy + r.zw * 0.5;
    vec2 q = abs(p - c) - r.zw * 0.5 + rad;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float angOf(vec2 d) { float a = atan(d.x, -d.y); return a < 0.0 ? a + 2.0 * PI : a; }
// the left blade's outer edge x at y (mtach's curve)
float bladeX(float y) {
    float dy = y - u_blade.y;
    float k = dy < 0.0 ? u_blade.z : u_blade.w;
    return u_blade.x + k * (sqrt(dy * dy + u_bladeB.x * u_bladeB.x) - u_bladeB.x);
}
// smooth intersection of two signed distances (rounds the corner where they meet)
float smax(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
// the left card as the M8 draws it: a wedge whose top edge is the traced curve, outer edge at u_card.x, bottom at
// u_card.y, inner side along the blade; the bottom-outer corner is a big round (the fuel dial sits over it); < 0 inside
float cardD(vec2 p, float right) {
    float fx = u_cardTop.x * p.x * p.x + u_cardTop.y * p.x + u_cardTop.z;
    float slope = 2.0 * u_cardTop.x * p.x + u_cardTop.y;
    float dTop = (fx - p.y) / sqrt(1.0 + slope * slope);
    float dLeft = u_card.x - p.x;
    float dBot = p.y - u_card.y;
    float d = smax(dTop, dLeft, u_card.w);
    d = max(d, dBot);
    vec2 cc = vec2(u_card.x + u_card.z, u_card.y - u_card.z);
    if (p.x < cc.x && p.y > cc.y) d = max(d, length(p - cc) - u_card.z);
    d = max(d, p.x - (bladeX(p.y) - u_bladeB.y));
    if (right > 0.5 && u_cardCutR.z > 0.0) d = max(d, length(p - u_cardCutR.xy) - u_cardCutR.z);
    return d;
}
// the card: near-black (the panel brightens every dark tint, so the fill stays tiny), a shade lighter and bluer at
// the top, with a faint lighter rim
vec4 card(vec2 p, vec2 dial, float right, vec4 c) {
    float d = cardD(p, right);
    if (d > 2.0) return c;
    float top = u_cardTop.z - u_cardTop.y * u_cardTop.y / (4.0 * u_cardTop.x);   // the curve's lowest y (its vertex)
    float fy = clamp((p.y - top) / max(u_card.y - top, 1.0), 0.0, 1.0);
    float grey = u_cardFill * mix(1.3, 0.75, fy);
    c = over(vec4(vec3(grey, grey, grey * 1.18), cov(d)), c);
    // the rim stops inside the dial's area (as on the M8, where the dial covers the card's edge), so no label sits on it;
    // 118..130 px at the photo's dial size (r 120), scaled with the layout's
    float kd = u_gaugeL.z / 120.0;
    float hide = 1.0 - smoothstep(118.0 * kd, 130.0 * kd, length(p - dial));
    c = over(vec4(0.5, 0.53, 0.58, 0.3 * cov(abs(d + 1.2) - 0.9) * (1.0 - hide)), c);
    return c;
}
// the tyre block: the car seen from above (outline body, four wheels) between the four readouts,
// a divider under each front pair, a tick above and below the car
vec4 tyreBlock(vec2 p, vec4 c) {
    if (u_tyre.z <= 0.0) return c;
    vec2 q = (p - u_tyre.xy) / u_tyre.z;
    if (abs(q.x) > 80.0 || abs(q.y) > 70.0) return c;
    float body = abs(sdRoundBox(q, vec4(-11.0, -20.0, 22.0, 40.0), 7.0)) - 1.1;
    vec2 a = vec2(abs(q.x) - 13.5, abs(q.y) - 11.0);
    float wheel = max(abs(a.x) - 2.2, abs(a.y) - 4.5);
    float hl = min(segD(q, vec2(-68.0, 0.0), vec2(-28.0, 0.0)), segD(q, vec2(28.0, 0.0), vec2(68.0, 0.0))) - 0.9;
    float vt = min(segD(q, vec2(0.0, -62.0), vec2(0.0, -42.0)), segD(q, vec2(0.0, 42.0), vec2(0.0, 62.0))) - 0.9;
    c = over(vec4(0.72, 0.76, 0.82, cov(min(body, min(hl, vt)) * u_tyre.z)), c);
    c = over(vec4(0.36, 0.78, 0.42, cov(wheel * u_tyre.z)), c);
    return c;
}
// a setup level bar: s.y segments slanted, number lit (1-based) red, the rest grey
vec4 segbar(vec2 p, vec4 b, vec2 s, vec4 c) {
    if (b.w <= 0.0 || p.y < b.y - 1.0 || p.y > b.y + b.w + 1.0 || p.x < b.x - 1.0 || p.x > b.x + b.z + 1.0) return c;
    float fy = (p.y - b.y) / b.w;
    float x = p.x - b.x - u_segSlant * (1.0 - fy);
    float gap = 10.0;
    float slot = (b.z - u_segSlant + gap) / s.y;
    float i = floor(x / slot);
    float fx = x - i * slot;
    float a = clamp(fx + 0.5, 0.0, 1.0) * clamp(slot - gap - fx + 0.5, 0.0, 1.0) * clamp(p.y - b.y + 0.5, 0.0, 1.0) * clamp(b.y + b.w - p.y + 0.5, 0.0, 1.0);
    if (i < 0.0 || i >= s.y || a <= 0.0) return c;
    bool on = abs(i + 1.0 - s.x) < 0.5;
    vec3 col = on ? u_red * mix(0.85, 1.0, fx / (slot - gap)) : vec3(0.5, 0.53, 0.58);
    return over(vec4(col, (on ? 1.0 : 0.8) * a), c);
}

// a side dial as the M8 draws it, traced off the photo: not a round gauge but a tall thin bracket cut from big
// circles. The glass lies inside a circle of radius 120 round the anchor g.xy and outside one of radius 180 round
// (57, -68), so it is ~20 px wide at the top and widens to ~50 at the bottom; a hatched chrome bezel (an arc between
// radii 113 and 124 round (-13, 11)) runs down its outer side. The level reads by height: the glass is lit from the
// bottom up to the level, dark above it (a thin bright line along its outer edge), and a horizontal red streak runs in
// from the outer edge at the level. Fixed streaks mark the end zones (zones 0, fuel: the reserve at the bottom; 1, oil:
// blue at the cold bottom end, red at the hot top end). Units are the photo's px with g.z = 120 there.
// Drawn in the left frame; the right dial comes through the mirror.
vec4 streak(vec2 q, float py, float len, vec3 col, float k, vec4 c) {
    float xo = -sqrt(max(14400.0 - py * py, 0.0)) - 3.0;                         // the glass's outer edge at that height
    float dx = q.x - (xo + len * 0.5), dy = abs(q.y - py);
    float taper = 1.0 - clamp(abs(dx) / (len * 0.5), 0.0, 1.0);
    float sd = (max(abs(dx) - len * 0.5, dy - (1.2 + 2.3 * taper))) * k;
    c = over(vec4(col, 0.3 * exp(-max(sd, 0.0) / (5.0 * k))), c);
    return over(vec4(mix(col, vec3(1.0, 0.55, 0.5), 0.25 * taper), cov(sd)), c);
}
vec4 gauge(vec2 p, vec4 g, float zones, vec4 c) {
    float k = g.z / 120.0;
    vec2 q = (p - g.xy) / k;
    if (q.x < -140.0 || q.x > 70.0 || q.y < -22.0 || q.y > 140.0) return c;
    float v = clamp(g.w, 0.0, 1.0);
    // the bezel: double-edged and hatched, from its top end down round to its bottom end
    vec2 qb = q - vec2(-13.0, 11.0);
    float rb = length(qb);
    if (q.y > -16.0 && q.x < -30.0 && rb > 111.0 && rb < 126.0) {
        float ab = atan(qb.y, qb.x);
        float hatch = step(0.5, fract(ab * 30.0));
        float edge = max(cov((abs(rb - 112.5)) * k - 0.8), cov((abs(rb - 124.0)) * k - 0.8));
        float body = (rb > 112.5 && rb < 124.0) ? 0.4 + 0.35 * hatch : 0.0;
        c = over(vec4(0.8, 0.82, 0.88, min(1.0, body + 0.7 * edge)), c);
    }
    // the glass
    float dOut = 120.0 - length(q);
    float dIn = length(q - vec2(57.0, -68.0)) - 180.0;
    float inside = min(min(dOut, dIn), min(q.y + 10.0, 14.0 - q.x));
    if (zones > 0.5) inside = min(min(inside, 104.0 - q.y), -30.0 - q.x);       // the oil glass ends higher and shorter (photo: y 564, x 1686)
    if (inside > -1.5) {
        float f = clamp(dOut / max(dOut + max(dIn, 0.0), 1.0), 0.0, 1.0);        // 0 at the outer edge, 1 at the inner
        float yv = zones > 0.5 ? mix(97.0, 7.0, v) : mix(100.0, 2.0, v);
        float lit = smoothstep(yv - 2.0, yv + 4.0, q.y);
        vec4 dark = vec4(0.85, 0.87, 0.92, 0.75 * (1.0 - smoothstep(0.0, 6.0, dOut)));
        vec4 bright = vec4(mix(vec3(0.96, 0.97, 0.99), vec3(0.55, 0.57, 0.63), f), mix(1.0, 0.55, f));
        vec4 glass = mix(dark, bright, lit);
        c = over(vec4(glass.rgb, glass.a * cov(-inside * k)), c);
        c = over(vec4(1.0, 1.0, 1.0, 0.7 * cov(abs(inside * k) - 0.6) * (1.0 - lit) * step(dOut, 3.0)), c);
    }
    float yv = zones > 0.5 ? mix(97.0, 7.0, v) : mix(100.0, 2.0, v);
    if (zones > 0.5) {
        c = streak(q, -8.0, 44.0, u_red, k, c);                                    // hot end, above the top label as the photo
        c = streak(q, 101.0, 34.0, vec3(0.3, 0.55, 1.0), k, c);                    // cold end, along the glass's bottom
    } else {
        c = streak(q, 112.0, 50.0, u_red, k, c);                                   // reserve
    }
    c = streak(q, yv, 38.0, u_red, k, c);                                          // the level, across the glass only
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec2 pm = vec2(u_size.x - p.x, p.y);        // the right half, mirrored into the left frame
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);           // black, as the M8

    // the two cards: the left one as laid out, the right one its mirror
    c = card(p, u_gaugeL.xy, 0.0, c);
    c = card(pm, vec2(u_size.x - u_gaugeR.x, u_gaugeR.y), 1.0, c);

    // centre line, bright caps at both ends
    if (abs(p.y - u_line.y) < 6.0) {
        c = over(vec4(0.62, 0.66, 0.73, 0.8 * cov(segD(p, u_line.xy, u_line.zy) - 1.6)), c);
        float l = segD(p, u_line.xy + vec2(6.0, 0.0), u_line.xy + vec2(u_line.w, 0.0)) - 2.0 - 1.2 * clamp((p.x - u_line.x) / u_line.w, 0.0, 1.0);
        float r = segD(p, u_line.zy - vec2(u_line.w, 0.0), u_line.zy - vec2(6.0, 0.0)) - 2.0 - 1.2 * clamp((u_line.z - p.x) / u_line.w, 0.0, 1.0);
        c = over(vec4(0.95, 0.96, 0.98, cov(min(l, r))), c);
    }

    c = tyreBlock(p, c);

    // the side dials, traced off the M8 photo: the glass crescent, the fuel one as laid out, the oil one its mirror
    c = gauge(p, u_gaugeL, 0.0, c);
    c = gauge(pm, vec4(u_size.x - u_gaugeR.x, u_gaugeR.yzw), 1.0, c);

    c = segbar(p, u_seg0, vec2(u_segLit.x, u_segMax.x), c);
    c = segbar(p, u_seg1, vec2(u_segLit.y, u_segMax.y), c);
    c = segbar(p, u_seg2, vec2(u_segLit.z, u_segMax.z), c);
    c = segbar(p, u_seg3, vec2(u_segLit.w, u_segMax.w), c);

    // tricolour mark: three slanted bars
    if (u_mark.z > 0.0) {
        vec2 m = (p - u_mark.xy) / u_mark.z;
        if (m.y > -1.0 && m.y < 21.0 && m.x > -2.0 && m.x < 60.0) {
            float lx = m.x - 7.0 * (1.0 - m.y / 20.0);
            float i = floor(lx / 16.0);
            float fx = lx - i * 16.0;
            float inside = cov((max(abs(fx - 6.5) - 6.5, abs(m.y - 10.0) - 10.0)) * u_mark.z);
            vec3 mc = i < 0.5 ? vec3(0.31, 0.71, 1.0) : (i < 1.5 ? vec3(0.17, 0.29, 0.78) : vec3(0.9, 0.13, 0.17));
            if (i >= 0.0 && i <= 2.0) c = over(vec4(mc, inside), c);
        }
    }
    gl_FragColor = c;
}
`;
const MTACH = `// The M theme's rev bar (GLSL ES 1.00), after the M8's: a bowed glass blade (the curve bends at u_geoA.z with a
// large roundness, so it reads as one arc), wide at 0 rpm and narrow at the top, with a bright silver outer
// edge and bright ticks running in from it every 1000 rpm. The part below the rpm is lit dim grey, a glowing red
// block rides the blade at the rpm (the M8's marker), an outlined grey foot block fills the bottom 20 px, orange dashes sit before
// the redline and a solid red line past it. Drawn as the left bar; u_side 1 mirrors it. v_uv (0,0) is the top-left.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_side;
uniform vec4 u_geoA;      // y at 0 rpm, y at max, y of the bend, outer-edge x at the bend (layer px, left frame)
uniform vec3 u_geoB;      // slope above the bend, slope below it, bend roundness px
uniform vec3 u_wid;       // blade width at 0 rpm, at max, extra at the bend
uniform float u_ticks;    // max / 1000
uniform float u_value;    // 0..1
uniform float u_orange;   // 0..1, orange dashes from here
uniform float u_redFrom;  // 0..1, red dashes from here (the redline)
uniform float u_shiftNow;
uniform vec3 u_red;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

void main() {
    vec2 p = v_uv * u_size;
    if (u_side > 0.0) p.x = u_size.x - p.x;
    float y0 = u_geoA.x, y8 = u_geoA.y, ym = u_geoA.z, xm = u_geoA.w;
    float dy = p.y - ym;
    float k = dy < 0.0 ? u_geoB.x : u_geoB.y;
    float sq = sqrt(dy * dy + u_geoB.z * u_geoB.z);
    float xo = xm + k * (sq - u_geoB.z);
    float slope = k * dy / sq;
    float d = (p.x - xo) / sqrt(1.0 + slope * slope);      // + = into the blade, towards the middle
    float t = (y0 - p.y) / (y0 - y8);
    float w = mix(u_wid.x, u_wid.y, clamp(t, 0.0, 1.0)) + u_wid.z * exp(-dy * dy / 22000.0);
    vec4 c = vec4(0.0);
    if (t >= 0.0 && t <= 1.0) {
        float inBand = clamp(d + 0.5, 0.0, 1.0) * clamp(w - d + 0.5, 0.0, 1.0);
        float across = clamp(d / w, 0.0, 1.0);
        float yn = y0 - u_value * (y0 - y8);
        vec4 g = vec4(0.62, 0.67, 0.74, mix(0.42, 0.06, across));          // empty glass (bright at the outer edge, as the M8's)
        if (p.y > yn) g = u_shiftNow > 0.5 ? vec4(u_red * 0.8, 0.6) : vec4(mix(vec3(0.86, 0.88, 0.92), vec3(0.6, 0.63, 0.68), across), mix(0.34, 0.22, across));
        // the foot: the bottom 20 px as an outlined grey block, as the M8 draws it
        if (p.y > y0 - 20.0) g = over(vec4(0.7, 0.72, 0.78, 0.22), g);
        g = over(vec4(0.9, 0.92, 0.95, 0.7 * cov(min(abs(p.y - (y0 - 19.0)), abs(p.y - (y0 - 1.5))) - 0.8)), g);
        // the marker: a red block at the rpm with a glow either side of it
        float dm = abs(p.y - yn);
        g = over(vec4(u_red, 0.5 * exp(-dm / 26.0)), g);
        g = over(vec4(mix(u_red, vec3(1.0, 0.45, 0.4), 0.35 * cov(dm - 5.0)), cov(dm - 14.0)), g);
        c = vec4(g.rgb, g.a * inBand);
        c = over(vec4(0.93, 0.95, 0.98, cov(abs(d) - 1.6)), c);               // outer edge
        c = over(vec4(1.0, 1.0, 1.0, 0.3 * cov(abs(d - 4.0) - 0.6)), c);       // its bevel
        c = over(vec4(0.66, 0.7, 0.76, 0.75 * cov(abs(d - w) - 0.8)), c);      // inner edge
        // BMW's marks: a solid red line from the redline, a few orange dashes in the run-up to it
        bool redM = t >= u_redFrom && d > 6.0 && d < 11.0;
        bool orM = t >= u_orange && t < u_redFrom - 0.01 && d > 6.0 && d < 11.0 && mod(p.y, 20.0) < 7.0;
        if (redM || orM) {
            c = over(vec4(redM ? u_red : vec3(1.0, 0.6, 0.1), 0.95), c);
        }
    }
    // ticks every 1000 rpm: bright, from the outer edge 24 px into the glass, as the M8 draws them
    float kk = floor(t * u_ticks + 0.5);
    float yk = y0 - kk / u_ticks * (y0 - y8);
    if (kk >= 0.0 && kk <= u_ticks && d > -2.0 && d < 24.0) {
        float ty = abs(p.y - yk) - 1.5;
        c = over(vec4(0.93, 0.95, 0.98, cov(ty)), c);
    }
    gl_FragColor = c;
}
`;
const SDASH = `// The Sport theme in one cluster-render "effect" layer (GLSL ES 1.00), after BMW's Live Cockpit Sport view:
// a blue speed bracket left and a red rev bracket right (the left one mirrored). Each is a thin bright outer
// line, a band that fills from the bottom (white marker at the value), a dark gap and a thin inner line round a
// black middle: plain black, or BMW's map through a see-through rounded hole (u_hole; only the fuel and oil bars
// and the bottom strip draw over it). Two-tone fuel and oil bars inside the brackets, a blue / red strip at the bottom. v_uv (0,0) is
// the top-left. The backdrop is pure black: the car brightens dark tints (seen Nov 5 2026), so no dark panels.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec4 u_geo;       // outer line: y at the top, y at the bend, y at the bottom, x at the bend (left side)
uniform vec3 u_k;         // x per y px above the bend, below it, bend roundness px
uniform float u_w;        // band width
uniform float u_inner;    // the inner line's distance from the outer line
uniform vec2 u_scale;     // y of the scale's 0 and of its top mark
uniform vec2 u_ticks;     // marks left (speed), right (rpm)
uniform float u_speed;    // 0..1 along the scale
uniform float u_rpm;      // 0..1
uniform float u_redFrom;  // 0..1 (the redline)
uniform float u_orange;   // 0..1, yellow marks from here to the redline
uniform float u_fuel;     // 0..1
uniform float u_oil;      // 0..1
uniform vec4 u_fuelSeg;   // full end x, y, empty end x, y
uniform vec4 u_oilSeg;
uniform vec4 u_hole;      // map window x, y, w, h, already inset (w 0 = none)
uniform float u_holeR;    // the hole's corner radius px
uniform vec4 u_strip;     // bottom strip: left end x, top y, height, slant px
uniform float u_topEnd;   // the top lines run from the bracket to this x (left; mirrored on the right)

const vec3 BLUE_LINE = vec3(0.36, 0.62, 1.0);
const vec3 BLUE_BAND = vec3(0.13, 0.3, 0.78);
const vec3 BLUE_LIT = vec3(0.62, 0.86, 1.0);
const vec3 BLUE_IN = vec3(0.2, 0.45, 0.98);
const vec3 RED_LINE = vec3(0.95, 0.12, 0.16);
const vec3 RED_BAND = vec3(0.33, 0.06, 0.1);
const vec3 RED_LIT = vec3(0.93, 0.1, 0.15);
const vec3 RED_IN = vec3(0.86, 0.08, 0.13);

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float segH(vec2 p, vec2 a, vec2 b) { vec2 ba = b - a; return clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0); }

float outerX(float y) {
    float dy = y - u_geo.y;
    float k = dy < 0.0 ? u_k.x : u_k.y;
    return u_geo.w + k * (sqrt(dy * dy + u_k.z * u_k.z) - u_k.z);
}
float outerSlope(float y) {
    float dy = y - u_geo.y;
    float k = dy < 0.0 ? u_k.x : u_k.y;
    return k * dy / sqrt(dy * dy + u_k.z * u_k.z);
}
// px from the outer line, inwards (perpendicular)
float dIn(vec2 q) { return (q.x - outerX(q.y)) / sqrt(1.0 + outerSlope(q.y) * outerSlope(q.y)); }

// one bracket in the left frame (q mirrored for the right one)
vec4 bracket(vec2 q, float val, float redFrom, float orange, float ticks, vec3 line, vec3 band, vec3 lit, vec3 inner, vec4 c) {
    float d = dIn(q);
    float yTopI = u_geo.x + 8.0;                              // the inner line's top run
    float t = (u_scale.x - q.y) / (u_scale.x - u_scale.y);    // 0 at the scale's 0
    bool inY = q.y > u_geo.x + 5.0 && q.y < u_geo.z - 4.0;
    // the band: lit up to the value, white marker on top
    float inB = (inY ? 1.0 : 0.0) * cov(-(d - 5.0)) * cov(d - 5.0 - u_w);
    if (inB > 0.0) {
        vec3 col = band;
        float a = 0.96;
        if (t <= val) col = mix(lit, mix(lit, vec3(1.0), 0.25), clamp((d - 5.0) / u_w, 0.0, 1.0)) * mix(0.8, 1.0, clamp(t / max(val, 0.01), 0.0, 1.0));
        c = over(vec4(col, a * inB), c);
        float yv = u_scale.x - val * (u_scale.x - u_scale.y);
        if (val > 0.002) c = over(vec4(1.0, 1.0, 1.0, inB * cov(abs(q.y - yv) - 2.0)), c);
        // marks at every label, on the band's outer half
        float kk = floor(t * ticks + 0.5);
        float yk = u_scale.x - kk / ticks * (u_scale.x - u_scale.y);
        if (kk >= 0.0 && kk <= ticks && d > 7.0 && d < 19.0) c = over(vec4(line, 0.9 * cov(abs(q.y - yk) - 1.2)), c);
        // redline: yellow dashes, then a solid red line, on the outer edge of the band
        if (redFrom < 1.5 && d > 8.0 && d < 13.0) {
            if (t >= redFrom && t <= 1.02) c = over(vec4(1.0, 0.2, 0.2, 1.0), c);
            else if (t >= orange && t < redFrom && mod(q.y, 16.0) < 7.0) c = over(vec4(1.0, 0.85, 0.1, 1.0), c);
        }
    }
    // the outer line, its top run and its bottom run
    float o = inY || abs(q.y - u_geo.x) < 6.0 || abs(q.y - u_geo.z) < 6.0 ? cov(abs(d - 1.0) - 1.8) : 0.0;
    vec2 tl = vec2(outerX(u_geo.x), u_geo.x), bl = vec2(outerX(u_geo.z), u_geo.z);
    o = max(o, cov(segD(q, tl, vec2(u_topEnd, u_geo.x)) - 2.2));
    o = max(o, cov(segD(q, bl, bl + vec2(u_inner + 40.0, 0.0)) - 2.2));
    c = over(vec4(line, 0.35 * exp(-abs(d) / 5.0) * (inY ? 1.0 : 0.0) * step(d, 0.0)), c);
    c = over(vec4(line, o), c);
    // the inner line: down the bracket from its top run to the bottom
    float il = (q.y > yTopI && q.y < u_geo.z - 6.0) ? cov(abs(d - u_inner) - 1.6) : 0.0;
    float xi = outerX(yTopI) + u_inner * sqrt(1.0 + outerSlope(yTopI) * outerSlope(yTopI));
    il = max(il, cov(segD(q, vec2(xi, yTopI), vec2(u_topEnd - 14.0, yTopI)) - 1.6));
    c = over(vec4(inner, 0.95 * il), c);
    return c;
}

// a two-tone slanted bar from the empty end b to the full end a, with a thin rail beside it
vec4 bar(vec2 p, vec4 s, float val, float zones, vec4 c) {
    vec2 a = s.xy, b = s.zw;
    float h = 1.0 - segH(p, a, b);
    vec2 dir = normalize(a - b), nrm = vec2(-dir.y, dir.x);
    float side = dot(p - b, nrm);
    float along = segD(p, a, b);
    if (along > 26.0) return c;
    float body = cov(abs(side) - 7.0) * cov(segD(p, a, b) - 7.5);
    vec3 col = vec3(0.92, 0.94, 0.97);
    if (zones > 0.5 && h > 0.88) col = vec3(1.0, 0.2, 0.22);
    if (zones > 0.5 && h < 0.1) col = vec3(0.25, 0.5, 1.0);
    c = over(vec4(0.36, 0.38, 0.44, 0.9 * body), c);
    c = over(vec4(col, body * step(h, val) * step(0.001, val)), c);
    c = over(vec4(0.5, 0.52, 0.58, 0.8 * cov(abs(side + 12.0) - 1.0) * cov(segD(p, a, b) - 13.0)), c);
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec2 pm = vec2(u_size.x - p.x, p.y);
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);

    c = bracket(p, u_speed, 2.0, 2.0, u_ticks.x, BLUE_LINE, BLUE_BAND, BLUE_LIT, BLUE_IN, c);
    c = bracket(pm, u_rpm, u_redFrom, u_orange, u_ticks.y, RED_LINE, RED_BAND, RED_LIT, RED_IN, c);
    // the map window: a rounded hole cut out of the backdrop and brackets, so BMW's map shows clean; the fuel and
    // oil bars and the bottom strip draw over it, as BMW's own Sport view lays them beside the map
    if (u_hole.z > 0.0) {
        vec2 hs = u_hole.zw * 0.5;
        vec2 q = abs(p - (u_hole.xy + hs)) - (hs - vec2(u_holeR));
        float hd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_holeR;
        c.a *= clamp(hd + 0.5, 0.0, 1.0);
    }
    c = bar(p, u_fuelSeg, u_fuel, 0.0, c);
    c = bar(p, u_oilSeg, u_oil, 1.0, c);
    // the bottom line between the brackets
    if (abs(p.y - u_geo.z) < 3.0 && abs(p.x - u_size.x * 0.5) < u_size.x * 0.5 - outerX(u_geo.z))
        c = over(vec4(mix(BLUE_LINE, RED_LINE, step(u_size.x * 0.5, p.x)) * 0.8, cov(abs(p.y - u_geo.z) - 1.2)), c);

    // bottom strip: slanted ends, blue left of the middle, red right, thin dividers
    float sy = p.y - u_strip.y;
    if (sy > -2.0 && sy < u_strip.z + 2.0) {
        float xl = u_strip.x + (u_strip.z - sy) / u_strip.z * u_strip.w;     // left end leans in at the top
        float dx = abs(p.x - u_size.x * 0.5), xe = u_size.x * 0.5 - xl;
        float inside = cov(dx - xe) * cov(-sy) * cov(sy - u_strip.z);
        float f = dx / xe;
        vec3 sc = p.x < u_size.x * 0.5 ? mix(vec3(0.06, 0.2, 0.62), vec3(0.15, 0.36, 0.92), f) : mix(vec3(0.4, 0.05, 0.1), vec3(0.85, 0.1, 0.16), f);
        c = over(vec4(sc, 0.95 * inside), c);
        float div = cov(abs(mod(p.x - (u_strip.z - sy) * 0.45, 150.0) - 75.0) - 73.8);
        c = over(vec4(0.02, 0.03, 0.08, 0.5 * inside * div), c);
        c = over(vec4(1.0, 1.0, 1.0, 0.25 * inside * cov(abs(sy) - 1.0)), c);
    }
    gl_FragColor = c;
}
`;


const ATEXT = `// Atlas text for a cluster-render "effect" layer (GLSL ES 1.00): u_cells equal cells across the layer, each
// showing one glyph of the R8 glyph atlas bound to u_font (u_grid.x columns by u_grid.y rows of cells), picked
// by the codes in u_text (32 codes, 4 to a vec4; below 0 = empty). A new value is one uniform message, no
// pixels. After robertnisipeanu/idrive-apps js/showcase.js (TEXT_FS). v_uv (0,0) is the top-left.
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_font;
uniform vec4 u_text[8];
uniform float u_cells;
uniform vec2 u_grid;
uniform vec4 u_color;

float code(float cell) {
    float slot = floor(cell / 4.0), lane = cell - slot * 4.0;
    vec4 v = u_text[0];
    for (int i = 1; i < 8; i++) if (float(i) == slot) v = u_text[i];
    return lane < 0.5 ? v.x : lane < 1.5 ? v.y : lane < 2.5 ? v.z : v.w;
}

void main() {
    float x = v_uv.x * u_cells;
    float c = code(floor(x));
    float col = mod(c, u_grid.x), row = floor(c / u_grid.x);
    vec2 uv = vec2((col + fract(x)) / u_grid.x, (row + v_uv.y) / u_grid.y);
    float ink = c < 0.0 ? 0.0 : texture2D(u_font, uv).r;
    gl_FragColor = vec4(u_color.rgb, u_color.a * ink);
}
`;

const E39DASH = `// Classic analog BMW E39 M5 (1998-2003) instrument cluster in one cluster-render "effect" layer (GLSL ES 1.00):
// Matte anthracite-grey E39 M5 gauge faces with concentric vinyl grain, 3D brushed aluminum/chrome Edition rings,
// crisp white/ivory scale markings with subtle warm backlight, the iconic E39 M5 variable pre-warning LED field
// recessed into the tachometer (driven by u_oil: cold oil lights orange from 4000 rpm, warming up retreats to 6500 rpm,
// redline at 7000..8000 rpm), in-dial //M5 badge, analog Oil Temperature sub-gauge, 3D tapered red-orange needles
// with drop shadows and stepped black/metallic hub caps, and the classic E39 High-OBC amber pixel-matrix bar at the bottom.
// Dial positions are shifted so BMW's hardware gear box (x:1406..1597, y:342..419) sits completely in the empty gap
// between the M5 Tachometer (right edge x=1380) and the Coolant Temp gauge (left edge x=1608).
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_speed;    // 0..1 (0..300 km/h)
uniform float u_rpm;      // 0..1 (0..8000 rpm)
uniform float u_fuel;     // 0..1
uniform float u_oil;      // 0..1 (50..150 C)
uniform float u_coolant;  // 0..1 (50..130 C)
uniform vec2 u_sel;       // (stageIdx 0..6 for 'PRND SM', gear 1..6)
uniform vec2 u_svc;       // (greenBars 0..5, dueState 0:ok, 1:due yellow, 2:overdue red+clock)
uniform vec4 u_ind;       // (dscActive 0..1, sportMode 0..1, shiftState 0..2, brakeOrTempWarn 0..2)
uniform float u_flash;    // 0: normal/on phase, 1: limiter/warning blink-off phase, 2: fast limiter strobe phase
uniform vec4 u_hole;      // optional map hole
uniform float u_holeR;
uniform float u_night;    // 0 day (white marks), 1 night (amber backlight)
uniform float u_v2;       // 1: version 2 (silver faces, orange-red needles, the car's three display windows)

const float PI = 3.14159265359;
const float D2R = 3.14159265359 / 180.0;
#define MARK_COL mix(vec3(0.937, 0.863, 0.761), vec3(1.0, 0.749, 0.388), u_night)
#define GLOW_COL vec3(1.0, 0.478, 0.063)

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}
float segD(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}
float sdRoundBox(vec2 p, vec4 b, float r) {
    vec2 hs = b.zw * 0.5;
    vec2 q = abs(p - (b.xy + hs)) - (hs - vec2(r));
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float cwAngleDeg(vec2 q) {
    return atan(q.x, -q.y) * 180.0 / PI;
}

// Draw a mark (tick or dot or icon) with dark drop shadow in Day mode and warm amber halo in Night mode
vec4 addMark(float d, vec4 c) {
    if (d > 6.5) return c;
    if (u_night > 0.5) {
        c = over(vec4(GLOW_COL, 0.42 * exp(-max(d, 0.0) / 2.6)), c);
        c = over(vec4(MARK_COL, cov(d)), c);
    } else {
        c = over(vec4(0.0, 0.0, 0.0, 0.35 * exp(-max(d - 0.4, 0.0) / 1.4)), c);
        c = over(vec4(MARK_COL, cov(d)), c);
    }
    return c;
}

float tickDist(vec2 q, float angDeg, float r0, float r1, float hw) {
    float a = angDeg * D2R;
    vec2 dir = vec2(sin(a), -cos(a));
    vec2 nrm = vec2(-dir.y, dir.x);
    float al = dot(q, dir);
    float sd = abs(dot(q, nrm));
    return max(sd - hw, max(r0 - al, al - r1));
}
float dotDist(vec2 q, float angDeg, float r, float rad) {
    float a = angDeg * D2R;
    vec2 pt = vec2(sin(a), -cos(a)) * r;
    return length(q - pt) - rad;
}

// 1:1 E39 M5 Bezel Ring + Dark Inner Collar + Slate-Blue/Warm-Amber Matte Face with Grain Noise
vec4 drawRingAndFace(vec2 p, vec2 center, float R, bool big, vec4 c) {
    vec2 q = p - center;
    float r = length(q);
    if (r > R + 18.0) return c;

    // 1. Deep outer cast shadow on the cluster panel
    float rs = length(q - vec2(0.0, 5.0));
    if (rs < R * 1.012 + 14.0) {
        c = over(vec4(0.0, 0.0, 0.0, 0.82 * exp(-max(rs - R * 1.005, 0.0) / 5.5)), c);
    }
    if (r > R + 1.0) return c;

    float ringIn = big ? 0.953 : 0.925;
    float rf = R * (ringIn - 0.012);

    // 2. Dial Face inside rf
    if (r <= rf + 1.0) {
        float t = clamp(length(q - vec2(-R * 0.05, R * 0.15)) / rf, 0.0, 1.0);
        vec3 f0 = mix(vec3(0.337, 0.376, 0.439), vec3(0.165, 0.082, 0.035), u_night); // #566070 / #2a1509
        vec3 f1 = mix(vec3(0.282, 0.318, 0.373), vec3(0.082, 0.043, 0.024), u_night); // #48515f / #150b06
        vec3 f2 = mix(vec3(0.200, 0.227, 0.271), vec3(0.031, 0.020, 0.016), u_night); // #333a45 / #080504
        vec3 fCol = t < 0.62 ? mix(f0, f1, t / 0.62) : mix(f1, f2, (t - 0.62) / 0.38);
        // Fine matte grain noise
        float gr = (hash12(floor(p)) - 0.5) * mix(0.055, 0.025, u_night);
        fCol = clamp(fCol + vec3(gr), 0.0, 1.0);

        // Top-lit recess shadow cast by the inner ring onto the sunken dial face
        float rSh = length(q - vec2(0.0, R * 0.035));
        float sh = smoothstep(rf * 0.86, rf * 1.02, rSh);
        fCol = mix(fCol, vec3(0.0), sh * mix(0.62, 0.80, u_night));

        // Night mode: warm amber ambient scatter around hub and along scale
        if (u_night > 0.5) {
            float nh1 = clamp(1.0 - (r - R * 0.10) / (R * 0.42), 0.0, 1.0);
            fCol += vec3(1.0, 0.47, 0.12) * (0.28 * nh1 * nh1);
            float nh2 = 1.0 - abs(r - R * 0.75) / (R * 0.20);
            if (nh2 > 0.0) fCol += vec3(1.0, 0.43, 0.08) * (0.10 * nh2);
        }
        c = over(vec4(fCol, cov(r - rf)), c);
    }

    // 3. Dark inner collar between bezel ring and dial face (rf .. R * ringIn)
    if (r >= rf - 1.0 && r <= R * ringIn + 1.0) {
        vec3 colCollar = mix(vec3(0.055, 0.059, 0.071), vec3(0.020, 0.012, 0.012), u_night);
        float dCollar = max(rf - r, r - R * ringIn);
        c = over(vec4(colCollar, cov(dCollar)), c);
    }

    // 4. Metallic Conical-Gradient Bezel Ring (R * ringIn .. R)
    if (r >= R * ringIn - 1.0) {
        float ang = atan(q.y, q.x) + PI * 0.75;
        float w = 0.5 + 0.32 * cos(ang * 2.0) + 0.18 * sin(ang * 3.0 - 0.7);
        vec3 rLight = mix(vec3(0.933, 0.945, 0.961), vec3(0.227, 0.165, 0.118), u_night);
        vec3 rDark  = mix(vec3(0.549, 0.569, 0.612), vec3(0.078, 0.055, 0.039), u_night);
        vec3 rCol = mix(rDark, rLight, clamp(w, 0.0, 1.0));

        // Radial bevel (inner shadow, ridge highlight at 0.55, outer shadow)
        float u = clamp((r - R * ringIn) / (R * (1.0 - ringIn)), 0.0, 1.0);
        float inSh = clamp(1.0 - u / 0.22, 0.0, 1.0) * 0.55;
        float outSh = clamp((u - 0.80) / 0.20, 0.0, 1.0) * 0.60;
        float ridge = max(0.0, 1.0 - abs(u - 0.55) / 0.25) * 0.20;
        rCol = mix(rCol + vec3(ridge), vec3(0.0), max(inSh, outSh));

        float dRing = max(R * ringIn - r, r - R);
        c = over(vec4(rCol, cov(dRing)), c);

        // Night mode: dashed amber scale reflection along inner edge of bezel ring
        if (u_night > 0.5) {
            float dRef = abs(r - R * (ringIn + 0.012)) - R * 0.006;
            if (dRef < 3.5) {
                float dash = smoothstep(-0.2, 0.3, sin(atan(q.y, q.x) * 36.0));
                c = over(vec4(1.0, 0.588, 0.196, 0.48 * dash * exp(-max(dRef, 0.0) / 1.5)), c);
            }
        }
    }
    return c;
}

// 3D Center Hub Cap (drawn before or after needle)
vec4 drawHub(vec2 q, float capR, vec4 c) {
    float r = length(q);
    if (r > capR + 8.0) return c;
    float rs = length(q - vec2(0.0, 2.5));
    c = over(vec4(0.0, 0.0, 0.0, 0.55 * exp(-max(rs - capR, 0.0) / 3.0)), c);
    if (r <= capR + 1.0) {
        float t = clamp(length(q - vec2(-capR * 0.3, -capR * 0.35)) / (capR * 1.1), 0.0, 1.0);
        vec3 h0 = mix(vec3(0.110, 0.118, 0.137), vec3(0.031, 0.024, 0.020), u_night);
        vec3 h1 = mix(vec3(0.047, 0.051, 0.063), vec3(0.008, 0.004, 0.004), u_night);
        c = over(vec4(mix(h0, h1, t), cov(r - capR)), c);
        vec3 rim = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.55, 0.24), u_night);
        float rimA = mix(0.06, 0.11, u_night);
        c = over(vec4(rim, rimA * cov(abs(r - (capR - 0.8)) - 0.6)), c);
    }
    return c;
}

// Authentic E39 M5 light-guide needle (drawn OVER hub cap in the real E39, with optional black stem on Oil needle)
vec4 drawE39Needle(vec2 q, float deg, float len, float tail, float w0, float w1, float stem, vec4 c) {
    float rad = deg * D2R;
    vec2 dir = vec2(sin(rad), -cos(rad));
    vec2 nrm = vec2(-dir.y, dir.x);

    // 1. Cast shadow onto dial face & hub (offset +2.5, +5.0)
    vec2 qs = q - vec2(2.5, 5.0);
    float alS = dot(qs, dir), sdS = abs(dot(qs, nrm));
    if (alS >= -tail - 4.0 && alS <= len + 4.0) {
        float ts = clamp((alS + tail) / (len + tail), 0.0, 1.0);
        float hws = mix(w0, w1, ts) * 0.5;
        float ds = max(sdS - hws, max(-alS - tail, alS - len));
        c = over(vec4(0.0, 0.0, 0.0, 0.38 * exp(-max(ds, 0.0) / 2.5)), c);
    }

    // 2. Needle body
    float al = dot(q, dir), sgnSd = dot(q, nrm), sd = abs(sgnSd);
    if (al >= -tail - 6.0 && al <= len + 6.0) {
        float t = clamp((al + tail) / (len + tail), 0.0, 1.0);
        float hw = mix(w0, w1, t) * 0.5;
        float d = max(sd - hw, max(-al - tail, al - len));
        if (u_night > 0.5 && d < 6.0) {
            c = over(vec4(1.0, 0.478, 0.094, 0.42 * exp(-max(d, 0.0) / 3.2)), c);
        }
        if (d < 1.0) {
            vec3 c0 = mix(vec3(1.0, 0.541, 0.259), vec3(1.0, 0.886, 0.659), u_night);
            vec3 c1 = mix(vec3(1.0, 0.478, 0.235), vec3(1.0, 0.816, 0.541), u_night);
            vec3 c2 = mix(vec3(0.847, 0.263, 0.165), vec3(1.0, 0.541, 0.227), u_night);
            vec3 nCol = t < 0.33 ? mix(c0, c1, t / 0.33) : mix(c1, c2, (t - 0.33) / 0.67);
            // Cross-wise light-guide sheen
            float u = (sgnSd / max(hw, 0.5)) * 0.5 + 0.5;
            float spec = max(0.0, 1.0 - abs(u - 0.35) / 0.22) * 0.22;
            float edgeDark = max(clamp((0.25 - u) / 0.25, 0.0, 1.0), clamp((u - 0.70) / 0.30, 0.0, 1.0)) * 0.28;
            nCol = mix(nCol + vec3(spec), vec3(0.0), edgeDark);
            // Black stem collar on oil needle
            if (stem > 0.0 && al <= stem) {
                nCol = mix(nCol, vec3(0.02, 0.02, 0.024), cov(al - stem));
            }
            c = over(vec4(nCol, cov(d)), c);
        }
    }
    return c;
}

// Vector Icons in GLSL (1:1 from e39_demo)
float sdOilCan(vec2 p, vec2 ctr, float w) {
    float u = w / 20.0;
    vec2 q = (p - (ctr - vec2(10.0 * u, 4.0 * u))) / u;
    if (q.x < -1.0 || q.x > 22.0 || q.y < -1.5 || q.y > 9.5) return 10.0;
    // Main oil can body (trapezoid + spout)
    float dBody = max(max(3.0 - q.y, q.y - 7.6), max(4.6 - q.x, q.x - 13.4));
    // Spout from (13.2, 3.0)..(13.4, 7.6) to (18.1, 1.4)
    float dSpout = segD(q, vec2(12.5, 5.2), vec2(18.1, 1.4)) - 1.1;
    // Cap on top
    float dCap = max(segD(q, vec2(9.5, 1.2), vec2(9.5, 3.2)) - 1.3, segD(q, vec2(7.2, 0.2), vec2(11.8, 0.2)) - 0.75);
    dCap = min(dCap, segD(q, vec2(7.2, 0.2), vec2(11.8, 0.2)) - 0.75);
    // Handle on left
    float dH1 = segD(q, vec2(4.6, 4.6), vec2(1.6, 3.2)) - 0.75;
    float dH2 = segD(q, vec2(1.6, 3.2), vec2(0.6, 4.6)) - 0.75;
    // Oil drop at tip
    float dDrop = length(q - vec2(19.6, 4.6)) - 0.9;
    return min(min(min(dBody, dSpout), min(dH1, dH2)), min(dDrop, segD(q, vec2(7.2, 0.4), vec2(11.8, 0.4)) - 0.75)) * u;
}

float sdThermo(vec2 p, vec2 ctr, float h, bool waves) {
    float u = h / 10.0;
    vec2 q = (p - ctr) / u;
    if (abs(q.x) > 9.0 || abs(q.y) > 8.0) return 10.0;
    float d = segD(q, vec2(0.0, -5.2), vec2(0.0, 2.6)) - 0.75;
    d = min(d, length(q - vec2(0.0, 3.6)) - 1.55);
    d = min(d, segD(q, vec2(0.4, -4.5), vec2(3.6, -4.5)) - 0.58);
    d = min(d, segD(q, vec2(0.4, -2.5), vec2(3.6, -2.5)) - 0.58);
    d = min(d, segD(q, vec2(0.4, -0.5), vec2(3.6, -0.5)) - 0.58);
    if (waves) {
        if (abs(q.x) >= 2.2 && abs(q.x) <= 7.2) {
            float wy1 = 3.1 + 0.45 * sin((abs(q.x) - 2.2) * 1.3);
            d = min(d, abs(q.y - wy1) - 0.52);
        }
        if (abs(q.x) <= 5.4) {
            float wy2 = 5.9 + 0.45 * sin(q.x * 1.2);
            d = min(d, abs(q.y - wy2) - 0.52);
        }
    }
    return d * u;
}

float sdPump(vec2 p, vec2 ctr, float h) {
    float u = h / 12.0;
    vec2 q = (p - ctr) / u;
    if (abs(q.x) > 8.5 || abs(q.y) > 8.0) return 10.0;
    float body = sdRoundBox(q, vec4(-4.6, -6.0, 7.4, 11.0), 0.8);
    float win = sdRoundBox(q, vec4(-3.3, -4.7, 4.8, 3.6), 0.2);
    body = max(body, -win);
    float base = sdRoundBox(q, vec4(-5.6, 5.0, 9.4, 1.2), 0.1);
    float hose = min(
        min(segD(q, vec2(2.8, -0.6), vec2(4.4, -0.6)), segD(q, vec2(4.4, -0.6), vec2(4.4, 3.8))),
        min(segD(q, vec2(4.4, 3.8), vec2(6.8, 3.8)), min(segD(q, vec2(6.8, 3.8), vec2(6.8, -2.6)), segD(q, vec2(6.8, -2.6), vec2(4.6, -5.0))))
    ) - 0.55;
    return min(min(body, base), hose) * u;
}

// Crisp slanted ///M logo on Speedometer (3 colored stripes + italic M polygon)
vec4 drawMLogo(vec2 p, vec2 ctr, float h, vec4 c) {
    float sk = 0.42, w = h * 0.36, gap = h * 0.02;
    float y0 = ctr.y - h * 0.5, y1 = ctr.y + h * 0.5;
    if (p.y < y0 - 1.5 || p.y > y1 + 1.5) return c;
    float xStart = ctr.x - h * 1.42;
    if (p.x < xStart - 4.0 || p.x > xStart + h * 3.4) return c;
    float dy = max(y0 - p.y, p.y - y1);
    float u = (y1 - p.y) / h; // 0 at bottom, 1 at top
    float al = mix(1.0, 0.55, u_night);

    // 3 slanted stripes
    for (int i = 0; i < 3; i++) {
        float xi = xStart + float(i) * (w + gap) + sk * h * u;
        float dx = max(xi - p.x, p.x - (xi + w));
        float d = max(dx, dy);
        if (d < 1.0) {
            vec3 sc = i == 0 ? mix(vec3(0.353, 0.643, 0.878), vec3(0.227, 0.353, 0.502), u_night)
                    : i == 1 ? mix(vec3(0.122, 0.247, 0.561), vec3(0.102, 0.165, 0.353), u_night)
                             : mix(vec3(0.878, 0.141, 0.180), vec3(0.690, 0.165, 0.118), u_night);
            c = over(vec4(sc, al * cov(d)), c);
        }
    }
    // Slanted 'M' in un-sheared coordinates: x' = p.x - sk * (y1 - p.y) - mx0
    float mx0 = xStart + 3.0 * (w + gap) + h * 0.42 - sk * h * 0.5;
    float lx = (p.x - sk * (ctr.y - p.y) - mx0) / h;
    float ly = (p.y - y0) / h; // 0 at top, 1 at bottom
    if (lx >= -0.05 && lx <= 1.48 && ly >= -0.05 && ly <= 1.05) {
        // Left vertical leg (0..0.34), Right vertical leg (1.08..1.42), V-diagonals meeting at (0.71, 0.52..1.0)
        float dL = max(max(-lx, lx - 0.33), max(-ly, ly - 1.0));
        float dR = max(max(1.09 - lx, lx - 1.42), max(-ly, ly - 1.0));
        float dVL = segD(vec2(lx, ly), vec2(0.24, 0.14), vec2(0.71, 0.84)) - 0.145;
        float dVR = segD(vec2(lx, ly), vec2(1.18, 0.14), vec2(0.71, 0.84)) - 0.145;
        float dM = max(min(min(dL, dR), min(dVL, dVR)), max(-ly, ly - 1.0)) * h;
        vec3 mCol = mix(vec3(0.875, 0.886, 0.902), vec3(0.478, 0.416, 0.353), u_night);
        c = over(vec4(mCol, al * cov(dM)), c);
    }
    return c;
}

// Main large E39 M5 dial (Speedo on left, M5 Tach with Oil Temp sub-gauge & pre-warning LED band on right)
vec4 mainDial(vec2 p, vec2 center, float R, float val, bool isTach, float subVal, vec4 c) {
    vec2 q = p - center;
    float r = length(q);
    if (r > R + 18.0) return c;

    // 1. Ring, Dark Inner Collar & Matte Slate-Blue / Night Face
    c = drawRingAndFace(p, center, R, true, c);

    float ang = cwAngleDeg(q);

    if (!isTach) {
        // ---- SPEEDOMETER (20..300 km/h, -128 deg at 20, +133 deg at 300) ----
        // Ticks & intermediate 10-km/h dots (10..300 km/h -> i = 1..30)
        if (r > R * 0.74 && r < R * 0.90) {
            float vApprox = 20.0 + (ang - (-128.0)) * (280.0 / 261.0);
            float idx = clamp(floor(vApprox / 10.0 + 0.5), 1.0, 30.0);
            float aTick = -128.0 + (idx * 10.0 - 20.0) * (261.0 / 280.0);
            float dM = 10.0;
            if (mod(idx, 2.0) < 0.5) {
                dM = tickDist(q, aTick, R * 0.77, R * 0.875, R * 0.0155);
            } else {
                dM = dotDist(q, aTick, R * 0.81, R * 0.0185);
            }
            c = addMark(dM, c);
        }
        // Stop pin below 20 km/h
        float aPin = (-128.0 - 20.0 * (261.0 / 280.0) - 6.0) * D2R;
        vec2 pPin = vec2(sin(aPin), -cos(aPin)) * (R * 0.62);
        c = over(vec4(0.027, 0.031, 0.039, cov(length(q - pPin) - R * 0.022)), c);

        // Slanted ///M logo at y + 0.43 R (hub & needle drawn in E39NEEDLES above dial numbers)
        c = drawMLogo(p, center + vec2(0.0, R * 0.43), R * 0.092, c);
    } else {
        // ---- TACHOMETER (0..8000 rpm, -124.6 deg at 0, +121 deg at 8000) ----
        // 1. Ticks 0..8 and intermediate 500-rpm dots
        if (r > R * 0.70 && r < R * 0.90) {
            float kApprox = (ang - (-124.6)) / 15.35;
            float k = clamp(floor(kApprox + 0.5), 0.0, 16.0);
            float aTick = -124.6 + k * 15.35;
            float dM = 10.0;
            if (mod(k, 2.0) < 0.5) {
                float r0 = k >= 13.5 ? R * 0.768 : R * 0.77;
                float r1 = abs(k - 14.0) < 0.5 ? R * 0.866 : R * 0.875;
                dM = tickDist(q, aTick, r0, r1, R * 0.0155);
            } else {
                float dr = (k >= 8.5 && k <= 15.5) ? R * 0.728 : R * 0.805;
                dM = dotDist(q, aTick, dr, R * 0.0195);
            }
            c = addMark(dM, c);
        }

        // 2. LED Pre-Warning & Shift-Light Band (4000..8000 rpm, 2 paired square LEDs per 1000 rpm = 8 segments, ro = 0.875 R)
        // Exactly like the real M Tachometer in the reference photos:
        //  - Every 1000 rpm block (4..5, 5..6, 6..7, 7..8) has TWO distinct square LED segments (one on each side of the 500-rpm dot)
        //    with a clean dark gap at every integer tick (4, 5, 6, 7, 8) and at every 500-rpm dot!
        //  - Oil temperature sets how many segments stay lit at the top end when cold; when warm (>= 90 C), the last 2 red LEDs (7000..8000)
        //    and the last amber LED (6500..7000) stay lit at low RPM.
        //  - As RPM approaches the redline (5500..7350 /min), the amber shift-light segments ignite progressively from top-to-bottom
        //    (6500 -> 6000 -> 5500 -> 5000 -> 4500 -> 4000), and at >= 7250 /min the top 4000..4500 segment lights up RED and the
        //    entire 8-segment band flashes at the rev limiter!
        if (ang >= -5.0 && ang <= 125.0 && r > R * 0.74 && r < R * 0.995) {
            float ro = R * 0.875;
            float th = R * 0.088; // uniform crisp square LED radial height across all 8 segments
            float ri = ro - th;

            // 8 paired square segments: idx = 0..7 for 4000..8000 rpm (each 500 rpm = 15.35 deg)
            float idx = clamp(floor((ang - (-1.8)) / 15.35), 0.0, 7.0);
            float mid = 4000.0 + (idx + 0.5) * 500.0;
            // Nudge each pair slightly toward its 500-rpm dot so the integer ticks (4, 5, 6, 7, 8) have wide clean gaps
            float shift = (mod(idx, 2.0) < 0.5 ? 1.0 : -1.0) * 0.55;
            float aMid = -124.6 + mid * 0.0307 + shift;
            float segA0 = aMid - 4.85;
            float segA1 = aMid + 4.85;

            float dAng = max(segA0 - ang, ang - segA1) * D2R * ro;
            float dRad = max(ri - r, r - ro);
            float dSeg = max(dAng, dRad);

            // 1. Oil-temperature baseline threshold (cold <=45C: idx >= 0 -> 4000 rpm; warm >=90C: idx >= 5 -> 6500 rpm, i.e. 1 amber + 2 red)
            float oilC = 50.0 + subVal * 100.0;
            float fWarm = clamp((oilC - 45.0) / 45.0, 0.0, 1.0);
            float oilIdx = floor(fWarm * 5.0 + 0.5); // 0..5

            // 2. Progressive RPM shift-light countdown as needle approaches the redline (5500 -> 7250 rpm)
            float rpmNow = clamp(val, 0.0, 1.0) * 8000.0;
            float rpmIdx = 7.0;
            if (rpmNow >= 7250.0) rpmIdx = 0.0;      // all 8 segments lit (including 4000..4500 red limiter LED!)
            else if (rpmNow >= 7050.0) rpmIdx = 1.0; // 4500..8000 lit
            else if (rpmNow >= 6850.0) rpmIdx = 2.0; // 5000..8000 lit
            else if (rpmNow >= 6600.0) rpmIdx = 3.0; // 5500..8000 lit
            else if (rpmNow >= 6250.0) rpmIdx = 4.0; // 6000..8000 lit
            else if (rpmNow >= 5500.0) rpmIdx = 5.0; // 6500..8000 lit

            float activeIdx = min(oilIdx, rpmIdx);
            bool isRedSeg = (idx >= 6.0) || (idx < 0.5 && rpmNow >= 7200.0); // bottom 2 LEDs (7000..8000) + top LED (4000..4500) at limiter are RED
            bool lit = isRedSeg || (idx >= activeIdx - 0.1);

            // Blink modulation when in the limiter / shift zone (u_flash > 0.5 is the brief pulse-dim phase)
            bool inShiftBlink = (rpmNow >= 7400.0) || (oilC < 75.0 && rpmNow >= 4000.0 + oilIdx * 500.0 + 200.0);
            float blinkDim = (inShiftBlink && u_flash > 0.5 && idx < 5.5) ? 0.35 : 1.0;

            if (!lit) {
                // Unlit dark matte window cell
                if (dSeg < 1.5) {
                    vec3 offCol = mix(vec3(0.180, 0.200, 0.235), vec3(0.043, 0.027, 0.024), u_night);
                    c = over(vec4(offCol, 0.85 * cov(dSeg)), c);
                    if (u_night < 0.5) {
                        c = over(vec4(0.0, 0.0, 0.0, 0.35 * cov(abs(dSeg) - 0.6)), c);
                    }
                }
            } else {
                // Lit LED segment: vivid red-coral for the red zone (7000..8000) & top limiter LED (4000..4500),
                // warm golden-amber for the pre-warning / shift-light segments (4500..7000)
                vec3 col = isRedSeg ? mix(vec3(1.0, 0.26, 0.22), vec3(1.0, 0.18, 0.16), u_night)
                                    : mix(vec3(1.0, 0.65, 0.12), vec3(1.0, 0.56, 0.08), u_night);
                vec3 core = isRedSeg ? vec3(1.0, 0.62, 0.52)
                                     : vec3(1.0, 0.86, 0.42);

                float eff = blinkDim;
                if (dSeg < 8.5) {
                    c = over(vec4(col, 0.44 * eff * exp(-max(dSeg, 0.0) / 3.4)), c);
                    c = over(vec4(col, eff * cov(dSeg)), c);
                    float dCore = max(dAng + 1.4, max((ro - th * 0.74) - r, r - (ro - th * 0.26)));
                    c = over(vec4(core, 0.65 * eff * cov(dCore)), c);
                }
                // Strong radial LED reflection on the inner wall of the silver bezel ring (matches the photos!)
                float dRefl = max(dAng - 0.8, abs(r - R * 0.962) - R * 0.024);
                if (dRefl < 6.5) {
                    vec3 reflCol = isRedSeg ? vec3(1.0, 0.20, 0.24) : vec3(1.0, 0.58, 0.10);
                    c = over(vec4(reflCol, (isRedSeg ? 0.78 : 0.65) * eff * exp(-max(dRefl, 0.0) / 2.4)), c);
                }
            }

            // Redraw integer ticks (4, 5, 6, 7, 8) and 500-rpm dots cleanly on top of any LED halo
            float kApprox = (ang - (-124.6)) / 15.35;
            float k = clamp(floor(kApprox + 0.5), 8.0, 16.0);
            float aTick = -124.6 + k * 15.35;
            float dM = 10.0;
            if (mod(k, 2.0) < 0.5) {
                float r0 = k >= 13.5 ? R * 0.768 : R * 0.77;
                float r1 = R * 0.875;
                dM = tickDist(q, aTick, r0, r1, R * 0.0155);
            } else {
                dM = dotDist(q, aTick, R * 0.728, R * 0.0195);
            }
            c = addMark(dM, c);
        }

        // 3. Oil Temp Sub-Dial (pivot at center + (0, 0.40 R), sweeping downwards 237 deg -> 123 deg)
        vec2 oilC = center + vec2(0.0, R * 0.40);
        vec2 oq = p - oilC;
        float orad = length(oq);
        if (orad < R * 0.62) {
            float dOil = min(
                min(tickDist(oq, 237.0, R * 0.455, R * 0.555, R * 0.013),
                    tickDist(oq, 123.0, R * 0.455, R * 0.555, R * 0.013)),
                tickDist(oq, 180.0, R * 0.405, R * 0.500, R * 0.013)
            );
            dOil = min(dOil, min(dotDist(oq, 208.5, R * 0.425, R * 0.0185),
                                 dotDist(oq, 151.5, R * 0.425, R * 0.0185)));
            dOil = min(dOil, sdOilCan(p, oilC + vec2(-R * 0.085, R * 0.205), R * 0.17));
            dOil = min(dOil, sdThermo(p, oilC + vec2(R * 0.118, R * 0.205), R * 0.085, false));
            c = addMark(dOil, c);

            // Oil stop pin at 244 deg, 0.36 R
            float aOPin = 244.0 * D2R;
            vec2 pOPin = vec2(sin(aOPin), -cos(aOPin)) * (R * 0.36);
            c = over(vec4(0.027, 0.031, 0.039, cov(length(oq - pOPin) - R * 0.020)), c);
        }

        // Main tach stop pin below 0 (hubs & needles drawn in E39NEEDLES above dial numbers)
        float aTPin = (-124.6 - 6.5) * D2R;
        vec2 pTPin = vec2(sin(aTPin), -cos(aTPin)) * (R * 0.60);
        c = over(vec4(0.027, 0.031, 0.039, cov(length(q - pTPin) - R * 0.022)), c);
    }
    return c;
}

// Small outer E39 M5 dials (Fuel on left, Coolant Temp on right) with lowered pivot (y + 0.44 R)
vec4 sideDial(vec2 p, vec2 center, float R, float val, bool isTemp, vec4 c) {
    vec2 q = p - center;
    float r = length(q);
    if (r > R + 16.0) return c;

    c = drawRingAndFace(p, center, R, false, c);

    vec2 piv = center + vec2(0.0, R * 0.44);
    vec2 pq = p - piv;

    if (isTemp) {
        // Slanted Blue (-45.5 deg) and Red (+45.5 deg) zone blocks around piv at 0.80 R
        for (int s = -1; s <= 1; s += 2) {
            float a = float(s) * 45.5 * D2R;
            vec2 dir = vec2(sin(a), -cos(a));
            vec2 nrm = vec2(-dir.y, dir.x);
            vec2 pt = piv + dir * (R * 0.80);
            vec2 lq = vec2(dot(p - pt, nrm), -dot(p - pt, dir));
            float dPatch = sdRoundBox(lq, vec4(-R * 0.085, -R * 0.085, R * 0.17, R * 0.20), R * 0.012);
            if (dPatch < 4.0) {
                vec3 pCol = s < 0 ? mix(vec3(0.153, 0.318, 0.561), vec3(0.169, 0.310, 0.604), u_night)
                                  : mix(vec3(0.812, 0.239, 0.200), vec3(1.0, 0.290, 0.196), u_night);
                if (u_night > 0.5) c = over(vec4(pCol, 0.35 * exp(-max(dPatch, 0.0) / 2.2)), c);
                c = over(vec4(pCol, cov(dPatch)), c);
            }
        }
        // Ticks, dots & Thermometer with waves
        float dM = min(tickDist(pq, -54.5, R * 0.74, R * 0.88, R * 0.014),
                       tickDist(pq,  54.5, R * 0.74, R * 0.88, R * 0.014));
        dM = min(dM, min(dotDist(pq, -18.0, R * 0.895, R * 0.033),
                         dotDist(pq,  18.0, R * 0.895, R * 0.033)));
        dM = min(dM, sdThermo(p, center + vec2(-R * 0.02, -R * 0.065), R * 0.20, true));
        c = addMark(dM, c);
    } else {
        // Fuel ticks, dots & Fuel Pump icon
        float dM = min(
            min(tickDist(pq, -54.0, R * 0.74, R * 0.88, R * 0.015),
                tickDist(pq,  54.0, R * 0.74, R * 0.88, R * 0.015)),
            tickDist(pq, 0.0, R * 0.80, R * 0.95, R * 0.015)
        );
        dM = min(dM, min(dotDist(pq, -27.0, R * 0.895, R * 0.033),
                         dotDist(pq,  27.0, R * 0.895, R * 0.033)));
        dM = min(dM, sdPump(p, center + vec2(R * 0.02, -R * 0.16), R * 0.26));
        c = addMark(dM, c);

        // Fuel reserve warning lamp (bottom-left of fuel dial: center + (-0.63 R, +0.17 R), radius 0.095 R)
        float dRes = length(q - vec2(-R * 0.63, R * 0.17)) - R * 0.095;
        if (dRes < 6.0) {
            if (val < 0.15) {
                vec3 rCol = vec3(1.0, 0.831, 0.0);
                c = over(vec4(rCol, 0.45 * exp(-max(dRes, 0.0) / 3.0)), c);
                c = over(vec4(rCol, cov(dRes)), c);
            } else {
                // Warm amber-yellow unlit lens in day mode, subtle in night mode
                vec3 rOff = mix(vec3(0.95, 0.76, 0.08), vec3(0.18, 0.12, 0.02), u_night);
                float aOff = mix(0.88, 0.22, u_night);
                c = over(vec4(rOff, aOff * cov(dRes)), c);
            }
        }
    }

    // Hub and needle are drawn in E39NEEDLES above dial numbers
    return c;
}

// Recessed Display Window
vec4 drawWin(vec2 p, vec4 rect, bool isLamp, vec4 c) {
    float d = sdRoundBox(p, rect, 5.0);
    if (d > 2.0) return c;
    vec3 bg = isLamp ? mix(vec3(0.047, 0.051, 0.059), vec3(0.020, 0.016, 0.016), u_night)
                     : mix(vec3(0.039, 0.031, 0.031), vec3(0.031, 0.016, 0.012), u_night);
    c = over(vec4(bg, cov(d)), c);
    float bAl = mix(0.05, 0.018, u_night);
    c = over(vec4(1.0, 1.0, 1.0, bAl * cov(abs(d) - 0.6)), c);
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    // 1. Page & Binnacle Dome Shell
    vec3 pageCol = mix(vec3(0.039, 0.043, 0.051), vec3(0.012, 0.012, 0.012), u_night);
    vec4 c = vec4(pageCol, 1.0);

    // Outer binnacle dome arch & inner matte panel
    vec2 archQ = (p - vec2(960.0, 520.0)) / vec2(945.0, 505.0);
    float dShell = p.y > 520.0 ? max(abs(p.x - 960.0) - 945.0, p.y - 696.0) : (length(archQ) - 1.0) * 500.0;
    if (dShell < 2.0) {
        float gy = clamp((p.y - 15.0) / 680.0, 0.0, 1.0);
        vec3 sh0 = mix(vec3(0.106, 0.114, 0.133), vec3(0.043, 0.035, 0.031), u_night);
        vec3 sh1 = mix(vec3(0.043, 0.047, 0.055), vec3(0.016, 0.012, 0.012), u_night);
        vec3 shCol = mix(sh0, sh1, 1.0 - abs(gy * 2.0 - 1.0));
        c = over(vec4(shCol, cov(dShell)), c);
        c = over(vec4(1.0, 1.0, 1.0, mix(0.07, 0.02, u_night) * cov(abs(dShell) - 0.8)), c);
    }

    vec2 panQ = (p - vec2(960.0, 515.0)) / vec2(912.0, 472.0);
    float dPan = p.y > 515.0 ? max(abs(p.x - 960.0) - 912.0, p.y - 664.0) : (length(panQ) - 1.0) * 470.0;
    if (dPan < 2.0) {
        float gy = clamp((p.y - 43.0) / 620.0, 0.0, 1.0);
        vec3 p0 = mix(vec3(0.086, 0.094, 0.110), vec3(0.035, 0.027, 0.024), u_night);
        vec3 p1 = mix(vec3(0.059, 0.063, 0.075), vec3(0.020, 0.016, 0.016), u_night);
        vec3 pCol = mix(p1, p0, 1.0 - abs(gy - 0.55) * 1.8);
        float gr = (hash12(floor(p)) - 0.5) * mix(0.018, 0.008, u_night);
        c = over(vec4(clamp(pCol + vec3(gr), 0.0, 1.0), cov(dPan)), c);
        c = over(vec4(0.0, 0.0, 0.0, 0.70 * cov(abs(dPan) - 1.2)), c);
    }

    // Horizontal display strip divider line (y = 538)
    if (p.x >= 110.0 && p.x <= 1810.0 && abs(p.y - 538.0) < 1.5) {
        c = over(vec4(mix(vec3(0.051, 0.055, 0.067), vec3(0.020, 0.016, 0.016), u_night), cov(abs(p.y - 538.0) - 0.8)), c);
    }

    // Indicator slots between main dials (Upper Shift/Sport slot top center, DSC/Brake/Temp bay bottom center)
    vec3 slotCol = mix(vec3(0.055, 0.059, 0.071), vec3(0.020, 0.016, 0.016), u_night);
    c = over(vec4(slotCol, cov(sdRoundBox(p, vec4(852.0, 110.0, 76.0, 52.0), 10.0))), c);
    c = over(vec4(slotCol, cov(sdRoundBox(p, vec4(800.0, 456.0, 180.0, 52.0), 8.0))), c);
    // Faint unlit indicator symbols (Turn signals, Shift chevron, DSC, Brake/Temp)
    float ghostA = mix(0.05, 0.02, u_night);
    // Left arrow at (358, 224), Right arrow at (1436, 224), clear of the main dial bezels
    for (int s = -1; s <= 1; s += 2) {
        vec2 ap = p - vec2(s < 0 ? 358.0 : 1436.0, 224.0);
        ap.x *= float(-s); // +x points toward arrow tip
        if (abs(ap.x) < 30.0 && abs(ap.y) < 26.0) {
            float dHead = max(max(-ap.x, ap.x - 24.0), abs(ap.y) - (24.0 - ap.x) * 0.90);
            float dTail = max(max(-22.0 - ap.x, -ap.x), abs(ap.y) - 10.0);
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(min(dHead, dTail))), c);
        }
    }
    // Upper center slot (890, 136): Shift-up chevron + M-Sport status bar (u_ind.y = sportMode, u_ind.z = shiftState 0..2)
    vec2 sp = p - vec2(890.0, 132.0);
    if (abs(sp.x) < 34.0 && abs(sp.y) < 24.0) {
        float dChv = min(segD(sp, vec2(-13.0, 3.0), vec2(0.0, -9.0)), segD(sp, vec2(0.0, -9.0), vec2(13.0, 3.0))) - 2.2;
        float dBar = sdRoundBox(sp, vec4(-18.0, 9.0, 36.0, 5.0), 1.5);
        float shSt = u_ind.z;
        bool shOn = shSt >= 0.5 && (shSt < 1.5 || u_flash < 0.5);
        if (shOn) {
            vec3 shCol = shSt >= 1.5 ? vec3(1.0, 0.22, 0.16) : vec3(1.0, 0.78, 0.14);
            c = over(vec4(shCol, 0.50 * exp(-max(dChv, 0.0) / 3.0)), c);
            c = over(vec4(shCol, cov(dChv)), c);
        } else {
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(dChv)), c);
        }
        if (u_ind.y >= 0.5) {
            vec3 spCol = vec3(0.45, 0.88, 0.28);
            c = over(vec4(spCol, 0.42 * exp(-max(dBar, 0.0) / 2.5)), c);
            c = over(vec4(spCol, cov(dBar)), c);
        } else {
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(dBar)), c);
        }
    }
    // Lower center bay: Left Brake/G-Load icon (834, 482), Center DSC triangle (890, 482), Right Oil/Temp check icon (946, 482)
    vec2 bp = p - vec2(834.0, 482.0);
    if (length(bp) < 20.0) {
        float dBC = min(abs(length(bp) - 11.5) - 1.2, abs(length(bp) - 15.0) - 1.1);
        dBC = max(dBC, -bp.y + 9.0);
        float dEx = min(segD(bp, vec2(0.0, -5.5), vec2(0.0, 1.5)) - 1.2, length(bp - vec2(0.0, 5.2)) - 1.3);
        float dBrk = min(abs(length(bp) - 11.5) - 1.2, dEx);
        if (u_ind.w >= 1.5) {
            vec3 bCol = vec3(1.0, 0.24, 0.18);
            c = over(vec4(bCol, 0.45 * exp(-max(dBrk, 0.0) / 2.6)), c);
            c = over(vec4(bCol, cov(dBrk)), c);
        } else {
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(dBrk)), c);
        }
    }
    vec2 dp = p - vec2(890.0, 482.0);
    if (length(dp) < 22.0) {
        float dC = abs(length(dp) - 16.5) - 1.3;
        float dT = min(min(segD(dp, vec2(0.0, -10.0), vec2(10.0, 7.0)), segD(dp, vec2(10.0, 7.0), vec2(-10.0, 7.0))), segD(dp, vec2(-10.0, 7.0), vec2(0.0, -10.0))) - 1.3;
        float dEx = min(segD(dp, vec2(0.0, -4.0), vec2(0.0, 1.5)) - 1.1, length(dp - vec2(0.0, 4.5)) - 1.1);
        float dDsc = min(dC, min(dT, dEx));
        if (u_ind.x >= 0.5) {
            vec3 dCol = vec3(1.0, 0.78, 0.12);
            c = over(vec4(dCol, 0.48 * exp(-max(dDsc, 0.0) / 2.8)), c);
            c = over(vec4(dCol, cov(dDsc)), c);
        } else {
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(dDsc)), c);
        }
    }
    vec2 tp = p - vec2(946.0, 482.0);
    if (length(tp) < 20.0) {
        float dTh = sdThermo(p, vec2(946.0, 482.0), 16.0, true);
        if (u_ind.w >= 0.5 && u_ind.w < 1.5) {
            vec3 tCol = vec3(1.0, 0.62, 0.14);
            c = over(vec4(tCol, 0.44 * exp(-max(dTh, 0.0) / 2.5)), c);
            c = over(vec4(tCol, cov(dTh)), c);
        } else {
            c = over(vec4(1.0, 1.0, 1.0, ghostA * cov(dTh)), c);
        }
    }

    // Two physical 3D reset buttons at (392, 486) and (1388, 486), well clear of the main dial bezels
    for (int bi = 0; bi < 2; bi++) {
        vec2 bc = vec2(bi == 0 ? 392.0 : 1388.0, 486.0);
        float br = length(p - bc);
        if (br < 30.0) {
            c = over(vec4(0.0, 0.0, 0.0, cov(length(p - (bc + vec2(0.0, 2.5))) - 24.0)), c);
            float bt = clamp(length(p - (bc - vec2(6.5, 7.0))) / 23.0, 0.0, 1.0);
            vec3 b0 = mix(vec3(0.290, 0.302, 0.333), vec3(0.165, 0.102, 0.063), u_night);
            vec3 b1 = mix(vec3(0.110, 0.114, 0.129), vec3(0.047, 0.031, 0.027), u_night);
            vec3 b2 = mix(vec3(0.024, 0.024, 0.027), vec3(0.008, 0.008, 0.008), u_night);
            vec3 bCol = bt < 0.5 ? mix(b0, b1, bt * 2.0) : mix(b1, b2, (bt - 0.5) * 2.0);
            c = over(vec4(bCol, cov(br - 21.0)), c);
        }
    }

    // 2. Display Strip Windows (y: 548..634, well above BELT y=663)
    vec4 wSvc  = vec4(338.0, 548.0, 226.0, 86.0);
    vec4 wLcd  = vec4(574.0, 548.0, 626.0, 86.0);
    vec4 wGear = vec4(1210.0, 548.0, 168.0, 86.0);
    vec4 wLamp = vec4(1388.0, 548.0, 240.0, 86.0);
    c = drawWin(p, wSvc,  false, c);
    c = drawWin(p, wLcd,  false, c);
    c = drawWin(p, wGear, false, c);
    c = drawWin(p, wLamp, false, c);

    // Service interval window details (5 green bars with top brackets + yellow due bar + red overdue bar + clock box + OILSERVICE / INSPECTION cell boxes)
    if (p.x >= 344.0 && p.x <= 558.0 && p.y >= 552.0 && p.y <= 630.0) {
        float greenBars = floor(u_svc.x + 0.5);
        float dueState = floor(u_svc.y + 0.5); // 0: ok, 1: due soon (yellow), 2: overdue (yellow + red + clock)
        vec3 ambLine = vec3(1.0, 0.58, 0.25);
        vec3 cellBg = vec3(0.88, 0.24, 0.14);
        float cellAl = dueState >= 0.5 ? mix(0.28, 0.34, u_night) : mix(0.08, 0.14, u_night);

        // Faint warm reddish-orange LCD cell backdrops (top 5-bar strip, left clock square, top OILSERVICE bar, bottom INSPECTION bar)
        float dBgCells = min(
            min(sdRoundBox(p, vec4(351.0, 556.0, 112.0, 13.0), 0.5),
                sdRoundBox(p, vec4(351.0, 579.0, 34.0, 46.0), 0.5)),
            min(sdRoundBox(p, vec4(389.0, 579.0, 164.0, 21.0), 0.5),
                sdRoundBox(p, vec4(389.0, 604.0, 164.0, 21.0), 0.5))
        );
        c = over(vec4(cellBg, cellAl * cov(dBgCells)), c);

        for (int si = 0; si < 7; si++) {
            float sx = 352.0 + float(si) * 23.5;
            float dB = sdRoundBox(p, vec4(sx, 557.0, 17.5, 11.5), 0.8);
            if (si < 5) {
                // Top amber bracket line above each of the 5 green bar slots (with left vertical tick on slot 0, as in the real E39 LCD!)
                float dTop = segD(p, vec2(sx, 554.5), vec2(sx + 17.5, 554.5)) - 0.95;
                if (si == 0) {
                    dTop = min(dTop, segD(p, vec2(sx, 554.5), vec2(sx, 568.5)) - 0.95);
                }
                c = over(vec4(ambLine, 0.85 * cov(dTop)), c);

                bool gLit = float(si) < greenBars - 0.1;
                if (gLit) {
                    vec3 gCol = vec3(0.498, 0.878, 0.290);
                    c = over(vec4(gCol, 0.38 * exp(-max(dB, 0.0) / 2.2)), c);
                    c = over(vec4(gCol, cov(dB)), c);
                }
            } else if (si == 5) {
                // Top yellow frame line always visible; full glowing yellow LED block lights up when service is due (dueState >= 1)
                float dY = segD(p, vec2(sx, 554.5), vec2(sx + 18.0, 554.5)) - 1.0;
                c = over(vec4(1.0, 0.824, 0.118, 0.88 * cov(dY)), c);
                if (dueState >= 0.5) {
                    vec3 yCol = vec3(1.0, 0.86, 0.28);
                    c = over(vec4(yCol, 0.52 * exp(-max(dB, 0.0) / 2.8)), c);
                    c = over(vec4(yCol, cov(dB)), c);
                } else {
                    c = over(vec4(0.24, 0.18, 0.05, 0.45 * cov(dB)), c);
                }
            } else {
                // Top/right corner bracket always visible; full glowing red-orange LED block lights up when overdue (dueState >= 2)
                float dP = min(segD(p, vec2(sx - 1.5, 554.5), vec2(sx + 17.5, 554.5)),
                               segD(p, vec2(sx + 17.5, 554.5), vec2(sx + 17.5, 568.5))) - 1.0;
                c = over(vec4(1.0, 0.353, 0.627, 0.90 * cov(dP)), c);
                if (dueState >= 1.5) {
                    vec3 rCol = vec3(1.0, 0.38, 0.28);
                    c = over(vec4(rCol, 0.55 * exp(-max(dB, 0.0) / 2.8)), c);
                    c = over(vec4(rCol, cov(dB)), c);
                } else {
                    c = over(vec4(0.24, 0.07, 0.09, 0.45 * cov(dB)), c);
                }
            }
        }
        // Clock box & clock icon (unlit ghost amber normally; bright glowing amber when service/inspection is due!)
        bool clkLit = dueState >= 0.5;
        vec3 gAmb = clkLit ? vec3(1.0, 0.58, 0.26) : vec3(1.0, 0.33, 0.14);
        float gAl = clkLit ? 0.95 : mix(0.16, 0.22, u_night);
        float dBox = abs(sdRoundBox(p, vec4(351.0, 579.0, 34.0, 46.0), 0.5)) - (clkLit ? 1.15 : 0.9);
        vec2 clk = p - vec2(368.0, 602.0);
        float dClk = min(abs(length(clk) - 10.0) - (clkLit ? 1.15 : 0.9),
                         min(segD(clk, vec2(0.0, -6.5), vec2(0.0, 0.0)), segD(clk, vec2(0.0, 0.0), vec2(5.5, 0.0))) - (clkLit ? 1.15 : 0.9));
        float dSym = min(dBox, dClk);
        if (clkLit && dSym < 4.5) {
            c = over(vec4(1.0, 0.38, 0.10, 0.42 * exp(-max(dSym, 0.0) / 2.4)), c);
        }
        c = over(vec4(gAmb, gAl * cov(dSym)), c);
    }

    // Main LCD window subtle orange cell backdrop boxes (odo, km+trip, outside temp, 20-char bottom message)
    if (p.x >= 580.0 && p.x <= 1196.0 && p.y >= 550.0 && p.y <= 632.0) {
        vec3 cellCol = vec3(1.0, 0.25, 0.10);
        float cellA = mix(0.045, 0.15, u_night);
        float dCells = min(
            min(sdRoundBox(p, vec4(602.0, 553.0, 108.0, 28.0), 1.0),
                sdRoundBox(p, vec4(808.0, 553.0, 130.0, 28.0), 1.0)),
            min(sdRoundBox(p, vec4(1042.0, 553.0, 126.0, 28.0), 1.0),
                sdRoundBox(p, vec4(662.0, 591.0, 450.0, 38.0), 1.0))
        );
        c = over(vec4(cellCol, cellA * cov(dCells)), c);
    }

    // Gear window active selector & gear orange glowing highlight boxes
    // Top row 'PRND SM' at x = 1234, y = 556, char pitch = 17 px (indices 0..6)
    // Bottom row '654321' at x = 1242, y = 596, char pitch = 17 px (gear 6->0, 5->1, ..., 1->5)
    if (p.x >= 1214.0 && p.x <= 1374.0 && p.y >= 550.0 && p.y <= 632.0) {
        vec3 onCol = mix(vec3(1.0, 0.455, 0.282), vec3(1.0, 0.604, 0.353), u_night);
        float stg = floor(u_sel.x + 0.5);
        if (stg >= 0.0 && stg <= 6.0 && abs(stg - 4.0) > 0.2) {
            float bx = 1234.0 + stg * 17.0 - 2.0;
            float dSel = sdRoundBox(p, vec4(bx, 555.0, 18.0, 26.0), 2.0);
            c = over(vec4(onCol, 0.45 * exp(-max(dSel, 0.0) / 3.2)), c);
            c = over(vec4(onCol, cov(dSel)), c);
        }
        float gr = floor(u_sel.y + 0.5);
        if (gr >= 1.0 && gr <= 8.0) {
            float gx = 1226.0 + (gr - 1.0) * 17.0 - 2.0;
            float dGr = sdRoundBox(p, vec4(gx, 595.0, 18.0, 26.0), 2.0);
            c = over(vec4(onCol, 0.45 * exp(-max(dGr, 0.0) / 3.2)), c);
            c = over(vec4(onCol, cov(dGr)), c);
        }
    }

    // 4th bottom-right M-Telemetry / TPMS LCD window cell backdrops (x: 1388..1628, y: 548..634)
    if (p.x >= 1392.0 && p.x <= 1624.0 && p.y >= 550.0 && p.y <= 632.0) {
        vec3 cellCol = vec3(1.0, 0.25, 0.10);
        float cellA = mix(0.055, 0.16, u_night);
        float dTCells = min(
            sdRoundBox(p, vec4(1396.0, 554.0, 224.0, 27.0), 1.0),
            sdRoundBox(p, vec4(1396.0, 592.0, 224.0, 34.0), 1.0)
        );
        c = over(vec4(cellCol, cellA * cov(dTCells)), c);
    }

    // 3. Four E39 M5 Analog Dials (100% clear of BMW's BLACK_BOX at x:1406..1597, y:342..419)
    c = sideDial(p, vec2(245.0, 398.0), 118.0, u_fuel, false, c);
    c = sideDial(p, vec2(1735.0, 398.0), 118.0, u_coolant, true, c);
    c = mainDial(p, vec2(625.0, 295.0), 214.0, u_speed, false, 0.0, c);
    c = mainDial(p, vec2(1155.0, 295.0), 214.0, u_rpm, true, u_oil, c);

    // 4. Subtle cover glass diagonal reflection
    float gLine = (p.x - 250.0) * 0.65 + (p.y - 80.0);
    if (gLine > 0.0 && gLine < 420.0 && dShell < 0.0) {
        float gAl = sin(gLine / 420.0 * PI) * mix(0.032, 0.010, u_night);
        c = over(vec4(mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.78, 0.62), u_night), gAl), c);
    }

    gl_FragColor = c;
}
`;

// E39NEEDLES: Overlay effect layer (z: 10, class: 'overlay') rendering all 5 E39 M5 needles,
// drop shadows, and 3D center hub caps ON TOP OF the dial numbers and labels (z: 5).
const E39NEEDLES = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform float u_speed;
uniform float u_rpm;
uniform float u_fuel;
uniform float u_oil;
uniform float u_coolant;
uniform float u_night;

const float PI = 3.14159265359;
const float D2R = 3.14159265359 / 180.0;

float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
vec4 over(vec4 top, vec4 under) {
    float a = top.a + under.a * (1.0 - top.a);
    if (a <= 0.0) return vec4(0.0);
    return vec4((top.rgb * top.a + under.rgb * under.a * (1.0 - top.a)) / a, a);
}

vec4 drawHub(vec2 q, float capR, vec4 c) {
    float r = length(q);
    if (r > capR + 8.0) return c;
    float rs = length(q - vec2(0.0, 2.5));
    c = over(vec4(0.0, 0.0, 0.0, 0.55 * exp(-max(rs - capR, 0.0) / 3.0)), c);
    if (r <= capR + 1.0) {
        float t = clamp(length(q - vec2(-capR * 0.3, -capR * 0.35)) / (capR * 1.1), 0.0, 1.0);
        vec3 h0 = mix(vec3(0.110, 0.118, 0.137), vec3(0.031, 0.024, 0.020), u_night);
        vec3 h1 = mix(vec3(0.047, 0.051, 0.063), vec3(0.008, 0.004, 0.004), u_night);
        c = over(vec4(mix(h0, h1, t), cov(r - capR)), c);
        vec3 rim = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.55, 0.24), u_night);
        float rimA = mix(0.06, 0.11, u_night);
        c = over(vec4(rim, rimA * cov(abs(r - (capR - 0.8)) - 0.6)), c);
    }
    return c;
}

vec4 drawE39Needle(vec2 q, float deg, float len, float tail, float w0, float w1, float stem, vec4 c) {
    float rad = deg * D2R;
    vec2 dir = vec2(sin(rad), -cos(rad));
    vec2 nrm = vec2(-dir.y, dir.x);

    // 1. Cast shadow onto dial face & numbers (offset +2.5, +5.0)
    vec2 qs = q - vec2(2.5, 5.0);
    float alS = dot(qs, dir), sdS = abs(dot(qs, nrm));
    if (alS >= -tail - 4.0 && alS <= len + 4.0) {
        float ts = clamp((alS + tail) / (len + tail), 0.0, 1.0);
        float hws = mix(w0, w1, ts) * 0.5;
        float ds = max(sdS - hws, max(-alS - tail, alS - len));
        c = over(vec4(0.0, 0.0, 0.0, 0.42 * exp(-max(ds, 0.0) / 2.5)), c);
    }

    // 2. Needle body
    float al = dot(q, dir), sgnSd = dot(q, nrm), sd = abs(sgnSd);
    if (al >= -tail - 6.0 && al <= len + 6.0) {
        float t = clamp((al + tail) / (len + tail), 0.0, 1.0);
        float hw = mix(w0, w1, t) * 0.5;
        float d = max(sd - hw, max(-al - tail, al - len));
        if (u_night > 0.5 && d < 6.0) {
            c = over(vec4(1.0, 0.478, 0.094, 0.42 * exp(-max(d, 0.0) / 3.2)), c);
        }
        if (d < 1.0) {
            vec3 c0 = mix(vec3(1.0, 0.541, 0.259), vec3(1.0, 0.886, 0.659), u_night);
            vec3 c1 = mix(vec3(1.0, 0.478, 0.235), vec3(1.0, 0.816, 0.541), u_night);
            vec3 c2 = mix(vec3(0.847, 0.263, 0.165), vec3(1.0, 0.541, 0.227), u_night);
            vec3 nCol = t < 0.33 ? mix(c0, c1, t / 0.33) : mix(c1, c2, (t - 0.33) / 0.67);
            float u = (sgnSd / max(hw, 0.5)) * 0.5 + 0.5;
            float spec = max(0.0, 1.0 - abs(u - 0.35) / 0.22) * 0.22;
            float edgeDark = max(clamp((0.25 - u) / 0.25, 0.0, 1.0), clamp((u - 0.70) / 0.30, 0.0, 1.0)) * 0.28;
            nCol = mix(nCol + vec3(spec), vec3(0.0), edgeDark);
            if (stem > 0.0 && al <= stem) {
                nCol = mix(nCol, vec3(0.02, 0.02, 0.024), cov(al - stem));
            }
            c = over(vec4(nCol, cov(d)), c);
        }
    }
    return c;
}

void main() {
    vec2 p = v_uv * u_size;
    vec4 c = vec4(0.0);

    // 1. Left Fuel Dial Needle (center 245, 398, R = 118, lowered pivot y + 0.44 R)
    vec2 fC = vec2(245.0, 398.0);
    float fR = 118.0;
    if (length(p - fC) <= fR * 0.913 + 0.5) {
        vec2 fpq = p - (fC + vec2(0.0, fR * 0.44));
        c = drawHub(fpq, fR * 0.235, c);
        float fAng = -54.0 + clamp(u_fuel, 0.0, 1.0) * 108.0;
        c = drawE39Needle(fpq, fAng, fR * 0.90, fR * 0.20, fR * 0.068, fR * 0.040, 0.0, c);
    }

    // 2. Right Coolant Dial Needle (center 1735, 398, R = 118, lowered pivot y + 0.44 R)
    vec2 cC = vec2(1735.0, 398.0);
    if (length(p - cC) <= fR * 0.913 + 0.5) {
        vec2 cpq = p - (cC + vec2(0.0, fR * 0.44));
        c = drawHub(cpq, fR * 0.235, c);
        float cAng = -54.0 + clamp(u_coolant, 0.0, 1.0) * 108.0;
        c = drawE39Needle(cpq, cAng, fR * 0.90, fR * 0.20, fR * 0.068, fR * 0.040, 0.0, c);
    }

    // 3. Main Speedometer Needle (center 625, 295, R = 214)
    vec2 sC = vec2(625.0, 295.0);
    float mR = 214.0;
    vec2 sq = p - sC;
    if (length(sq) <= mR * 0.92) {
        c = drawHub(sq, mR * 0.162, c);
        float spdKmh = max(u_speed * 300.0, 4.0);
        float sAng = -128.0 + (spdKmh - 20.0) * (261.0 / 280.0);
        c = drawE39Needle(sq, sAng, mR * 0.865, mR * 0.205, mR * 0.04, mR * 0.021, 0.0, c);
    }

    // 4. Main Tachometer + Oil Temp Sub-Dial Needles (center 1155, 295, R = 214)
    vec2 tC = vec2(1155.0, 295.0);
    vec2 tq = p - tC;
    if (length(tq) <= mR * 0.92) {
        vec2 oq = p - (tC + vec2(0.0, mR * 0.40));
        c = drawHub(tq, mR * 0.162, c);
        c = drawHub(oq, mR * 0.122, c);
        float oilAng = 237.0 - clamp(u_oil, 0.0, 1.0) * 114.0;
        c = drawE39Needle(oq, oilAng, mR * 0.555, -mR * 0.105, mR * 0.034, mR * 0.020, mR * 0.19, c);
        float taAng = -124.6 + clamp(u_rpm, 0.0, 1.0) * 8000.0 * 0.0307;
        c = drawE39Needle(tq, taAng, mR * 0.865, mR * 0.205, mR * 0.04, mR * 0.021, 0.0, c);
    }

    gl_FragColor = c;
}
`;

module.exports = { shiftbar: SHIFTBAR, arc: ARC, revbar: REVBAR, lights: LIGHTS, fill: FILL, box: BOX, grid: GRID, segbar: SEGBAR, mdash: MDASH, mtach: MTACH, sdash: SDASH, e39dash: E39DASH, e39needles: E39NEEDLES, boxes: BOXES, atext: ATEXT };
