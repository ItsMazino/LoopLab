import { presets, voices, clone, validSession } from "./pattern.js";
import { DrumEngine, renderWav } from "./audio.js";
const $ = (s) => document.querySelector(s);
let state = { ...clone(presets[0]), volume: 70, muted: Array(6).fill(false) },
  history = [],
  stored = null,
  toastTimer,
  busy = false;
try {
  const candidate = JSON.parse(localStorage.getItem("looplab-v1"));
  if (validSession(candidate)) stored = candidate;
} catch {}
const engine = new DrumEngine(() => state, showStep);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3000);
}
function remember() {
  history.push(clone(state));
  if (history.length > 40) history.shift();
}
function showStep(step) {
  document
    .querySelectorAll(".pad")
    .forEach((p) =>
      p.classList.toggle("playing", Number(p.dataset.step) === step),
    );
  document
    .querySelectorAll(".step-number")
    .forEach((p, i) => p.classList.toggle("current", i === step));
  $("#position").innerHTML =
    `${String(Math.max(0, step) + 1).padStart(2, "0")}<span> / 16</span>`;
  document
    .querySelectorAll("#beat-lights i")
    .forEach((p, i) =>
      p.classList.toggle("lit", step >= 0 && Math.floor(step / 4) === i),
    );
}
function render() {
  $("#pattern-name").textContent = state.name.toUpperCase();
  $("#bpm").value = state.bpm;
  $("#swing").value = state.swing;
  $("#volume").value = state.volume;
  $("#swing-value").value = `${state.swing}%`;
  $("#volume-value").value = `${state.volume}%`;
  $("#undo").disabled = !history.length;
  $("#restore").disabled = !stored;
  document.querySelectorAll(".pad").forEach((p) => {
    const active =
      state.pattern[Number(p.dataset.track)][Number(p.dataset.step)];
    p.classList.toggle("active", active);
    p.setAttribute("aria-pressed", active);
  });
  document.querySelectorAll(".track").forEach((p, i) => {
    p.classList.toggle("muted", state.muted[i]);
    const mute = p.querySelector(".mute");
    mute.setAttribute("aria-pressed", state.muted[i]);
    mute.setAttribute(
      "aria-label",
      `${state.muted[i] ? "Unmute" : "Mute"} ${voices[i].name}`,
    );
    mute.textContent = state.muted[i] ? "OFF" : "ON";
  });
  document
    .querySelectorAll(".preset")
    .forEach((p, i) =>
      p.setAttribute("aria-pressed", state.name === presets[i].name),
    );
}
function stop() {
  engine.stop();
  $("#play").setAttribute("aria-pressed", "false");
  $("#play-label").textContent = "Play beat";
  $(".play-icon").textContent = "▶";
  $(".led").classList.remove("running");
}
for (let i = 0; i < 16; i++) {
  const span = document.createElement("span");
  span.className = "step-number";
  span.textContent = String(i + 1).padStart(2, "0");
  $("#step-numbers").append(span);
}
voices.forEach((voice, track) => {
  const row = document.createElement("div");
  row.className = "track";
  row.style.setProperty("--voice", voice.color);
  row.innerHTML = `<div class="voice-label"><span class="voice-index">0${track + 1}</span><button class="voice-preview" aria-label="Preview ${voice.name}"><strong>${voice.name}</strong><span>${voice.note}</span></button><button class="mute" aria-label="Mute ${voice.name}" aria-pressed="false">ON</button></div><div class="pads"></div>`;
  row.querySelector(".voice-preview").onclick = () =>
    engine
      .preview(voice.kind)
      .catch(() => toast("Audio is unavailable in this browser."));
  row.querySelector(".mute").onclick = () => {
    remember();
    state.muted[track] = !state.muted[track];
    render();
  };
  for (let step = 0; step < 16; step++) {
    const pad = document.createElement("button");
    pad.className = "pad";
    pad.dataset.track = track;
    pad.dataset.step = step;
    pad.setAttribute("aria-label", `${voice.name} step ${step + 1}`);
    pad.setAttribute("aria-pressed", false);
    pad.onclick = () => {
      remember();
      state.pattern[track][step] = !state.pattern[track][step];
      state.name = "Your pocket";
      render();
    };
    pad.onkeydown = (event) => {
      const directions = {
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
      };
      if (directions[event.key]) {
        event.preventDefault();
        const [y, x] = directions[event.key];
        $(
          `.pad[data-track="${(track + y + 6) % 6}"][data-step="${(step + x + 16) % 16}"]`,
        ).focus();
      }
    };
    row.querySelector(".pads").append(pad);
  }
  $("#tracks").append(row);
});
presets.forEach((preset, i) => {
  const button = document.createElement("button");
  button.className = "preset";
  button.innerHTML = `<span class="preset-meta"><span>0${i + 1}</span><span>${preset.bpm} BPM ↗</span></span><strong>${preset.name}</strong><span class="mini-pattern" aria-hidden="true">${preset.pattern[0].map((active) => `<i class="${active ? "on" : ""}"></i>`).join("")}</span><span class="genre">${preset.genre}</span>`;
  button.onclick = () => {
    stop();
    remember();
    state = {
      ...clone(preset),
      volume: state.volume,
      muted: Array(6).fill(false),
    };
    render();
  };
  $("#presets").append(button);
});
$("#play").onclick = async () => {
  if (busy) return;
  if (engine.running) return stop();
  busy = true;
  try {
    await engine.start();
    $("#play").setAttribute("aria-pressed", "true");
    $("#play-label").textContent = "Stop beat";
    $(".play-icon").textContent = "■";
    $(".led").classList.add("running");
  } catch {
    toast("Audio is unavailable. Try a browser with Web Audio support.");
  } finally {
    busy = false;
  }
};
$("#bpm").onchange = (event) => {
  remember();
  const value = Number(event.target.value);
  state.bpm =
    Number.isFinite(value) && value
      ? Math.max(50, Math.min(200, Math.round(value)))
      : 92;
  render();
};
$("#swing").oninput = (event) => {
  state.swing = Number(event.target.value);
  $("#swing-value").value = `${state.swing}%`;
};
$("#volume").oninput = (event) => {
  state.volume = Number(event.target.value);
  engine.setVolume(state.volume);
  $("#volume-value").value = `${state.volume}%`;
};
$("#clear").onclick = () => {
  remember();
  state.pattern = Array.from({ length: 6 }, () => Array(16).fill(false));
  state.name = "Blank canvas";
  render();
  toast("Pattern cleared. Undo brings it back.");
};
$("#undo").onclick = () => {
  if (history.length) {
    state = history.pop();
    engine.setVolume(state.volume);
    render();
  }
};
$("#save").onclick = () => {
  try {
    localStorage.setItem("looplab-v1", JSON.stringify(state));
    stored = clone(state);
    render();
    toast("Session saved on this device.");
  } catch {
    toast("Storage unavailable. Export your beat as WAV instead.");
  }
};
$("#restore").onclick = () => {
  if (stored) {
    stop();
    remember();
    state = clone(stored);
    render();
    toast("Your saved session is back.");
  }
};
$("#export").onclick = async () => {
  if (
    !state.pattern.some((row, i) => !state.muted[i] && row.some(Boolean)) ||
    state.volume === 0
  )
    return toast("Add an unmuted hit and turn up the master first.");
  const button = $("#export");
  button.disabled = true;
  button.textContent = "Rendering…";
  try {
    const snapshot = clone(state),
      wav = await renderWav(snapshot);
    const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `looplab-${snapshot.bpm}bpm.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("One bar, ready to loop. WAV exported.");
  } catch {
    toast("Could not render audio in this browser.");
  } finally {
    button.disabled = false;
    button.textContent = "↗ Export WAV";
  }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && engine.running) {
    stop();
    toast("Playback paused while the tab was away.");
  }
});
window.addEventListener("pagehide", stop);
render();
