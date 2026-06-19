import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOUNDSCAPES, type SoundKind } from "../soundscapes.js";

/**
 * Procedurally synthesizes the calm soundscapes into 16-bit mono WAV loops.
 *
 * Everything here is generated from noise + oscillators, so the output is CC0 by
 * construction — no copyrighted audio and nothing to download. Files are written
 * to `<app>/public/audio/<id>.wav` and served by Express at `/audio/<id>.wav`.
 */

const SAMPLE_RATE = 22_050;
const TAU = Math.PI * 2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_DIR = path.resolve(__dirname, "../../../public/audio");

/** Deterministic RNG so regenerating yields identical files. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function synth(kind: SoundKind, seconds: number, seed: number): Float32Array {
  const n = SAMPLE_RATE * seconds;
  const buf = new Float32Array(n);
  const rng = mulberry32(seed);
  const t = (i: number) => i / SAMPLE_RATE;

  let lp = 0;
  let brown = 0;

  // soundscape-specific transient scheduling
  let nextEvent = SAMPLE_RATE * 0.5;
  let evEnd = -1;
  let evFreq = 0;

  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    let s = 0;

    switch (kind) {
      case "rain": {
        lp += 0.45 * (w - lp);
        const hiss = w - lp;
        s = (lp * 0.8 + hiss * 0.4) * 0.5;
        break;
      }
      case "ocean": {
        brown = (brown + 0.02 * w) * 0.995;
        lp += 0.05 * (brown * 6 - lp);
        const swell = 0.5 + 0.5 * Math.sin(TAU * 0.08 * t(i));
        s = lp * swell * 1.1;
        break;
      }
      case "forest": {
        // gentle wind bed
        lp += 0.04 * (w - lp);
        s = lp * 0.35;
        // occasional bird chirp (short rising sine)
        if (i >= nextEvent && evEnd < i) {
          evEnd = i + Math.floor(SAMPLE_RATE * (0.12 + rng() * 0.12));
          evFreq = 2200 + rng() * 1600;
          nextEvent = i + Math.floor(SAMPLE_RATE * (1.5 + rng() * 3));
        }
        if (i < evEnd) {
          const prog = 1 - (evEnd - i) / (SAMPLE_RATE * 0.2);
          const env = Math.sin(Math.PI * Math.min(1, Math.max(0, prog)));
          s += Math.sin(TAU * (evFreq + prog * 600) * t(i)) * env * 0.18;
        }
        break;
      }
      case "night": {
        // low drone
        s =
          0.12 * Math.sin(TAU * 80 * t(i)) +
          0.08 * Math.sin(TAU * 120 * t(i));
        // crickets: pulsed high tone
        const pulse = i % Math.floor(SAMPLE_RATE * 0.07);
        const on = pulse < SAMPLE_RATE * 0.022 ? 1 : 0;
        s += Math.sin(TAU * 4600 * t(i)) * on * 0.05;
        break;
      }
      case "fire": {
        brown = (brown + 0.02 * w) * 0.99;
        lp += 0.2 * (brown * 4 - lp);
        s = lp * 0.4;
        // crackle pops
        if (i >= nextEvent && evEnd < i) {
          evEnd = i + Math.floor(SAMPLE_RATE * (0.01 + rng() * 0.03));
          nextEvent = i + Math.floor(SAMPLE_RATE * (0.04 + rng() * 0.35));
        }
        if (i < evEnd) s += (rng() * 2 - 1) * 0.5;
        break;
      }
      case "drone": {
        const f0 = 110;
        const swell = 0.7 + 0.3 * Math.sin(TAU * 0.05 * t(i));
        const partials: [number, number, number][] = [
          [1, 0.5, 1.0],
          [1.5, 0.25, 1.002],
          [2, 0.18, 0.999],
          [3, 0.1, 1.001],
          [4, 0.06, 1.003],
        ];
        for (const [mult, weight, detune] of partials) {
          s += weight * Math.sin(TAU * f0 * mult * detune * t(i));
        }
        s *= 0.18 * swell;
        break;
      }
    }

    buf[i] = Math.max(-1, Math.min(1, s));
  }

  // Fade the ends so re-triggered loops don't click.
  const fade = Math.floor(SAMPLE_RATE * 0.5);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    buf[i]! *= g;
    buf[n - 1 - i]! *= g;
  }

  return buf;
}

function toWav(samples: Float32Array): Buffer {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE((Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff) | 0, 44 + i * 2);
  }
  return buf;
}

/** Generate any soundscapes whose WAV file is missing. Returns count written. */
export function ensureSounds(force = false): number {
  mkdirSync(AUDIO_DIR, { recursive: true });
  let written = 0;
  for (const sc of SOUNDSCAPES) {
    const file = path.join(AUDIO_DIR, `${sc.id}.wav`);
    if (!force && existsSync(file)) continue;
    const samples = synth(sc.kind, sc.loopSeconds, hash(sc.id));
    writeFileSync(file, toWav(samples));
    written++;
    console.log(`[sounds] generated ${sc.id}.wav (${sc.loopSeconds}s)`);
  }
  return written;
}

// `bun run generate:sounds` regenerates every file.
if (import.meta.main) {
  const count = ensureSounds(true);
  console.log(`[sounds] done — ${count} file(s) in ${AUDIO_DIR}`);
}
