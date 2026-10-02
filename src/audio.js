import { stepDuration, stepOffset, encodeWav, voices } from "./pattern.js";
const noiseBuffers = new WeakMap();
function noise(context) {
  if (!noiseBuffers.has(context)) {
    const buffer = context.createBuffer(
      1,
      context.sampleRate,
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(context, buffer);
  }
  return noiseBuffers.get(context);
}
export function hit(context, destination, kind, at) {
  const tonal = kind === "kick" || kind === "tom";
  const duration = {
    kick: 0.36,
    tom: 0.24,
    snare: 0.16,
    hat: 0.045,
    open: 0.24,
    clap: 0.14,
  }[kind];
  const source = tonal
    ? context.createOscillator()
    : context.createBufferSource();
  const gain = context.createGain();
  if (tonal) {
    source.type = "sine";
    source.frequency.setValueAtTime(kind === "kick" ? 150 : 240, at);
    source.frequency.exponentialRampToValueAtTime(
      kind === "kick" ? 42 : 85,
      at + duration,
    );
    source.connect(gain);
  } else {
    source.buffer = noise(context);
    const filter = context.createBiquadFilter();
    filter.type = kind === "snare" || kind === "clap" ? "bandpass" : "highpass";
    filter.frequency.value =
      kind === "clap" ? 1400 : kind === "snare" ? 2200 : 7500;
    source.connect(filter);
    filter.connect(gain);
  }
  const peak = tonal
    ? 0.8
    : kind === "snare"
      ? 0.55
      : kind === "clap"
        ? 0.6
        : 0.24;
  gain.gain.setValueAtTime(0.001, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.002);
  if (kind === "clap") {
    for (let i = 1; i < 3; i++) {
      gain.gain.exponentialRampToValueAtTime(0.05, at + i * 0.012);
      gain.gain.linearRampToValueAtTime(peak, at + i * 0.012 + 0.003);
    }
  }
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  gain.connect(destination);
  source.start(at);
  source.stop(at + duration + 0.01);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}
export class DrumEngine {
  constructor(read, onStep) {
    this.read = read;
    this.onStep = onStep;
    this.running = false;
    this.step = 0;
    this.timer = null;
    this.frames = [];
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.setVolume(this.read().volume);
  }
  setVolume(value) {
    if (this.master)
      this.master.gain.setTargetAtTime(
        (value / 100) * 0.65,
        this.context.currentTime,
        0.015,
      );
  }
  async start() {
    await this.init();
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.nextAt = this.context.currentTime + 0.05;
    const schedule = () => {
      while (this.nextAt < this.context.currentTime + 0.1) {
        const state = this.read(),
          step = this.step;
        state.pattern.forEach((row, i) => {
          if (row[step] && !state.muted[i])
            hit(this.context, this.master, voices[i].kind, this.nextAt);
        });
        const id = setTimeout(
          () => {
            if (this.running) this.onStep(step);
            this.frames = this.frames.filter((v) => v !== id);
          },
          Math.max(0, (this.nextAt - this.context.currentTime) * 1000),
        );
        this.frames.push(id);
        this.nextAt +=
          stepDuration(state.bpm) *
          (step % 2 ? 1 - state.swing / 100 : 1 + state.swing / 100);
        this.step = (step + 1) % 16;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 25);
  }
  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.frames.forEach(clearTimeout);
    this.frames = [];
    if (this.master)
      this.master.gain.cancelScheduledValues(this.context.currentTime);
    if (this.master)
      this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.onStep(-1);
  }
  async preview(kind) {
    await this.init();
    hit(this.context, this.master, kind, this.context.currentTime);
  }
}
export async function renderWav(state) {
  const length = 16 * stepDuration(state.bpm),
    sampleRate = 44100;
  const frames = Math.round(length * sampleRate),
    context = new OfflineAudioContext(1, frames * 2, sampleRate),
    gain = context.createGain();
  gain.gain.value = (state.volume / 100) * 0.65;
  gain.connect(context.destination);
  for (let bar = 0; bar < 2; bar++)
    state.pattern.forEach((row, i) =>
      row.forEach((active, step) => {
        if (active && !state.muted[i])
          hit(
            context,
            gain,
            voices[i].kind,
            bar * length + stepOffset(step, state.bpm, state.swing),
          );
      }),
    );
  const audio = await context.startRendering(),
    data = audio.getChannelData(0).slice(frames);
  return encodeWav({ sampleRate, getChannelData: () => data });
}
