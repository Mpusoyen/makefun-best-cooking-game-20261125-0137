// Lantern Wok sound board: every sound is synthesized with WebAudio — short filtered noise for
// chops and sizzles, small oscillator blips for pops, dings and coin bursts. No audio files, no
// network. The context is created lazily on the first user gesture so autoplay rules are honoured.

let ctx = null;
let master = null;

function ensureContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

/** Call from any click/keydown so later sounds are allowed to play. */
export function unlockAudio() {
  ensureContext();
}

function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
  if (!ensureContext()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

function noise(seconds, volume, filterFreq, type = 'bandpass', delay = 0) {
  if (!ensureContext()) return;
  const t0 = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

/** Quick pop when an ingredient is picked up or plated. */
export function playPop() {
  tone(420, 760, 0.09, 'sine', 0.25);
}

/** Knife-on-board thock while chopping. */
export function playChop() {
  noise(0.06, 0.5, 900);
  tone(180, 90, 0.05, 'triangle', 0.2);
}

/** A short sizzle burst; the kitchen calls this repeatedly while a wok cooks. */
export function playSizzle() {
  noise(0.16, 0.10, 5200, 'highpass');
}

/** Bright ding when a wok finishes or a dish is ready. */
export function playDing() {
  tone(1318, 1318, 0.22, 'sine', 0.22);
  tone(1760, 1760, 0.3, 'sine', 0.12, 0.05);
}

/** Coin burst arpeggio on a served order. */
export function playCoins() {
  tone(988, 988, 0.09, 'square', 0.10);
  tone(1318, 1318, 0.09, 'square', 0.10, 0.07);
  tone(1568, 1568, 0.16, 'square', 0.12, 0.14);
}

/** Two low buzzes when an action is refused (wrong plate, full hands). */
export function playBuzz() {
  tone(140, 120, 0.12, 'sawtooth', 0.12);
  tone(140, 110, 0.14, 'sawtooth', 0.12, 0.13);
}

/** Burn alarm: three sharp beeps when a wok item burns. */
export function playAlarm() {
  for (let i = 0; i < 3; i += 1) tone(880, 880, 0.09, 'square', 0.14, i * 0.13);
}

/** Soft thud for trashing something. */
export function playTrash() {
  noise(0.12, 0.3, 300, 'lowpass');
  tone(120, 60, 0.12, 'sine', 0.2);
}

/** Little two-note chime when an order's patience runs out. */
export function playExpired() {
  tone(520, 392, 0.18, 'triangle', 0.16);
  tone(392, 330, 0.24, 'triangle', 0.14, 0.14);
}
