// Sounds for a four, a six or a wicket: a recording of bat on ball for a
// four or a six (a harder one for a six); made with Web Audio, the stumps
// rattling and a falling "wah-wah" for an out, a quack for a duck.
// The browser only lets sound play once the page has been clicked or tapped,
// so before that these stay silent.

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
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

// A struck note: there at once, dying away fast, its pitch held steady.
function ring(ac: AudioContext, at: number, freq: number, len: number, peak: number) {
  const osc = ac.createOscillator();
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

// A real bat hit: a match ball struck on an English willow bat (Freesound
// 594342 by GH0STY_XD, CC0), cut to one strike. Fetched and decoded as the
// page loads, so it's ready by the first boundary; batCrack stands in until
// then, or if it can't be loaded.
let batHit: AudioBuffer | null = null;
if (typeof window !== "undefined" && window.OfflineAudioContext) {
  fetch("/assets/sounds/bat-hit.wav")
    .then((r) => r.arrayBuffer())
    .then((data) => new OfflineAudioContext(1, 1, 48000).decodeAudioData(data))
    .then((buf) => (batHit = buf))
    .catch(() => {});
}

// The recorded hit; a six a touch deeper and louder than a four.
function playBatHit(ac: AudioContext, at: number, buf: AudioBuffer, power: number) {
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 - power * 0.08;
  const g = ac.createGain();
  g.gain.value = 0.7 + power * 0.3;
  src.connect(g).connect(ac.destination);
  src.start(at);
}

// Bat on ball, made up: the hollow "tock" of willow. A hard click of leather on wood,
// then the blade ringing at a few uneven pitches, gone in a tenth of a
// second, over a dull knock of the bat's body. `power` (0 to 1) hits harder.
function batCrack(ac: AudioContext, at: number, power: number) {
  hiss(ac, at, "bandpass", 3500, 0.9, 0.0008, 0.7 + power * 0.3, 0.012);
  const len = 0.07 + power * 0.04;
  [[1180, 0.32], [1870, 0.16], [2760, 0.08], [3900, 0.04]].forEach(([f, a], i) =>
    ring(ac, at, f, len / (1 + i * 0.4), a * (0.8 + power * 0.4)));
  ring(ac, at, 320, 0.045, 0.25 + power * 0.1);
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
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.02;
  if (kind === "four" || kind === "six") {
    const power = kind === "six" ? 1 : 0.5;
    if (batHit) playBatHit(ac, t, batHit, power);
    else batCrack(ac, t, power);
    return;
  }
  // Out: timed with the stumps going on the burst, then the "wah-wah".
  stumps(ac, t + 0.4);
  [392, 370, 349, 330].forEach((f, i) => tone(ac, t + 0.7 + i * 0.28, "sawtooth", f, i === 3 ? 0.7 : 0.26, 0.07, i === 3 ? 260 : undefined));
  if (kind === "duck") [0, 0.3, 0.55].forEach((dt) => quack(ac, t + 2 + dt));
}
