"""
Generates a background music bed from scratch, so no track ever carries
someone else's copyright - the reason many competitions reject entries.

    python tools/make-music.py --mood calm --out build/music/calm.wav

Soft pad + a gentle electric-piano arpeggio + a sine bass, through a synthetic
room reverb. The file is one seamless loop; the builder repeats it to length.

Seamless by construction, not by luck: one cycle is rendered into a circular
buffer. Anything that rings past the end of the cycle - a pad's release, a
note's decay, the reverb tail, a note nudged early by the humanising - wraps
round and is added back at the start, which is exactly what the next repeat
would hear there. Rendering several cycles and cutting one out instead failed
twice: sample-rounding shifted the cycles against each other, and every loop
clicked.

Needs only numpy, and only one cycle of audio in memory (a few MB) - this
machine often has well under 500 MB of commit left. Deterministic: the same
--mood and --seed give the same file.
"""
import argparse
import wave

import numpy as np

SR = 44100

# Chords as MIDI note numbers, one chord per two bars. Voicings stay in a
# narrow, warm range: this sits under a voice and must never compete with it.
MOODS = {
    # health education, prevention: unhurried, major, open voicings
    "calm":    {"bpm": 70, "arp": 4, "bright": 0.55,
                "chords": [[57, 60, 64, 71], [53, 57, 60, 67], [48, 52, 55, 62], [55, 59, 62, 69]]},
    # new techniques, improvement, recovery: rising, a little more motion
    "hopeful": {"bpm": 82, "arp": 8, "bright": 0.7,
                "chords": [[48, 52, 55, 62], [55, 59, 62, 69], [57, 60, 64, 71], [53, 57, 60, 67]]},
    # serious topics - risk, cancer, stroke: gentle but grave, never dramatic
    "warm":    {"bpm": 64, "arp": 4, "bright": 0.45,
                "chords": [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]]},
    # achievements, anniversaries, awards: brighter and quicker
    "bright":  {"bpm": 96, "arp": 8, "bright": 0.85,
                "chords": [[48, 52, 55, 64], [53, 57, 60, 69], [57, 60, 64, 71], [55, 59, 62, 67]]},
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def envelope(n, attack, release):
    """Linear attack and release over n samples (attack/release in seconds)."""
    env = np.ones(n, dtype=np.float32)
    na, nr = int(attack * SR), int(release * SR)
    if na:
        env[:na] = np.linspace(0, 1, na, dtype=np.float32)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr, dtype=np.float32)
    return env


class Ring:
    """A stereo circular buffer exactly one cycle long."""

    def __init__(self, n):
        self.n = n
        self.ch = [np.zeros(n, dtype=np.float32), np.zeros(n, dtype=np.float32)]

    def add(self, start, sig, pan=0.5):
        """Add a mono signal at a sample position, wrapping past the end."""
        for c, g in ((0, 1 - pan), (1, pan)):
            pos, rest = start % self.n, sig
            while len(rest):
                k = min(len(rest), self.n - pos)
                self.ch[c][pos:pos + k] += np.float32(g) * rest[:k]
                rest, pos = rest[k:], 0


def pad_voice(notes, n, rng, bright):
    """Two detuned voices per note, soft harmonics, a slow swell and fade."""
    t = np.arange(n, dtype=np.float32) / SR
    L = np.zeros(n, dtype=np.float32)
    R = np.zeros(n, dtype=np.float32)
    for m in notes + [notes[0] - 12]:
        for det, pan in ((-4, 0.2), (4, 0.8)):
            w = np.float32(2 * np.pi * hz(m) * 2 ** (det / 1200))
            ph = np.float32(rng.uniform(0, 2 * np.pi))
            tone = (np.sin(w * t + ph)
                    + np.float32(bright * 0.18) * np.sin(2 * w * t + ph)
                    + np.float32(bright * 0.06) * np.sin(3 * w * t + ph))
            L += tone * np.float32(1 - pan)
            R += tone * np.float32(pan)
    env = envelope(n, 1.4, 1.8) * (1 + np.float32(0.12) * np.sin(np.float32(2 * np.pi * 0.13) * t))
    return L * env, R * env


def pluck(f, n, vel):
    """Electric-piano-ish note: a few harmonics, quick attack, soft decay."""
    t = np.arange(n, dtype=np.float32) / SR
    w = np.float32(2 * np.pi * f)
    tone = (np.sin(w * t) + np.float32(0.32) * np.sin(2 * w * t)
            + np.float32(0.08) * np.sin(3 * w * t) + np.float32(0.04) * np.sin(np.float32(3.98) * w * t))
    env = np.exp(-t / np.float32(0.7)) * np.minimum(1, t / np.float32(0.006))
    return np.float32(vel) * tone * env


def room_ir(rng, rt60=2.4, pre=0.022):
    """Decaying stereo noise, darkened - a cheap but convincing room."""
    n = int((rt60 + pre) * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-6.91 * t / rt60)
    k = 24                                  # moving average ~ gentle low-pass
    ir = np.stack([np.convolve(c, np.ones(k) / k, mode="same") for c in ir])
    ir[:, : int(pre * SR)] = 0
    return (ir / np.abs(ir).max()).astype(np.float32)


def circular_reverb(x, h, block=1 << 15):
    """Convolution in short overlap-add blocks, with the tail wrapped round to
    the start: the reverb of a loop that has been playing forever."""
    n, nh = len(x), len(h)
    size = 1 << (block + nh - 1).bit_length()
    H = np.fft.rfft(h, size)
    out = np.zeros(n + nh - 1, dtype=np.float32)
    for i in range(0, n, block):
        seg = x[i:i + block]
        y = np.fft.irfft(np.fft.rfft(seg, size) * H, size)[: len(seg) + nh - 1]
        out[i:i + len(y)] += y.astype(np.float32)
    head = out[:n].copy()
    tail = out[n:]
    while len(tail):                        # wrap (possibly more than once)
        k = min(len(tail), n)
        head[:k] += tail[:k]
        tail = tail[k:]
    return head


def render(mood, seed):
    cfg = MOODS[mood]
    rng = np.random.default_rng(seed)
    beat = 60.0 / cfg["bpm"]
    chord_n = int(round(8 * beat * SR))     # two bars of 4/4 per chord, in whole samples
    n = chord_n * len(cfg["chords"])        # the cycle, in whole samples
    ring = Ring(n)

    for ci, chord in enumerate(cfg["chords"]):
        at = ci * chord_n

        # pad: rings 1.6 s into the next chord, fading under it
        pl, pr = pad_voice(chord, chord_n + int(1.6 * SR), rng, cfg["bright"])
        ring.add(at, np.float32(0.16) * pl, pan=0.0)
        ring.add(at, np.float32(0.16) * pr, pan=1.0)

        # bass: the root, two octaves down, one long soft note per chord
        t = np.arange(chord_n, dtype=np.float32) / SR
        bass = np.sin(np.float32(2 * np.pi * hz(chord[0] - 24)) * t) * envelope(chord_n, 0.25, 0.9)
        ring.add(at, np.float32(0.14) * bass)

        # arpeggio over the chord tones, up then down, slightly humanised
        steps = 2 * cfg["arp"]
        seq = chord[1:] + [chord[0] + 12] + chord[1:][::-1]
        for k in range(steps):
            m = seq[k % len(seq)] + 12
            vel = 0.075 * rng.uniform(0.8, 1.05) * (1.0 if k % 4 == 0 else 0.75)
            start = at + (k * chord_n) // steps + int(rng.uniform(-0.008, 0.008) * SR)
            note = pluck(hz(m), int(1.6 * SR), vel) * 2
            ring.add(start, note, pan=0.35 + 0.3 * (k % 2))

    ir = room_ir(np.random.default_rng(seed + 1000))
    for c in (0, 1):
        dry = ring.ch[c]
        wet = circular_reverb(dry, ir[c])
        wet *= np.float32(0.34 * np.abs(dry).max() / (np.abs(wet).max() + 1e-9))
        dry *= np.float32(0.72)
        dry += wet                           # in place: no extra full-length copies
        del wet

    out = np.stack(ring.ch, axis=1)
    np.tanh(out * np.float32(1.4), out=out)  # soft ceiling, no hard clipping
    out *= np.float32(10 ** (-3 / 20) / np.abs(out).max())   # peak at -3 dBFS
    return out, n / SR


def seam_ratio(x):
    """The step heard where the loop joins, relative to the 99th percentile of
    ordinary sample-to-sample steps. Below 1 means the join is inaudible."""
    mono = x.mean(axis=1)
    return float(abs(mono[0] - mono[-1]) / np.percentile(np.abs(np.diff(mono)), 99))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--mood", choices=sorted(MOODS), default="calm")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    audio, cycle = render(args.mood, args.seed)
    pcm = (audio * 32767).astype("<i2")
    with wave.open(args.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{args.mood}: vong lap {cycle:.1f}s, cho noi {seam_ratio(audio):.2f}x buoc thuong -> {args.out}")


if __name__ == "__main__":
    main()
