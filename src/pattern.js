export const voices = [
  { name: "Kick", kind: "kick", note: "LOW END", color: "#c8ed7b" },
  { name: "Snare", kind: "snare", note: "THE BACKBEAT", color: "#eb9972" },
  { name: "Closed hat", kind: "hat", note: "KEEP IT MOVING", color: "#e1c86c" },
  { name: "Open hat", kind: "open", note: "A LITTLE AIR", color: "#9cbac4" },
  { name: "Clap", kind: "clap", note: "HANDS TOGETHER", color: "#b7a0c7" },
  { name: "Tom", kind: "tom", note: "ROUND THE CORNER", color: "#87b3a0" },
];
const row = (hits) => Array.from({ length: 16 }, (_, i) => hits.includes(i));
export const presets = [
  {
    name: "Dusty pocket",
    genre: "LO-FI / HEAD NOD",
    bpm: 92,
    swing: 12,
    pattern: [
      [0, 6, 8, 14],
      [4, 12],
      [0, 2, 4, 6, 8, 10, 12, 14],
      [7, 15],
      [12],
      [11],
    ].map(row),
  },
  {
    name: "After midnight",
    genre: "HOUSE / FOUR ON THE FLOOR",
    bpm: 124,
    swing: 0,
    pattern: [
      [0, 4, 8, 12],
      [4, 12],
      [2, 6, 10, 14],
      [2, 10],
      [4, 12],
      [15],
    ].map(row),
  },
  {
    name: "Side streets",
    genre: "BROKEN BEAT / OFF THE GRID",
    bpm: 108,
    swing: 35,
    pattern: [
      [0, 3, 10],
      [4, 12, 15],
      [0, 2, 5, 6, 8, 10, 13, 14],
      [7],
      [12],
      [9, 11],
    ].map(row),
  },
];
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const stepDuration = (bpm) => 60 / bpm / 4;
export const stepOffset = (step, bpm, swing) =>
  (step + (step % 2 ? swing / 100 : 0)) * stepDuration(bpm);
export function validSession(s) {
  return Boolean(
    s &&
      typeof s.name === "string" &&
      s.name.length <= 80 &&
      Number.isFinite(s.bpm) &&
      s.bpm >= 50 &&
      s.bpm <= 200 &&
      Number.isFinite(s.swing) &&
      s.swing >= 0 &&
      s.swing <= 60 &&
      Number.isFinite(s.volume) &&
      s.volume >= 0 &&
      s.volume <= 100 &&
      Array.isArray(s.pattern) &&
      s.pattern.length === 6 &&
      s.pattern.every(
        (r) =>
          Array.isArray(r) &&
          r.length === 16 &&
          r.every((v) => typeof v === "boolean"),
      ) &&
      Array.isArray(s.muted) &&
      s.muted.length === 6 &&
      s.muted.every((v) => typeof v === "boolean"),
  );
}
export function encodeWav(buffer) {
  const data = buffer.getChannelData(0),
    output = new ArrayBuffer(44 + data.length * 2),
    view = new DataView(output);
  const string = (at, text) =>
    [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  string(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, data.length * 2, true);
  data.forEach((sample, i) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
  });
  return output;
}
