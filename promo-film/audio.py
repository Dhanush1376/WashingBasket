"""Soundtrack for the 60 s film: voice-over + original synthesised music + sound design.
Music and SFX are synthesised from scratch (no samples, no licences). SFX cue times come from the
composition itself (work/cues.json, written by render.js), so sound and picture stay in sync.
Writes work/soundtrack.wav (48 kHz stereo)."""
import json, os, wave
import numpy as np

def smooth(x, n):
    c = np.cumsum(np.concatenate([[0.0], x])); y = (c[n:] - c[:-n]) / n
    pad = len(x) - len(y); return np.concatenate([np.full(pad // 2, y[0]), y, np.full(pad - pad // 2, y[-1])])
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
tt = lambda d: np.arange(int(d * SR)) / SR
note = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def filt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, sig, start, gain=1.0, pan=0.0):
        i = int(start * SR)
        if i >= N or i + len(sig) <= 0: return
        if i < 0: sig = sig[-i:]; i = 0
        sig = sig[: N - i]
        self.L[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
        self.R[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))

def env(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e

# ───────────── voice-over (edge-tts, en-IN Neerja; see vo.py) ─────────────
VO_AT = [0.6, 2.5, 6.2, 12.0, 17.2, 21.6, 28.6, 38.4, 46.9, 52.4, 55.75]
vo = np.zeros(N)
for k, at in enumerate(VO_AT):
    with wave.open(f'vo/{k:02d}.wav') as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
    x = filt(x, 'highpass', 90)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.92
    i = int(at * SR); x = x[: N - i]; vo[i:i + len(x)] += x
# gentle presence: a little low-mid scoop by mixing a high-shelf-ish copy
vo = vo + 0.22 * filt(vo, 'highpass', 3000)
vo = np.tanh(vo * 2.2) / np.tanh(2.2) * 0.9  # broadcast-style compression
vo_env = smooth(np.abs(vo), int(0.25 * SR))
duck = 1 - 0.6 * np.clip(vo_env / 0.08, 0, 1)
duck = smooth(duck, int(0.12 * SR))

# ───────────── music ─────────────
M = Bus()
BPM = 104.0; BEAT = 60 / BPM; BAR = BEAT * 4
CH = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 57, 60, 65], [46, 53, 58, 62]]
for k in range(int(DUR / (BAR * 2)) + 1):
    start = k * BAR * 2; ch = CH[k % 4]; d = BAR * 2 + 1.5; t = tt(d); s = np.zeros(len(t))
    for m in ch:
        for det in (-0.08, 0, 0.08):
            f = note(m + 12) * (1 + det / 100); s += np.sin(2 * np.pi * f * t + det) + 0.15 * np.sin(4 * np.pi * f * t)
    M.add(s * env(len(t), 1.0, 1.4) / 12, start, 0.28, pan=(-0.25 if k % 2 else 0.25))
def kick():
    t = tt(0.35); f = 48 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def hat():
    t = tt(0.05); return filt(rng.standard_normal(len(t)), 'highpass', 7000) * np.exp(-t * 80)
K, H = kick(), hat()
b = 0
while b * BEAT < DUR:
    tb = b * BEAT
    if 11.6 <= tb < 55.3:
        M.add(K, tb, 0.5)
        M.add(H, tb + BEAT / 2, 0.14, pan=0.3)
        if tb > 21: M.add(H, tb + BEAT * 0.75, 0.07, pan=-0.3)
    if 6.0 <= tb < 11.6 and b % 2 == 0: M.add(K, tb, 0.35)
    b += 1
for k in range(int(DUR / BAR)):
    tb = k * BAR
    if 11.6 <= tb < 55.3:
        root = CH[(k // 2) % 4][0] - 12; t = tt(BAR)
        M.add(np.sin(2 * np.pi * note(root) * t) * env(len(t), 0.02, 0.3), tb, 0.3)
def pluck(f, d=0.4):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 8) * env(len(t), 0.003, 0.05)
i = 0
while i * BEAT / 2 < DUR:
    ts = i * BEAT / 2
    if 17.0 <= ts < 55.3:
        ch = CH[int(ts // (BAR * 2)) % 4]; m = ch[[0, 2, 1, 3, 2, 1, 3, 2][i % 8]] + 24
        M.add(pluck(note(m)), ts, 0.07, pan=(0.35 if i % 2 else -0.35))
    i += 1
# closing chord
t = tt(4.2)
sig = sum(np.sin(2 * np.pi * note(m) * t) * np.exp(-t * 0.9) for m in (53, 60, 65, 69, 72, 77)) / 6
M.add(sig * env(len(t), 0.02, 0.8), 55.9, 0.6)
# banger intro: hit + stab on the first line, riser into the logo reveal
t = tt(2.5); M.add((np.sin(2 * np.pi * np.cumsum(60 * np.exp(-t * 2) + 35) / SR) * np.exp(-t * 2.2)) * 3.0, 0.0, 1.0)
t = tt(1.4); stab = sum(np.sin(2 * np.pi * note(m) * t) + 0.4 * np.sign(np.sin(2 * np.pi * note(m) * t)) * 0.3 for m in (65, 69, 72, 77)) * np.exp(-t * 3) / 4
M.add(stab, 0.55, 1.2); M.add(stab, 1.55, 0.9)
t = tt(1.6); M.add(filt(rng.standard_normal(len(t)), 'bandpass', [300, 6000]) * (t / 1.6) ** 3 * 1.2, 4.45, 1.0)
music = np.stack([M.L, M.R], 1)
music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
music *= duck[:, None]

# ───────────── sound design ─────────────
def noise(d): return rng.standard_normal(int(d * SR))
def whoosh(d=0.45, lo=400, hi=5000, rise=True):
    t = tt(d); x = noise(d); sh = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    a = filt(x, 'bandpass', [lo, hi]) * sh
    if rise: a *= np.linspace(0.6, 1.2, len(t))
    return a / (np.max(np.abs(a)) + 1e-9)
def tone(f0, f1, d, decay, harm=0.0):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + harm * np.sin(2 * ph)) * np.exp(-t * decay) * env(len(t), 0.002, 0.01)
def bell(m, d=0.9, decay=4.5):
    t = tt(d); f = note(m)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.01 * f * t) + 0.12 * np.sin(2 * np.pi * 3.02 * f * t)) * np.exp(-t * decay) * env(len(t), 0.002, 0.05)
def arp(ms, gap, d=0.9):
    out = np.zeros(int((d + gap * len(ms)) * SR))
    for j, m in enumerate(ms):
        b_ = bell(m, d); o = int(j * gap * SR); out[o:o + len(b_)] += b_
    return out / len(ms) ** 0.5
def click():
    t = tt(0.04); return filt(noise(0.04), 'highpass', 2500) * np.exp(-t * 300) * 0.8 + np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 120) * 0.6
def key():
    t = tt(0.05); return filt(noise(0.05), 'bandpass', [1500, 6000]) * np.exp(-t * 180) + 0.5 * np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 160)
def thud(f=110, d=0.25):
    t = tt(d); return tone(f, f * 0.5, d, 14) + 0.25 * filt(noise(d), 'lowpass', 900) * np.exp(-t * 30)
def boom():
    t = tt(1.2); return tone(70, 32, 1.2, 3.2) * 1.0 + 0.3 * filt(noise(1.2), 'lowpass', 400) * np.exp(-t * 6)

def mx(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o

SFX = {
    'lift': lambda: mx(whoosh(0.42, 500, 6000) * 0.55, thud(180, 0.12) * 0.15),
    'swish': lambda: whoosh(0.3, 900, 7000, rise=False) * 0.35,
    'swoosh': lambda: whoosh(0.5, 300, 4000) * 0.45,
    'whoosh': lambda: whoosh(0.8, 200, 3500) * 0.8,
    'click': lambda: click() * 0.75,
    'type': lambda: key() * 0.6,
    'tick': lambda: tone(2600, 2400, 0.04, 90) * 0.4,
    'blip': lambda: tone(note(72 + int(rng.integers(0, 12))), note(72) * 1.0, 0.09, 40) * 0.5,
    'thud': lambda: thud(120, 0.22) * 0.8,
    'suck': lambda: mx(whoosh(0.55, 300, 3000)[::-1] * 0.7, tone(200, 900, 0.5, 2) * 0.15),
    'pop': lambda: tone(1100, 420, 0.09, 35) * 0.7,
    'thump': lambda: mx(boom() * 0.9, thud(90, 0.3) * 0.6),
    'drop': lambda: mx(thud(160, 0.2) * 0.75, tone(700, 500, 0.06, 50) * 0.2),
    'shimmer': lambda: mx(arp([88, 91, 95, 100, 103], 0.05, 1.2) * 0.45, filt(noise(1.0), 'highpass', 8000) * np.exp(-tt(1.0) * 4) * 0.08),
    'ding': lambda: bell(91, 0.7, 6) * 0.45,
    'success': lambda: arp([79, 83, 86, 91], 0.075, 1.0) * 0.6,
    'stamp': lambda: mx(thud(85, 0.35) * 1.0, filt(noise(0.08), 'bandpass', [800, 5000]) * np.exp(-tt(0.08) * 50) * 0.6),
    'unlock': lambda: mx(arp([84, 88, 91, 96], 0.04, 0.9) * 0.5, whoosh(0.5, 2000, 9000) * 0.3),
    'locked': lambda: np.concatenate([tone(220, 200, 0.09, 20, 0.6), np.zeros(int(0.05 * SR)), tone(220, 200, 0.09, 20, 0.6)]) * 0.5,
    'scan': lambda: np.sin(2 * np.pi * np.cumsum(1200 + 400 * np.sin(2 * np.pi * tt(1.7) / 0.6)) / SR) * np.sin(np.pi * tt(1.7) / 1.7) * 0.12,
    'beep': lambda: np.concatenate([tone(2000, 2000, 0.09, 8), np.zeros(int(0.05 * SR)), tone(2600, 2600, 0.14, 8)]) * 0.6,
    'impact': lambda: boom() * 0.6,
    'step': lambda: mx(bell(84, 0.5, 7) * 0.35, click() * 0.2),
}
S = Bus()
cues = json.load(open('work/cues.json'))
step_n = 0
for c in cues:
    k = c['k']; sig = SFX[k]()
    if k == 'step': sig = bell(84 + [0, 2, 4, 7, 9][step_n % 5], 0.5, 7) * 0.38; step_n += 1
    pan = {'lift': -0.15, 'swish': 0.15, 'type': 0.1, 'blip': (rng.random() - 0.5) * 0.8, 'thud': (rng.random() - 0.5) * 0.4}.get(k, 0.0)
    S.add(sig, c['t'] - (0.12 if k in ('lift', 'swoosh', 'whoosh') else 0.0), c['g'], pan)
sfx = np.stack([S.L, S.R], 1)
sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.8
# SFX duck slightly under the voice so words stay clear
sfx *= (1 - 0.3 * (1 - duck))[:, None]

# ───────────── master ─────────────
mix = music + sfx + np.stack([vo, vo], 1) * 0.95
fade = np.ones(N); fi = int(0.05 * SR); fo = int(0.25 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.93
os.makedirs('work', exist_ok=True)
with wave.open('work/soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print(f'soundtrack {DUR}s  rms music {rms(music):.1f} dB  sfx {rms(sfx):.1f} dB  vo {rms(vo):.1f} dB  cues {len(cues)}')
