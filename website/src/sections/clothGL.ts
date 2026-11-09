/**
 * The cloth behind the Care section, drawn live with WebGL so that water, suds and drying can move.
 *
 * One fragment shader composes the cotton (weave, creases, dirt, the iron's track) and everything that
 * happens to it:
 *   soak   water wicks through the fibres from where the cloth went in, darkening it, the wet front
 *          ragged at the scale of the threads
 *   water  the surface over it: a slow swell and rings spreading from where it went in, refracting the
 *          cloth beneath, with caustic light and glints on the crests; the visitor's pointer drags
 *          ripples through it, and a click or tap drops a bigger ring
 *   air    the air trapped in the weave escapes as small bubbles that swell, drift and burst
 *   foam   suds that gather in drifting clusters of packed bubbles which swell, burst and re-form
 *   dirt   lifts off in a cloud that billows away and thins
 *   dry    the damp leaves it unevenly, the raised folds first, a faint tide line at the edge and wisps
 *          rising off the last damp patches, until it is matte, light and crisp
 *
 * The timeline drives the uniforms in `u`; time keeps the water and suds alive between steps.
 */

export type ClothState = {
  /** 0 the creases it came in with → 1 the new lie after the wash */
  fold: number;
  /** how much of the dirt is still on it */
  dirt: number;
  /** the dirt lifting off into the water */
  lift: number;
  /** the water wicking through it */
  soak: number;
  /** the water over it */
  water: number;
  /** the rings from where it went in, spreading out */
  ring: number;
  /** suds gathering */
  foam: number;
  /** suds bursting away */
  pop: number;
  /** drying */
  dry: number;
  /** dry, crisp fibres */
  fluff: number;
  /** the stains thrown on as it is collected: 0 none yet → 1 all of them landed */
  stain: number;
  /** the stains washing out */
  clean: number;
  /** lowered into the water: 0 the waterline below it → 1 under all over */
  dip: number;
};

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec4 uCov;
uniform float uTile;
uniform sampler2D uWeave;
uniform sampler2D uCrumple;
uniform sampler2D uWashed;
uniform sampler2D uDirtT;
uniform sampler2D uPressT;
uniform float uFold, uDirt, uLift, uSoak, uWater, uRing, uFoam, uPop, uDry, uFluff, uStain, uClean, uDip;
// ripples from the pointer: x, y (px), the time it touched, strength
uniform vec4 uDrops[12];
uniform int uNDrops;

const float PI = 3.14159265;
const vec2 C1 = vec2(0.66, 0.38);
const vec2 C2 = vec2(0.24, 0.72);

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s / 0.97;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(5.3, 1.3); a *= 0.5; }
  return s / 0.875;
}

// ---- the water's surface ----------------------------------------------------------------------------------
// value noise with its slope: x = value, yz = d/dp
vec3 vnoised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}
// a ring spreading out from c: its height and slope
vec3 ringWave(vec2 p, vec2 c, float front, float amp, float soft, float decay, float freq) {
  vec2 dp = p - c;
  float L = max(length(dp), 0.001);
  float behind = front - L;
  float env = smoothstep(-soft, soft * 0.33, behind) * exp(-max(behind, 0.0) / decay);
  float a = amp * env;
  return a * vec3(sin(behind * freq), -cos(behind * freq) * freq * dp / L);
}
// the water's height (x) and its slope (yz), worked out together so it is evaluated once per pixel
vec3 water(vec2 p, float dd) {
  float t = uTime;
  vec2 k1 = vec2(0.0115, 0.0068), k2 = vec2(-0.0062, 0.0128), k3 = vec2(0.0190, -0.0105);
  float a1 = dot(p, k1) + t * 0.85, a2 = dot(p, k2) + t * 1.07, a3 = dot(p, k3) - t * 1.36;
  vec3 h = vec3(sin(a1), cos(a1) * k1) * 3.0 + vec3(sin(a2), cos(a2) * k2) * 2.4 + vec3(sin(a3), cos(a3) * k3) * 1.1;
  vec2 q = p / 150.0 + vec2(t * 0.07, -t * 0.05);
  vec3 n = vec3(0.0);
  float a = 0.5, sc = 1.0 / 150.0;
  for (int i = 0; i < 3; i++) {
    vec3 v = vnoised(q);
    n += a * vec3(v.x, v.yz * sc);
    q = q * 2.07 + vec2(5.3, 1.3);
    sc *= 2.07;
    a *= 0.5;
  }
  h += vec3(n.x / 0.875 - 0.5, n.yz / 0.875) * 5.0;
  // small ripples running off the waterline as it is lowered in
  if (dd > 0.0 && dd < 600.0 && uDip < 0.999) {
    float k = 0.075, e = exp(-dd / 130.0) * 1.5 * (1.0 - smoothstep(0.85, 1.0, uDip));
    h += e * vec3(sin(dd * k - t * 5.5), 0.0, cos(dd * k - t * 5.5) * k);
  }
  float fade = 1.0 - uRing;
  if (fade > 0.001) {
    float R = length(uRes) * 1.05;
    h += ringWave(p, C1 * uRes, uRing * R, 1.6 * fade, 30.0, 240.0, 0.06);
    h += ringWave(p, C2 * uRes, max(uRing - 0.1, 0.0) * R, 1.1 * fade, 30.0, 240.0, 0.06);
  }
  for (int i = 0; i < 12; i++) {
    if (i >= uNDrops) break;
    vec4 d = uDrops[i];
    float age = t - d.z;
    if (age < 0.0) continue;
    h += ringWave(p, d.xy, age * 260.0, d.w * 2.4 * exp(-age * 1.05), 18.0, 110.0, 0.085);
  }
  return h;
}

// a well-known iterative pattern for the light that water focuses onto what lies beneath it
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// ---- the cotton -------------------------------------------------------------------------------------------
vec3 softLight(vec3 b, float s) {
  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
float creaseAt(vec2 q) {
  vec2 uv = q * uCov.xy + uCov.zw;
  float cr = texture(uCrumple, uv).r;
  float wa = texture(uWashed, uv).r;
  float pr = texture(uPressT, q / uRes).r;
  wa = mix(wa, 0.5, pr);
  return mix(cr, wa, uFold);
}

// ---- bubbles ----------------------------------------------------------------------------------------------
// the two nearest of a field of drifting points: x = F1, y = F2, zw = the nearest point's cell
vec4 voronoi(vec2 g, float t, float seed, out vec2 rel) {
  vec2 ip = floor(g);
  vec2 fp = fract(g);
  float f1 = 9.0, f2 = 9.0;
  vec2 id = vec2(0.0);
  rel = vec2(0.0);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 n = vec2(float(i), float(j));
      vec2 h = hash2(ip + n + seed);
      vec2 o = 0.5 + 0.36 * sin(t * (0.35 + 0.4 * h.yx) + 6.2831 * h);
      vec2 r = n + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = ip + n; rel = r; }
      else if (d < f2) { f2 = d; }
    }
  return vec4(sqrt(f1), sqrt(f2), id);
}

// one round bubble: its shading over what lies under it. under = 1 for one still under water (silvery,
// dark rimmed), 0 for one sitting on the surface (clear, with a bright film)
vec3 bubble(vec3 col, vec2 d, float r, float under) {
  float q = length(d) / r;
  if (q > 1.25) return col;
  // its shadow, a little down and to the right
  float sh = 1.0 - smoothstep(0.6, 1.25, length(d - vec2(0.25, 0.35) * r) / r);
  col *= 1.0 - sh * 0.10 * (1.0 - step(q, 1.0));
  if (q > 1.0) return col;
  float rim = smoothstep(0.72, 0.97, q) * (1.0 - smoothstep(0.97, 1.0, q));
  vec2 s = d / r - vec2(-0.36, -0.40);
  float spot = smoothstep(0.30, 0.0, length(s * vec2(1.0, 1.4)));
  float lower = smoothstep(0.35, 0.0, length(d / r - vec2(0.32, 0.42)));
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (q * 1.7 + vec3(0.0, 0.33, 0.67)));
  col = mix(col, col * mix(vec3(1.08), vec3(0.72, 0.74, 0.78), under), rim);
  col += (film - 0.5) * 0.05 * rim * (1.0 - under);
  col = mix(col, vec3(1.0), rim * 0.35 * (1.0 - under));
  col += vec3(1.0, 0.99, 0.97) * spot * 0.75;
  col += vec3(1.0) * lower * 0.12;
  col = mix(col, col * 1.04 + 0.02, smoothstep(0.95, 0.0, q) * 0.5);
  return col;
}

// ---- what the basket comes in with: stains thrown onto it as it is collected ------------------------------
// where each lands (uv), its size (of the shorter side), when in the throw it lands (of uStain)
const vec4 SP[6] = vec4[6](
  vec4(0.57, 0.40, 0.105, 0.05),
  vec4(0.30, 0.64, 0.095, 0.21),
  vec4(0.69, 0.60, 0.072, 0.37),
  vec4(0.47, 0.20, 0.060, 0.52),
  vec4(0.42, 0.80, 0.062, 0.66),
  vec4(0.83, 0.31, 0.056, 0.80));
// the way it was thrown, what it is (coffee, mud, ink, turmeric, red wine, grass), a seed
const vec4 SD[6] = vec4[6](
  vec4(0.94, 0.34, 0.0, 1.3),
  vec4(-0.66, 0.75, 1.0, 4.1),
  vec4(-0.89, -0.45, 2.0, 7.7),
  vec4(0.40, 0.92, 3.0, 2.9),
  vec4(0.98, -0.22, 4.0, 5.6),
  vec4(-0.32, 0.95, 5.0, 8.8));
// what each does to the cotton (it darkens it, so a multiply)
vec3 stainTint(float k) {
  return k < 0.5 ? vec3(0.60, 0.40, 0.24)
       : k < 1.5 ? vec3(0.52, 0.42, 0.31)
       : k < 2.5 ? vec3(0.22, 0.27, 0.52)
       : k < 3.5 ? vec3(0.99, 0.76, 0.24)
       : k < 4.5 ? vec3(0.64, 0.22, 0.32)
       :           vec3(0.52, 0.65, 0.32);
}
// how strongly, and the stretch of the wash over which it comes out (mud first, ink last)
vec3 stainLift(float k) {
  return k < 0.5 ? vec3(0.78, 0.15, 0.70)
       : k < 1.5 ? vec3(0.88, 0.00, 0.55)
       : k < 2.5 ? vec3(0.92, 0.32, 0.98)
       : k < 3.5 ? vec3(0.80, 0.22, 0.85)
       : k < 4.5 ? vec3(0.74, 0.18, 0.80)
       :           vec3(0.72, 0.10, 0.75);
}
// where it lands, in px: on a tall screen, in the clear band between the title and the step
vec2 stainAt(vec2 uv) {
  if (uRes.y > uRes.x * 1.2) uv.y = 0.34 + (uv.y - 0.2) * 0.62;
  return uv * uRes;
}
// one splash at d (px from where it struck), thrown along dir, of size R, spread g (0..1).
// Returns its cover; rim = how near its edge (a drop that dries leaves its edge darker)
float splat(vec2 d, vec2 dir, float R, float g, float seed, out float rim) {
  rim = 0.0;
  vec2 side = vec2(-dir.y, dir.x);
  vec2 l = vec2(dot(d, dir), dot(d, side)) / R;
  if (dot(l, l) > 11.0) return 0.0;
  // stretched along the throw and carried a little forward of where it struck
  vec2 m = vec2((l.x - 0.28 * g) / (1.0 + 0.4 * g), l.y);
  float r = length(m);
  float a = atan(m.y, m.x);
  float fwd = max(cos(a), 0.0);
  // a ragged edge, with fingers splashed out ahead
  float e = 0.8 + 0.5 * (fbm3(vec2(cos(a), sin(a)) * 1.7 + seed) - 0.5);
  e += pow(vnoise(vec2(a * 7.0, seed * 3.1)), 3.0) * 0.75 * fwd * fwd * fwd;
  e *= g;
  // (the liquid soaks on a little past where it landed, thinning out into the threads)
  float cov = 1.0 - smoothstep(e - 0.16, e + 0.05, r);
  cov = max(cov, (1.0 - smoothstep(e, e + 0.22, r)) * 0.28);
  rim = smoothstep(e - 0.28, e - 0.03, r) * (1.0 - smoothstep(e - 0.03, e + 0.05, r));
  // the droplets flung on ahead of it, each a little teardrop along the way it flew
  float gs = smoothstep(0.0, 1.0, g * 1.2 - 0.1);
  for (int j = 0; j < 7; j++) {
    vec2 h = hash2(vec2(seed * 13.0, float(j) + 0.5));
    float sa = (h.x - 0.5) * 1.6;
    vec2 u = vec2(cos(sa), sin(sa));
    vec2 o = l - u * (1.15 + 1.75 * h.y) * gs;
    float sr = (0.045 + 0.10 * hash(h * 7.0 + 1.0)) * min(1.0, g * 2.5);
    float dl = length(vec2(dot(o, u) * (0.55 + 0.4 * h.x), dot(o, vec2(-u.y, u.x))));
    cov = max(cov, 1.0 - smoothstep(sr * 0.55, sr * 1.1, dl));
  }
  return cov;
}

void main() {
  vec2 p = vUv * uRes;
  float t = uTime;

  float S = min(uRes.x * 1.25, uRes.y);

  // ---- the waterline: it is lowered in, the water climbing over it, a little aslant and never still
  float xl = p.x / uRes.y;
  float line = (mix(1.12, -0.16, uDip) + (p.x / uRes.x - 0.5) * 0.10
    + sin(xl * 5.0 + t * 1.6) * 0.010 + sin(xl * 11.0 - t * 2.3) * 0.005 + (vnoise(vec2(xl * 3.0, t * 0.5)) - 0.5) * 0.03) * uRes.y;
  float dd = p.y - line; // under the water where > 0
  float sub = smoothstep(-1.2, 1.2, dd);
  float W = uWater * sub;
  float atLine = uWater * (1.0 - step(0.999, uDip));

  // ---- the surface over it: how far it bends the view of the cloth, and how it catches the light
  vec2 grad = vec2(0.0);
  if (W > 0.001) grad = water(p, dd).yz * sub;
  vec2 q = p - grad * 70.0 * W * W;
  // the surface climbing the cloth at the line bends the view there, like a lens
  float men = exp(-pow(dd / 7.0, 2.0)) * atLine;
  q.y -= men * 4.0;

  // a stain striking it dents the cloth for a moment
  bool stained = uStain > 0.001 && uClean < 0.999;
  if (stained) {
    for (int i = 0; i < 6; i++) {
      float ph = (uStain - SP[i].w) / 0.05;
      if (ph <= 0.0 || ph >= 1.0) continue;
      vec2 c = stainAt(SP[i].xy);
      float R = SP[i].z * S;
      vec2 v = q - c;
      q -= v * 0.12 * sin(PI * ph) * exp(-dot(v, v) / (R * R * 2.2));
    }
  }

  // warm air shimmering over it as it dries
  float haze = sin(PI * clamp(uDry, 0.0, 1.0));
  if (haze > 0.001) {
    vec2 hz = vec2(vnoise(p / 70.0 + vec2(0.0, t * 1.4)), vnoise(p / 70.0 + vec2(7.3, t * 1.4))) - 0.5;
    q += hz * 3.0 * haze;
  }

  // ---- the cotton itself
  vec3 base = texture(uWeave, q / uTile).rgb;
  float s = creaseAt(q);
  vec3 col = softLight(base, s);

  // the dirt, and the cloud it lifts off in
  vec2 dv = vec2(0.0);
  if (uLift > 0.001 && uDirt > 0.001)
    dv = (vec2(fbm3(q / 190.0 + t * 0.04), fbm3(q / 190.0 + 7.0 - t * 0.035)) - 0.5) * 120.0 * uLift;
  vec4 dt = texture(uDirtT, (q + dv) * uCov.xy + uCov.zw);
  float da = dt.a * uDirt;
  col = mix(col, col * dt.rgb, da);

  // the stains: soaked into the threads (their edges bleed along the weave, ink most), fresh ones glossy,
  // dried ones darker at the rim; in the wash they lift unevenly, carried off with the dirt
  if (stained) {
    float fresh = 0.0;
    vec2 qs = q + dv * 0.6;
    for (int i = 0; i < 6; i++) {
      float T = SP[i].w;
      if (uStain < T) continue;
      vec2 c = stainAt(SP[i].xy);
      float R = SP[i].z * S;
      vec2 d0 = qs - c;
      if (dot(d0, d0) > R * R * 12.0) continue;
      float k = SD[i].z;
      float seed = SD[i].w;
      // its edge wanders along the weave: along the threads one way, then the other (ink travels furthest)
      float bleed = (k > 1.5 && k < 2.5 ? 0.22 : 0.08) * R;
      vec2 d = d0 + bleed * vec2(fbm3(qs / vec2(7.0, 38.0) + seed) - 0.5, fbm3(qs / vec2(38.0, 7.0) + seed * 2.0) - 0.5);
      float g = 1.0 - pow(1.0 - clamp((uStain - T) / 0.09, 0.0, 1.0), 3.0);
      float rim;
      float cov = splat(d, SD[i].xy, R, g, seed, rim);
      if (cov < 0.002) continue;
      vec3 lf = stainLift(k);
      // thinner and thicker in places, the threads taking it up unevenly, and a dried edge darker
      float a = cov * lf.x * (0.62 + 0.38 * fbm3(qs / 26.0 + seed)) * (0.88 + 0.12 * vnoise(qs / vec2(1.3, 4.0)));
      if (k < 0.5) a *= mix(0.55, 1.12, rim);                           // coffee: its ring
      else if (k > 1.5) a *= mix(0.85, 1.08, rim);
      else if (k < 1.5) a *= 0.72 + 0.4 * vnoise(qs / 2.4 + seed) * fbm3(qs / 9.0); // mud: grainy
      else if (k > 4.5) a *= 0.65 + 0.35 * vnoise(qs / vec2(1.5, 7.0)); // grass: streaked along the threads
      float fr = 1.0 - smoothstep(T + 0.03, T + 0.28, uStain);
      a = min(1.0, a * (1.0 + 0.3 * fr));
      a *= 1.0 - smoothstep(lf.y, lf.z, uClean + (fbm3(qs / 55.0 + seed) - 0.5) * 0.35);
      col = mix(col, col * stainTint(k), a);
      fresh = max(fresh, fr * cov);
    }
    // fresh, it sits wet and glossy on the creases
    col += vec3(1.0, 0.98, 0.95) * fresh * 0.07 * smoothstep(0.5, 0.75, s);
  }

  float cloudy = sin(PI * uLift) * W;
  if (cloudy > 0.001) {
    float m = fbm(q / 170.0 + vec2(t * 0.03, -t * 0.05) + uLift * 1.6);
    float cloud = smoothstep(0.42, 0.82, m) * cloudy;
    col = mix(col, col * vec3(0.82, 0.74, 0.66), cloud * 0.55);
  }

  // ---- the water wicking in from where it went in, ragged at the scale of the threads
  // (not there before it goes in, nor once it is dry through)
  float wet = 0.0, wfront = 0.0;
  // (it climbs the threads ahead of the waterline, ragged at their scale; just under, it is still drinking the
  // water in, and goes deeper the longer it has been under)
  if (uDip > 0.001 && uDry < 0.999) {
    float rag = (fbm(p / 120.0 + 3.7) - 0.5) * 30.0 + (fbm3(p / vec2(3.0, 14.0)) - 0.5) * 9.0;
    float e = dd + 8.0 + 36.0 * uSoak + rag;
    // fully wet just above the line, thinning out up the threads to a faint damp edge
    wet = smoothstep(-3.0, 2.0, e) * (0.45 + 0.55 * smoothstep(0.0, 26.0 + 30.0 * uSoak, e));
    wfront = exp(-pow(e / 4.0, 2.0)) * 0.6 * (1.0 - step(0.999, uDip));
    wet *= mix(0.5, 1.0, max(uSoak, smoothstep(0.0, 0.4 * uRes.y, dd)));
  }

  // drying: the raised folds first, the hollows last
  // (a wide, feathered front, ragged at the scale of the threads, over an overall lightening: it fades out
  // of the cloth, never switches off)
  float tide = 0.0;
  if (uDry > 0.001 && wet > 0.001) {
    float g = 0.62 * fbm(p / 330.0 + 11.0) + 0.38 * (1.0 - s);
    g = clamp((g - 0.32) / 0.36, 0.0, 1.0) + (vnoise(p / 5.0) - 0.5) * 0.05;
    float th = mix(-0.25, 1.25, uDry);
    float dried = smoothstep(g - 0.22, g + 0.22, th);
    tide = exp(-pow((th - g - 0.12) / 0.05, 2.0)) * haze * wet * 0.5;
    wet *= (1.0 - dried) * (1.0 - 0.3 * smoothstep(0.0, 0.6, uDry));
  }

  // wet cotton: deeper and richer, the creases clinging and catching a sheen
  vec3 soaked = col * vec3(0.84, 0.70, 0.59);
  col = mix(col, soaked, wet * 0.9);
  col *= 1.0 - wfront * 0.07 - tide * 0.05;
  if (wet > 0.001) {
    float sx = creaseAt(q + vec2(2.5, 0.0)) - s;
    float sy = creaseAt(q + vec2(0.0, 2.5)) - s;
    float sheen = pow(clamp(0.5 + (-sx - sy) * 9.0, 0.0, 1.0), 5.0);
    col += vec3(1.0, 0.97, 0.94) * sheen * 0.05 * wet;
  }

  // dry through: matte and light, the loose fibres standing up
  if (uFluff > 0.001) {
    float fz = vnoise(p / 1.4) * vnoise(p / 3.3 + 4.0);
    col = mix(col, col * 1.03 + 0.008, uFluff);
    col += (fz - 0.25) * 0.03 * uFluff;
  }

  // the last of the damp rising off it
  if (wet * haze > 0.001) {
    float wisp = smoothstep(0.58, 0.9, fbm(p / 95.0 + vec2(0.0, t * 0.32))) * wet * haze;
    col = mix(col, vec3(1.0, 0.99, 0.97), wisp * 0.22);
  }

  // ---- the water: a faint cool cast, light focused through the ripples, glints on the crests
  if (W > 0.001) {
    // a little darker under the water, the deeper the more
    col *= 1.0 - 0.035 * W * smoothstep(0.0, 0.5 * uRes.y, dd);
    col = mix(col, col * vec3(0.985, 1.0, 1.01), W * 0.5);
    // light focused through the ripples: soft bands, brighter in some places than others
    float c = caustic((p + grad * 50.0) / 900.0, t * 0.28);
    float patchy = smoothstep(0.25, 0.75, vnoise(p / 420.0 + vec2(t * 0.02, 0.0)));
    col += vec3(1.0, 0.97, 0.9) * min(c, 1.0) * (0.04 + 0.08 * patchy) * W;
    vec3 n = normalize(vec3(-grad * 2.6, 1.0));
    vec3 H = normalize(normalize(vec3(-0.35, -0.55, 1.0)) + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 260.0);
    col += vec3(1.0) * spec * 0.55 * W;
    col *= 1.0 - clamp(length(grad) * 0.5, 0.0, 0.08) * W;
  }
  // the line itself: a bright thread where the surface climbs the cloth, the dark of it curving away just under
  if (men > 0.0005 || atLine > 0.0) {
    col = mix(col, col * 0.84, exp(-pow((dd - 8.0) / 6.0, 2.0)) * 0.55 * atLine);
    col += vec3(1.0, 0.99, 0.96) * exp(-pow((dd + 1.5) / 2.2, 2.0)) * 0.26 * atLine;
  }

  // ---- air escaping the weave: small silvery bubbles that swell, drift and burst at the surface
  float airy = W * (0.1 + 0.6 * sin(PI * clamp(uSoak, 0.0, 1.0))) * (1.0 - uPop);
  airy = min(1.0, airy + W * 0.8 * exp(-max(dd, 0.0) / 45.0) * (1.0 - step(0.999, uDip)));
  if (airy > 0.003) {
    vec2 rel;
    float cell = 54.0;
    vec4 v = voronoi(p / cell + vec2(0.0, t * 0.05), t * 0.6, 3.0, rel);
    float hs = hash(v.zw + 9.1);
    float life = fract(t * (0.12 + 0.12 * hs) + hash(v.zw + 2.7));
    float on = step(hs, airy) * step(0.04, life) * (1.0 - step(0.96, life));
    if (on > 0.0) {
      float r = (2.5 + 5.0 * hash(v.zw + 5.5)) * (0.4 + 0.6 * smoothstep(0.0, 0.5, life)) / cell;
      vec2 d = (-rel - vec2(0.12, -0.18) * life) * cell;
      col = bubble(col, d, r * cell, 1.0 - life * 0.6);
    }
  }

  // ---- the suds: clusters of packed bubbles that drift, swell, burst and re-form
  float suds = uFoam * (1.0 - uPop) * sub;
  if (suds > 0.002) {
    vec2 drift = vec2(t * 5.0, t * 2.5) + 18.0 * vec2(sin(t * 0.21 + p.y / 310.0), cos(t * 0.17 + p.x / 360.0));
    vec2 pf = p - drift - grad * 30.0;
    float th2 = 1.1 - 0.5 * suds;
    float m = fbm(pf / 300.0 + 2.0);
    float body = smoothstep(th2, th2 + 0.2, m);
    float bodySh = smoothstep(th2, th2 + 0.2, fbm3((pf - vec2(9.0, 13.0)) / 300.0 + 2.0));
    col *= 1.0 - bodySh * (1.0 - body) * 0.14;

    if (body > 0.002) {
      vec2 relM, relS;
      float cm = 21.0;
      vec4 vm = voronoi(pf / cm, t, 11.0, relM);
      vec4 vs = voronoi(pf / 8.5, t * 1.3, 23.0, relS);
      float edgeM = vm.y - vm.x;
      float edgeS = vs.y - vs.x;
      float wallM = 1.0 - smoothstep(0.02, 0.11, edgeM);
      float wallS = 1.0 - smoothstep(0.02, 0.13, edgeS);
      float hl = smoothstep(0.24, 0.0, length(-relM - vec2(-0.2, -0.22)));
      float shade = smoothstep(0.12, 0.3, edgeM) * (1.0 - smoothstep(0.3, 0.5, edgeM)) * step(0.0, relM.x + relM.y);
      float b = body;
      vec3 film = 0.5 + 0.5 * cos(6.2831 * (edgeM * 2.5 + vec3(0.0, 0.33, 0.67) + t * 0.04));
      vec3 white = vec3(1.0, 0.996, 0.988);
      vec3 fc = mix(col, white * 0.97, 0.38 + 0.4 * body * body);
      fc = mix(fc, white, wallM * 0.85);
      fc = mix(fc, white, wallS * 0.45 * smoothstep(0.3, 0.9, body));
      fc *= 1.0 - shade * 0.07;
      fc += (film - 0.5) * 0.035;
      fc += hl * 0.4;
      col = mix(col, fc, b);
      // the bubbles loose at the edge of a cluster, sitting on the water
      float edge = body * (1.0 - smoothstep(0.2, 0.5, body));
      if (edge > 0.01) {
        vec2 relL;
        vec4 vl = voronoi(pf / 34.0, t * 0.8, 31.0, relL);
        float lifeL = fract(t * (0.09 + 0.06 * hash(vl.zw)) + hash(vl.zw + 6.1));
        float rr = (0.1 + 0.32 * pow(hash(vl.zw + 2.2), 2.0)) * smoothstep(0.0, 0.25, lifeL) * (1.0 - step(0.97, lifeL));
        rr *= step(hash(vl.zw + 7.0), 0.45);
        if (rr > 0.0) col = bubble(col, -relL * 34.0, rr * 34.0, 0.0);
      }
    }
  }

  // ---- each stain in flight, just before it lands: coming in from the viewer's side, large and soft, smaller
  // and sharper as it nears, its shadow on the cloth drawing in under it
  if (uStain > 0.001 && uStain < 0.999) {
    for (int i = 0; i < 6; i++) {
      float fl = (uStain - SP[i].w + 0.075) / 0.075;
      if (fl <= 0.0 || fl >= 1.0) continue;
      vec2 c = stainAt(SP[i].xy);
      float R = SP[i].z * S;
      vec2 dir = SD[i].xy;
      float n = 1.0 - fl;
      float sd = length(p - c - vec2(0.35, 0.55) * R * n * 2.5);
      col *= 1.0 - 0.22 * fl * (1.0 - smoothstep(R * 0.2, R * mix(2.4, 0.7, fl), sd));
      vec2 at = c - dir * R * 4.0 * n - vec2(0.0, R * 2.0) * n * n;
      float br = R * mix(1.5, 0.42, fl);
      float bl = R * mix(0.8, 0.06, fl);
      vec2 rel = p - at;
      // drawn out a little along the way it flies
      vec2 rl = vec2(dot(rel, dir) * mix(0.75, 0.9, fl), dot(rel, vec2(-dir.y, dir.x)));
      float ba = (1.0 - smoothstep(br - bl, br + bl, length(rl))) * smoothstep(0.0, 0.25, fl);
      vec3 tint = stainTint(SD[i].z);
      vec3 bc = tint * tint * 0.85;
      bc += vec3(1.0) * 0.45 * (1.0 - smoothstep(0.0, br * 0.45, length(rel + vec2(0.3, 0.38) * br)));
      col = mix(col, bc, ba);
    }
  }

  outColor = vec4(col, 1.0);
}`;

type Srcs = { weave: string; crumple: string; washed: string; dirt: string };

export function createClothGL(canvas: HTMLCanvasElement, srcs: Srcs, pressCv: HTMLCanvasElement, onReady: () => void, state?: ClothState) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl || gl.isContextLost()) return null;

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VS);
  const fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const names = ['fold', 'dirt', 'lift', 'soak', 'water', 'ring', 'foam', 'pop', 'dry', 'fluff', 'stain', 'clean', 'dip'] as const;
  const uLoc = Object.fromEntries(names.map((n) => [n, U('u' + n[0].toUpperCase() + n.slice(1))])) as Record<(typeof names)[number], WebGLUniformLocation | null>;
  const uRes = U('uRes');
  const uTime = U('uTime');
  const uCov = U('uCov');
  const uTile = U('uTile');
  const uDrops = U('uDrops');
  const uNDrops = U('uNDrops');
  // the live ripples, newest last; each lasts 4 s. Packed to the front so the shader only loops over these
  const live: [number, number, number, number][] = [];
  const drops = new Float32Array(12 * 4);

  // ---- textures
  const units = ['uWeave', 'uCrumple', 'uWashed', 'uDirtT', 'uPressT'];
  const tex = units.map((n, i) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 0]));
    gl.uniform1i(U(n), i);
    return t;
  });
  let pending = 4;
  let dirty = true;
  const upload = (i: number, src: CanvasImageSource, repeat: boolean, mips: boolean) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    dirty = true;
  };
  ([srcs.weave, srcs.crumple, srcs.washed, srcs.dirt] as const).forEach((src, i) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      upload(i, im, i === 0, true);
      if (--pending === 0) onReady();
    };
    im.src = src;
  });
  upload(4, pressCv, false, false);

  // ---- state and drawing
  const u: ClothState = state ?? { fold: 0, dirt: 1, lift: 0, soak: 0, water: 0, ring: 0, foam: 0, pop: 0, dry: 0, fluff: 0, stain: 0, clean: 0, dip: 0 };
  let W = 1;
  let H = 1;
  let last = '';
  const t0 = performance.now();

  // how finely it is drawn. It starts at up to ~1.2 million pixels, and if the frames come in slow (a modest
  // graphics chip under the busy wash) it draws coarser, down to half, until they come in smooth; the water,
  // suds and creases are soft enough that this barely shows, while a stutter does
  // (a cloth at rest is drawn in full). The canvas itself keeps its size, since resizing it costs a frame:
  // a coarser frame is drawn into a corner of a buffer off screen and scaled up onto it
  // (moving, it starts a little under full and climbs if the frames keep up)
  let quality = 0.72;
  // phones get fewer pixels to fill: their screens are small, and their graphics chips share memory and heat
  const budget = window.matchMedia('(pointer: coarse)').matches ? 0.55e6 : 1.2e6;
  let ceiling = 1.01;
  let still = true;
  let blit = true;
  let blitChecked = false;
  let bw = 0;
  let bh = 0;
  const fbo = gl.createFramebuffer();
  const rb = gl.createRenderbuffer();
  const fit = () => {
    dirty = true;
  };
  const resize = (w: number, h: number) => {
    W = Math.max(1, w);
    H = Math.max(1, h);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(budget / (W * H)));
    const cw = Math.max(1, Math.round(W * dpr));
    const ch = Math.max(1, Math.round(H * dpr));
    if (cw !== canvas.width || ch !== canvas.height) {
      canvas.width = cw;
      canvas.height = ch;
    }
    // (the canvas may already have this size from a scene set up on it before; the buffer is this one's own)
    if (cw !== bw || ch !== bh) {
      bw = cw;
      bh = ch;
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, cw, ch);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      blit = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dirty = true;
  };
  let prev = 0;
  let sum = 0;
  let count = 0;
  let good = 0;
  const pace = (now: number) => {
    const dt = now - prev;
    prev = now;
    if (dt <= 0 || dt > 250) return;
    sum += dt;
    if (++count < (sum / count > 40 ? 3 : 8)) return;
    const avg = sum / count;
    sum = count = 0;
    if (avg > 20.5 && quality > 0.5) {
      // too slow: draw coarser (a lot coarser if it is crawling), and do not climb back to here
      ceiling = quality;
      quality = Math.max(0.5, quality * (avg > 40 ? 0.6 : 0.82));
      good = 0;
      fit();
    } else if (avg < 17.6 && quality * 1.12 < ceiling && ++good >= 12) {
      quality = Math.min(1, quality * 1.12);
      good = 0;
      fit();
    }
  };

  const moving = () =>
    u.water > 0.002 || u.foam * (1 - u.pop) > 0.002 || (u.dry > 0.001 && u.dry < 0.999) || (u.lift > 0.001 && u.lift < 0.999);

  const draw = (now: number) => {
    // another scene may have used the same context since: take it back
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
    });
    const cw = canvas.width;
    const ch = canvas.height;
    const k = still || !blit ? 1 : quality;
    const rw = Math.max(1, Math.round(cw * k));
    const rh = Math.max(1, Math.round(ch * k));
    const coarse = rw < cw;
    gl.bindFramebuffer(gl.FRAMEBUFFER, coarse ? fbo : null);
    gl.viewport(0, 0, rw, rh);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, ((now - t0) / 1000) % 3600);
    const s = Math.max(W / 1600, H / 900);
    const dw = 1600 * s;
    const dh = 900 * s;
    gl.uniform4f(uCov, 1 / dw, 1 / dh, -(W - dw) / 2 / dw, -(H - dh) / 2 / dh);
    gl.uniform1f(uTile, 256);
    for (const n of names) gl.uniform1f(uLoc[n], u[n]);
    const tn = ((now - t0) / 1000) % 3600;
    while (live.length && (tn - live[0][2] > 4 || tn < live[0][2])) live.shift();
    live.forEach((d, i) => drops.set(d, i * 4));
    gl.uniform4fv(uDrops, drops);
    gl.uniform1i(uNDrops, live.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (coarse) {
      if (!blitChecked) while (gl.getError() !== gl.NO_ERROR); // clear what came before, to ask about this alone
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, rw, rh, 0, 0, cw, ch, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // (asked once only: asking makes the browser wait for the graphics chip)
      if (!blitChecked && ((blitChecked = true), gl.getError() !== gl.NO_ERROR)) {
        // this browser will not scale it up: draw it in full instead
        blit = false;
        dirty = true;
      }
    }
  };

  let raf = 0;
  let active = false;
  const frame = (now: number) => {
    raf = 0;
    if (!active) return;
    const key = names.map((n) => u[n].toFixed(4)).join();
    const busy = moving();
    if (busy === still) {
      still = !busy;
      fit();
    }
    if (dirty || key !== last || busy) {
      draw(now);
      dirty = false;
      last = key;
      if (busy) pace(now);
      else prev = 0;
    } else prev = 0;
    raf = requestAnimationFrame(frame);
  };

  return {
    u,
    resize,
    pressChanged: () => upload(4, pressCv, false, false),
    /** A ripple from the pointer at (x, y) in the canvas's own pixels. */
    drop(x: number, y: number, strength: number) {
      live.push([x, y, ((performance.now() - t0) / 1000) % 3600, strength]);
      if (live.length > 12) live.shift();
    },
    setActive(on: boolean) {
      active = on;
      if (on && !raf) raf = requestAnimationFrame(frame);
    },
    destroy() {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      // the canvas keeps its context (a scene set up again on it gets the same one); free what this one made
      tex.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buf);
      gl.deleteFramebuffer(fbo);
      gl.deleteRenderbuffer(rb);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
