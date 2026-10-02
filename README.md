# LoopLab

A pocket rhythm machine built entirely in the browser. LoopLab combines a six-voice drum synthesizer, a sixteen-step sequencer, a live transport, and local WAV rendering in a compact instrument-inspired interface.

**Repository:** [ItsMazino/LoopLab](https://github.com/ItsMazino/LoopLab)

## Table of Contents

1. [Product Overview](#product-overview)
2. [Core Features](#core-features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Sequencer and Timing](#sequencer-and-timing)
6. [Audio Synthesis](#audio-synthesis)
7. [WAV Export](#wav-export)
8. [State and Persistence](#state-and-persistence)
9. [Controls and Presets](#controls-and-presets)
10. [Project Structure](#project-structure)
11. [Local Development](#local-development)
12. [Scripts and Verification](#scripts-and-verification)
13. [Deployment](#deployment)
14. [Accessibility and Responsive Design](#accessibility-and-responsive-design)
15. [Performance and Privacy](#performance-and-privacy)
16. [Limitations and Troubleshooting](#limitations-and-troubleshooting)

## Product Overview

LoopLab is a focused one-bar beat maker. It is designed to be immediately playable: open the page, start a preset, toggle a few pads, adjust the groove, and export a loop.

A typical workflow:

1. Start the default groove or select another preset.
2. Toggle steps to place or remove drum hits.
3. Adjust tempo, swing, and master volume.
4. Preview or mute individual voices.
5. Save the session locally or export one bar as a WAV file.

The application needs no account, server, database, sample library, API key, or audio-generation service. All sound is synthesized through the Web Audio API.

## Core Features

| Feature | Behavior |
| --- | --- |
| Six synthesized voices | Kick, snare, closed hat, open hat, clap, and tom. |
| Sixteen-step grid | One bar of 4/4 at sixteenth-note resolution. |
| Playback transport | Play/stop control, current-step highlighting, and beat indicators. |
| Tempo | 50–200 BPM, clamped to the supported range. |
| Swing | 0–60%; delays odd-indexed offbeats while retaining the bar length. |
| Master volume | 0–100%, with gain smoothing. |
| Track controls | Preview each voice and toggle its mute state. |
| Presets | Three editable starter grooves. |
| Undo | Up to 40 previous session snapshots for supported edits. |
| Local session | Explicit save and restore for one session per browser origin. |
| WAV export | One-bar, mono, 44.1kHz, signed 16-bit PCM audio. |
| Mobile grid | Horizontal scrolling with visible voice labels. |

## Technology Stack

| Layer | Technology |
| --- | --- |
| Markup | Semantic HTML5 |
| Application logic | Vanilla JavaScript and ES modules |
| Audio playback | AudioContext, oscillator/buffer sources, filters, and gain nodes |
| Offline rendering | OfflineAudioContext |
| WAV encoding | ArrayBuffer and DataView |
| Styling | CSS Grid, Flexbox, media queries, custom properties |
| Development and bundling | Vite 7; exact resolved version in `package-lock.json` |
| Persistence | Browser localStorage |
| Tests | Node.js built-in test runner |
| Typography | Barlow Condensed, DM Sans, IBM Plex Mono |
| Hosting | Static deployment on Vercel |

There are no runtime package dependencies. Vite is the only direct development dependency. The npm `private` flag prevents package publication; it does not make the GitHub repository private.

## Architecture

```text
index.html
  -> main.js       Session state, controls, DOM updates, save/restore, downloads
       -> pattern.js   Presets, schema checks, timing helpers, WAV encoder
       -> audio.js     DrumEngine, sound synthesis, offline rendering
  -> style.css     Drum-machine interface and responsive layout
```

The site has one application page at `/`. UI state is kept separately from audio scheduling. `DrumEngine` receives a function for reading current state and a callback for updating the playhead, which keeps synthesis independent from DOM rendering.

## Sequencer and Timing

The pattern is a six-row array with sixteen boolean values in each row. A `true` value schedules a hit for that voice and step unless its track is muted.

```text
seconds per sixteenth note = 60 / BPM / 4
seconds per bar = 16 × seconds per sixteenth note
```

At 120 BPM, each unswung step is 0.125 seconds and a bar is 2 seconds.

The engine uses the AudioContext clock for sound start times. A JavaScript interval runs every 25ms and schedules sounds up to 100ms ahead. This avoids relying on a browser timer to trigger every sound at the exact moment it is due. UI highlighting uses separate timers and is a visual indicator rather than the audio clock.

For swing value `s`, adjacent step durations alternate between:

```text
base step × (1 + s / 100)
base step × (1 - s / 100)
```

The pair retains its original total duration. Playback begins from step one. The app stops playback when the tab becomes hidden, avoiding a stalled background scheduler and unintended continuing audio.

## Audio Synthesis

| Voice | Source and shaping |
| --- | --- |
| Kick | Sine oscillator with a downward frequency ramp from 150Hz toward 42Hz. |
| Snare | Noise through a band-pass filter centered at 2200Hz. |
| Closed hat | High-pass noise at 7500Hz with a short decay. |
| Open hat | High-pass noise at 7500Hz with a longer decay. |
| Clap | Band-pass noise at 1400Hz with repeated short gain peaks. |
| Tom | Sine oscillator with a downward frequency ramp from 240Hz toward 85Hz. |

Every hit has an attack/decay envelope. Noise buffers are cached per audio context, and sources disconnect after finishing. The master level scales the output and uses a short smoothing time to reduce abrupt gain changes.

AudioContext creation and resume happen after an explicit user action. This follows browser autoplay restrictions. Sound synthesis uses no microphone, recording permission, or downloaded samples.

## WAV Export

Export runs independently of real-time playback:

1. Snapshot the current pattern, tempo, swing, volume, and mute state.
2. Create an OfflineAudioContext at 44.1kHz.
3. Render two bars with the same synthesis functions used by playback.
4. Keep the second bar so release tails from the preceding bar carry into its beginning.
5. Encode a RIFF/WAVE header followed by signed 16-bit mono PCM samples.
6. Download `looplab-<bpm>bpm.wav` and release the temporary object URL.

The output frame count is the nearest whole sample to one bar's duration. Samples are clamped to the valid PCM range. Export refuses a pattern with no unmuted hits or a master volume of zero.

Noise-based voices use random noise, so repeated exports may not be byte-identical. Export is not a live recording of the current speaker output.

## State and Persistence

The session includes:

| Field | Meaning |
| --- | --- |
| `name` | Current preset/session label |
| `bpm` | Tempo between 50 and 200 |
| `swing` | Swing percentage between 0 and 60 |
| `volume` | Master level between 0 and 100 |
| `pattern` | Six arrays of sixteen booleans |
| `muted` | Six booleans, one per voice |

Optional preset metadata can also be present. The localStorage key is `looplab-v1`.

**Save session** replaces the single stored session. Reloading presents the starter groove; **Restore saved session** loads the saved data explicitly. Session validation checks types, supported numeric ranges, pattern dimensions, and mute flags before enabling restoration. Invalid data is ignored.

Undo snapshots cover step toggles, mute, tempo changes, preset loading, clearing, and restoring. Swing and master-volume adjustments are immediate controls and do not create undo snapshots. Playback position and audio nodes are never persisted.

Storage belongs to the current browser and origin. Preview URLs, localhost, and the production domain do not share a session. If saving fails, the app suggests exporting a WAV instead.

## Controls and Presets

| Preset | Tempo | Swing | Character |
| --- | --- | --- | --- |
| Dusty pocket | 92 BPM | 12% | Lo-fi, head-nod groove |
| After midnight | 124 BPM | 0% | House, four on the floor |
| Side streets | 108 BPM | 35% | Broken beat, syncopated pattern |

Click or tap pads to toggle hits. Arrow keys move between pads and wrap around the grid; Enter or Space activates the focused button. Voice-name buttons audition the sound, and ON/OFF buttons control mute. Preset selection stops playback before loading the new groove.

## Project Structure

```text
.github/workflows/ci.yml   GitHub Actions: install, test, build
src/
  audio.js                Web Audio synthesis and offline export
  main.js                 Session state, controls, and rendering
  pattern.js              Presets, timing, validation, WAV encoding
  style.css               Interface styling and responsive grid
tests/
  pattern.test.js         Session, timing, and WAV tests
.gitignore                Excludes dependencies, builds, local configuration
.vercelignore             Omits development-only deployment files
index.html                Application shell
package.json              Scripts and dependencies
package-lock.json         Reproducible dependency versions
vercel.json               Static Vite deployment configuration
README.md                 Project documentation
```

## Local Development

Use Node.js 22.12+ and npm. No environment variables are required.

```bash
git clone https://github.com/ItsMazino/LoopLab.git
cd LoopLab
npm ci
npm run dev
```

Use the local URL printed by Vite. To run alongside HueLab:

```bash
npm run dev -- --port 5174
```

## Scripts and Verification

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the development server. |
| `npm test` | Runs the core data/timing/export tests. |
| `npm run build` | Builds the static site into `dist/`. |
| `npm run preview` | Serves the production build locally. |

Tests cover preset/session validity, swing timing, bar duration, WAV headers, sample length, and signed PCM clipping. GitHub Actions installs from the lockfile, runs tests, and builds on pushes to `main` and pull requests.

Browser review checklist:

- Play and stop a preset; confirm the playhead advances.
- Toggle a pad, undo, mute a voice, and audition a sound.
- Change tempo, swing, and volume.
- Clear and restore a saved session, including after a reload.
- Export a WAV and verify that it contains audible samples and one bar of audio.
- Confirm an empty or silent pattern cannot be exported.
- Check desktop, tablet, and mobile layouts; scroll through all sixteen steps.
- Change tabs and confirm playback stops.

## Deployment

`vercel.json` declares the deployment settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

Import the repository into Vercel with `main` as the production branch. Git integration can automatically deploy later pushes. No audio backend, function, database, or storage integration is needed. Keep `.vercel/`, `node_modules/`, and local environment files out of Git.

The relative asset base also supports other static hosts and repository subdirectories.

## Accessibility and Responsive Design

The grid uses real buttons with voice/step labels and pressed states. Controls have keyboard focus styling, labelled ranges, a skip link, and polite status messages. Arrow-key navigation makes movement through the pad grid faster.

On narrower screens, the grid scrolls horizontally while voice labels remain visible. The rest of the layout stacks and reflows. Reduced-motion preferences disable nonessential transitions; the playhead remains functional feedback.

## Performance and Privacy

All audio is produced on the device. The app contains no analytics, accounts, microphone access, or backend requests. Google Fonts is the only external runtime request; fallback fonts preserve the interface when unavailable.

Real-time sources are short-lived, and each context reuses a noise buffer. WAV rendering is bounded to two bars of mono audio. No service worker or installable offline mode is included.

## Limitations and Troubleshooting

- The sequencer is one bar, six voices, and sixteen steps; it is not a full arrangement editor.
- There are no sample uploads, MIDI input, per-step velocity, solo mode, or cloud synchronization.
- Only one session is saved locally; saving again replaces it.
- Playback stops when the tab is hidden.
- Browsers must support AudioContext and OfflineAudioContext. Chromium was used for development verification; other browsers may have different audio behavior.
- If there is no sound, press Play, raise the master volume, check track mutes, and check the browser/system audio output.
- If export is unavailable, check that the pattern has unmuted hits and volume is above zero.
- If restore is disabled, there is no valid saved session on the current origin.
- If `npm ci` fails, check the Node.js version and lockfile.
