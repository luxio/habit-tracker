/**
 * Generates assets/sounds/chime.wav — a short, pleasant reward chime.
 *
 * A C–E–G major arpeggio (each note overlapping the last) with a soft
 * exponential decay so completing a habit feels rewarding without being harsh.
 * 16-bit PCM mono WAV, ~0.7s. Self-contained (no deps); swap the file freely.
 *
 * Run once:  node scripts/make-chime.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 0.7; // seconds
const totalSamples = Math.floor(SAMPLE_RATE * DURATION);

// Major triad (C5, E5, G5) — bright and resolved.
const notes = [
  { freq: 523.25, start: 0.0 },
  { freq: 659.25, start: 0.08 },
  { freq: 783.99, start: 0.16 },
];

const samples = new Float32Array(totalSamples);

for (let i = 0; i < totalSamples; i++) {
  const t = i / SAMPLE_RATE;
  let value = 0;
  for (const note of notes) {
    if (t < note.start) continue;
    const local = t - note.start;
    // Quick attack, exponential decay envelope.
    const env = Math.min(1, local / 0.01) * Math.exp(-local * 5.5);
    // Fundamental + a soft octave for a "bell" shimmer.
    value +=
      env * (Math.sin(2 * Math.PI * note.freq * local) +
        0.3 * Math.sin(2 * Math.PI * note.freq * 2 * local));
  }
  samples[i] = value;
}

// Normalize to avoid clipping, leave a little headroom.
let peak = 0;
for (let i = 0; i < totalSamples; i++) peak = Math.max(peak, Math.abs(samples[i]));
const gain = peak > 0 ? 0.82 / peak : 1;

// 16-bit PCM WAV.
const dataSize = totalSamples * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
buffer.writeUInt16LE(2, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < totalSamples; i++) {
  const s = Math.max(-1, Math.min(1, samples[i] * gain));
  buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'chime.wav');
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
