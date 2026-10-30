// Sounds for a four, a six or a wicket, all made with Web Audio: the same
// bat on ball for a four and a six, then a fanfare of their own; the stumps
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

// Bat on ball, the same for a four and a six: a clean willow "tock". The
// leather's click, the blade ringing at its few wooden notes (each knocked
// a shade sharp, settling as it dies) and a short low thud from the
// handle — run through a compressor so it lands with a punch.
function batHit(ac: AudioContext, at: number) {
  const out = ac.createDynamicsCompressor();
  out.threshold.value = -18;
  out.ratio.value = 4;
  out.attack.value = 0.001;
  out.release.value = 0.08;
  out.connect(ac.destination);

  const voice = (src: AudioNode, attack: number, peak: number, end: number) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + end);
    src.connect(g).connect(out);
  };

  // The click: bright noise, over in a few milliseconds.
  const click = noise(ac);
  const clickFilter = ac.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.value = 2500;
  click.connect(clickFilter);
  voice(clickFilter, 0.0008, 0.9, 0.018);
  click.start(at, Math.random() * 0.5);
  click.stop(at + 0.03);

  // The blade's wooden notes.
  [
    [840, 0.55, 0.13],
    [1380, 0.32, 0.09],
    [2240, 0.16, 0.06],
  ].forEach(([freq, peak, len]) => {
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(freq * 1.04, at);
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.02);
    voice(osc, 0.001, peak, len);
    osc.start(at);
    osc.stop(at + len + 0.02);
  });

  // The thud.
  const thud = ac.createOscillator();
  thud.frequency.setValueAtTime(150, at);
  thud.frequency.exponentialRampToValueAtTime(85, at + 0.09);
  voice(thud, 0.002, 0.45, 0.1);
  thud.start(at);
  thud.stop(at + 0.12);
}

// Celebratory fanfare for a FOUR: the bat hit + cheerful rising 4-note arpeggio
function playFourCelebration(ac: AudioContext, at: number) {
  batHit(ac, at);

  // Joyful rising celebration fanfare: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
  const notes = [
    { freq: 523.25, time: 0.14, len: 0.18, peak: 0.14 },
    { freq: 659.25, time: 0.28, len: 0.18, peak: 0.16 },
    { freq: 783.99, time: 0.42, len: 0.20, peak: 0.18 },
    { freq: 1046.5, time: 0.58, len: 0.45, peak: 0.22 },
  ];
  notes.forEach((n) => {
    tone(ac, at + n.time, "triangle", n.freq, n.len, n.peak);
    ring(ac, at + n.time, n.freq * 2, n.len * 0.6, n.peak * 0.3);
  });
}

// Celebratory fanfare for a SIX: the same bat hit + triumphant stadium fanfare chords
function playSixCelebration(ac: AudioContext, at: number) {
  batHit(ac, at);

  // Stadium celebration shimmer
  hiss(ac, at + 0.15, "bandpass", 1600, 1.5, 0.04, 0.22, 0.85);

  // Triumphant dual-harmony brass chords:
  // Chord 1: C5 + G5
  tone(ac, at + 0.16, "triangle", 523.25, 0.24, 0.22);
  tone(ac, at + 0.16, "sine", 783.99, 0.24, 0.18);

  // Chord 2: E5 + C6
  tone(ac, at + 0.38, "triangle", 659.25, 0.24, 0.24);
  tone(ac, at + 0.38, "sine", 1046.5, 0.24, 0.20);

  // Chord 3: Grand triumphant crescendo G5 + E6
  tone(ac, at + 0.60, "triangle", 783.99, 0.65, 0.28);
  tone(ac, at + 0.60, "sine", 1318.51, 0.65, 0.24);
  ring(ac, at + 0.60, 2093.0, 0.55, 0.16);
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
  if (!ac) return;
  if (ac.state === "suspended") {
    void ac.resume();
  }

  const t = ac.currentTime + 0.02;
  if (kind === "four") {
    playFourCelebration(ac, t);
    return;
  }
  if (kind === "six") {
    playSixCelebration(ac, t);
    return;
  }
  // Out: timed with the stumps going on the burst, then the "wah-wah".
  stumps(ac, t + 0.4);
  [392, 370, 349, 330].forEach((f, i) =>
    tone(ac, t + 0.7 + i * 0.28, "sawtooth", f, i === 3 ? 0.7 : 0.26, 0.07, i === 3 ? 260 : undefined),
  );
  if (kind === "duck") [0, 0.3, 0.55].forEach((dt) => quack(ac, t + 2 + dt));
}
