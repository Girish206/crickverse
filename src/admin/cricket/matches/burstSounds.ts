// Sounds for a four, a six or a wicket, played with Web Audio: the same
// recorded bat on ball for a four and a six (a six then gets the crowd); the
// stumps rattling and a falling "wah-wah" for an out, a quack for a duck.
// The browser only lets sound play once the page has been clicked or tapped,
// so before that these stay silent. Viewers can turn them off; the choice is
// remembered on this device.

import { useSyncExternalStore } from "react";

const MUTE_KEY = "cv-burst-sounds-off";
let muted = (() => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const muteListeners = new Set<() => void>();

export function setBurstSoundsOn(on: boolean) {
  muted = !on;
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, "1");
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  muteListeners.forEach((fn) => fn());
}

export function useBurstSoundsOn() {
  return useSyncExternalStore(
    (fn) => {
      muteListeners.add(fn);
      return () => muteListeners.delete(fn);
    },
    () => !muted,
    () => true,
  );
}

let ctx: AudioContext | null = null;

// Not running: never started, or paused by the phone (screen locked, app
// switched, a call; Safari calls that "interrupted").
const isAsleep = (ac: AudioContext) => ac.state !== "running";

function audio() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  if (!ctx) {
    ctx = new AudioContext();
    void loadBatHit(ctx);
  }
  if (isAsleep(ctx)) void ctx.resume().catch(() => {});
  return ctx;
}

// Wake the audio on every tap or key press while it's asleep, not just the
// first: phones pause it whenever the screen locks or the app goes to the
// background, and only a tap is allowed to start it again. Waking it early
// also has the recorded hit decoded before a four is scored, so the first
// one doesn't land after the animation has started.
if (typeof window !== "undefined") {
  const wake = () => {
    if (ctx && !isAsleep(ctx)) return;
    const ac = audio();
    // iPhones only fully unlock sound once something has been played inside
    // the tap itself: a single silent sample does it.
    if (ac) {
      try {
        const src = ac.createBufferSource();
        src.buffer = ac.createBuffer(1, 1, ac.sampleRate);
        src.connect(ac.destination);
        src.start();
      } catch {
        // Nothing to unlock with; the resume above is the best we can do.
      }
    }
  };
  // touchend and click: the events iOS counts as a tap for sound (it ignores
  // pointerdown); pointerdown and keydown for everything else.
  for (const type of ["pointerdown", "touchend", "click", "keydown"]) {
    window.addEventListener(type, wake, { capture: true, passive: true });
  }
  // Back from another app or a locked screen: try straight away (Chrome
  // allows it once the page has been tapped); a tap does it otherwise.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx && isAsleep(ctx)) void ctx.resume().catch(() => {});
  });
}

// A second of white noise, shared by everything that hisses or rattles.
let noiseBuffer: AudioBuffer | null = null;
function noise(ac: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

// A gain that rises to `peak` over `attack` seconds, then dies away by `end`.
function envelope(ac: AudioContext, at: number, attack: number, peak: number, end: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + end);
  g.connect(ac.destination);
  return g;
}

// Filtered noise, for a burst of crack, rattle or crowd.
function hiss(ac: AudioContext, at: number, type: BiquadFilterType, freq: number, q: number, attack: number, peak: number, end: number) {
  const src = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.connect(filter).connect(envelope(ac, at, attack, peak, end));
  src.start(at, Math.random() * 0.5);
  src.stop(at + end + 0.05);
  return filter;
}

// One note, its pitch optionally sliding to `to`.
function tone(ac: AudioContext, at: number, type: OscillatorType, freq: number, len: number, peak: number, to?: number) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + len);
  osc.connect(envelope(ac, at, 0.015, peak, len));
  osc.start(at);
  osc.stop(at + len + 0.05);
  return osc;
}

// Bat on ball, the same for a four and a six: a recorded hit, fetched and
// decoded once, then reused.
const BAT_BALL_URL = "/assets/sounds/bat-ball.mp3";
let batBuffer: AudioBuffer | null = null;
let batLoading: Promise<void> | null = null;

// The file is fetched as soon as this module loads, so the first four isn't
// kept waiting on the network; decoding needs the AudioContext, so it waits.
const fetchBatHit = () =>
  fetch(BAT_BALL_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))));
let batBytes: Promise<ArrayBuffer> | null = typeof window === "undefined" ? null : fetchBatHit();
batBytes?.catch(() => {}); // Reported, if need be, when it's decoded.
let batFailures = 0;

function loadBatHit(ac: AudioContext) {
  // After a few failures stop asking: the file isn't there.
  if (batFailures >= 3) return Promise.resolve();
  batLoading ??= (batBytes ?? fetchBatHit())
    .then((data) => ac.decodeAudioData(data))
    .then((buf) => {
      batBuffer = buf;
    })
    .catch((err) => {
      if (++batFailures === 1) console.warn("Couldn't load the bat-on-ball sound", err);
      batBytes = null;
      batLoading = null;
    });
  return batLoading;
}

// The recording's level against the synthesized sounds.
const BAT_GAIN = 0.8;
// Later than this after the boundary, the hit would land on the wrong moment.
const BAT_LATE = 0.25;

function batHit(ac: AudioContext, at: number) {
  const play = (when: number) => {
    if (!batBuffer) return;
    const src = ac.createBufferSource();
    src.buffer = batBuffer;
    const g = ac.createGain();
    g.gain.value = BAT_GAIN;
    src.connect(g).connect(ac.destination);
    src.start(when);
  };
  if (batBuffer) play(at);
  else
    void loadBatHit(ac).then(() => {
      if (ac.currentTime - at <= BAT_LATE) play(Math.max(at, ac.currentTime));
    });
}

// The crowd going up for a six: a swell of filtered noise after the hit.
function crowd(ac: AudioContext, at: number) {
  hiss(ac, at, "bandpass", 900, 0.8, 0.25, 0.12, 1.4);
  hiss(ac, at + 0.05, "bandpass", 2200, 1.2, 0.3, 0.06, 1.2);
}

// The stumps going: a few quick wooden knocks.
function stumps(ac: AudioContext, at: number) {
  [0, 0.04, 0.09, 0.16].forEach((dt, i) => {
    hiss(ac, at + dt, "bandpass", 2600 - i * 300, 4, 0.002, 0.5 - i * 0.08, 0.07);
    tone(ac, at + dt, "square", 520 - i * 60, 0.06, 0.06);
  });
}

function quack(ac: AudioContext, at: number) {
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(620, at);
  osc.frequency.exponentialRampToValueAtTime(380, at + 0.18);
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 3;
  osc.connect(filter).connect(envelope(ac, at, 0.01, 0.35, 0.2));
  osc.start(at);
  osc.stop(at + 0.25);
}

export type BurstSound = "four" | "six" | "out" | "duck";

export function playBurstSound(kind: BurstSound) {
  const ac = audio();
  if (!ac || muted) return;
  // Asleep: wait for it to wake (audio() has asked), then play on its fresh
  // clock; if it can't wake without a tap, the moment has passed anyway.
  if (isAsleep(ac)) {
    // Some browsers keep the wake pending until the next tap: by then the
    // burst is long over, so it stays silent rather than playing late.
    const asked = performance.now();
    void ac.resume().then(() => {
      if (performance.now() - asked < 1000) scheduleBurst(ac, kind);
    }, () => {});
    return;
  }
  scheduleBurst(ac, kind);
}

function scheduleBurst(ac: AudioContext, kind: BurstSound) {
  const t = ac.currentTime;
  if (kind === "four" || kind === "six") {
    batHit(ac, t);
    if (kind === "six") crowd(ac, t + 0.12);
    return;
  }
  // Out: timed with the stumps going on the burst, then the "wah-wah".
  stumps(ac, t + 0.4);
  [392, 370, 349, 330].forEach((f, i) =>
    tone(ac, t + 0.7 + i * 0.28, "sawtooth", f, i === 3 ? 0.7 : 0.26, 0.07, i === 3 ? 260 : undefined),
  );
  if (kind === "duck") [0, 0.3, 0.55].forEach((dt) => quack(ac, t + 2 + dt));
}
