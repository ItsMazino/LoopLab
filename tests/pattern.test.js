import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, validSession, stepDuration, stepOffset, encodeWav } from '../src/pattern.js';
test('presets satisfy the session schema; invalid values fail', () => {
  for (const p of presets) assert.ok(validSession({ ...p, volume: 70, muted: Array(6).fill(false) }));
  assert.equal(validSession({}), false);
  assert.equal(validSession({ ...presets[0], bpm: -1, volume: 70, muted: [] }), false);
});
test('swing delays offbeats without changing bar length', () => {
  assert.equal(stepDuration(120), .125);
  assert.equal(stepOffset(1, 120, 50), .1875);
  assert.equal(stepOffset(2, 120, 50), .25);
  assert.equal(stepOffset(16, 120, 50), 2);
});
test('WAV encodes mono signed PCM and clips out-of-range samples', () => {
  const wav = encodeWav({ sampleRate: 44100, getChannelData: () => new Float32Array([-2, 0, 2]) });
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 50); assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 6); assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
});
