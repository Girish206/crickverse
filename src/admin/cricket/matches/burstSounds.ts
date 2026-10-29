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

// A real bat hit: a match ball struck on an English willow bat
let batHit: AudioBuffer | null = null;
let batHitLoading = false;

async function ensureBatHit(ac: AudioContext) {
  if (batHit || batHitLoading) return batHit;
  batHitLoading = true;
  try {
    const res = await fetch("/assets/sounds/bat-hit.wav");
    if (res.ok) {
      const data = await res.arrayBuffer();
      batHit = await ac.decodeAudioData(data);
    }
  } catch {
    // fallback to synthetic batCrack
  } finally {
    batHitLoading = false;
  }
  return batHit;
}

// The recorded hit; a six a touch deeper and louder than a four.
function playBatHit(ac: AudioContext, at: number, buf: AudioBuffer, power: number) {
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 - power * 0.08;
  const g = ac.createGain();
  g.gain.value = 0.85 + power * 0.4;
  src.connect(g).connect(ac.destination);
  src.start(at);
}

// Bat on ball: willow crack + hollow body thump.
function batCrack(ac: AudioContext, at: number, power: number) {
  // Initial sharp click of leather meeting wood
  hiss(ac, at, "bandpass", 3200, 1.2, 0.001, 0.85 + power * 0.35, 0.025);
  // Deeper wooden bat resonance
  hiss(ac, at, "lowpass", 600, 1.5, 0.002, 0.6 + power * 0.4, 0.06);
  // Bat blade harmonics
  const len = 0.09 + power * 0.05;
  [[1180, 0.38], [1870, 0.22], [2760, 0.12]].forEach(([f, a], i) =>
    ring(ac, at, f, len / (1 + i * 0.3), a * (0.9 + power * 0.5)));
  // Deep body thump
  ring(ac, at, 180, 0.07, 0.5 + power * 0.3);
  if (power >= 0.8) {
    // Sub-bass punch for a monster six
    tone(ac, at, "sine", 110, 0.12, 0.6, 45);
  }
}

// Celebratory fanfare for a FOUR: sharp bat hit + cheerful rising 4-note arpeggio
function playFourCelebration(ac: AudioContext, at: number) {
  if (batHit) playBatHit(ac, at, batHit, 0.6);
  else batCrack(ac, at, 0.6);

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

// Celebratory fanfare for a SIX: thunderous bat smash + triumphant stadium fanfare chords
function playSixCelebration(ac: AudioContext, at: number) {
  if (batHit) playBatHit(ac, at, batHit, 1.2);
  batCrack(ac, at, 1.0);

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
  // Try preloading the hit buffer for next time if not loaded
  void ensureBatHit(ac);

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
