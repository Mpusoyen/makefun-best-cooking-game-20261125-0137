// Lantern Wok: Night Market Kitchen — boot and the game loop. Owns the screens (title, playing,
// paused, results), the shift clock hand-off to the kitchen, and screenshot staging: with
// ?shot=cover|rush|serve|end the staged scene is drawn frozen, exactly as captures need it.

import { FIELD } from './config.js';
import { createKitchen, updateKitchen, nearestStationAny } from './kitchen.js';
import {
  drawKitchen, drawTitle, drawPaused, drawResults,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_RESULTS,
} from './render.js';
import { stageShot } from './shots.js';
import * as input from './input.js';
import { unlockAudio } from './audio.js';

/** Small deterministic RNG (mulberry32) for screenshot staging; live play uses Math.random. */
export function seededRng(seed) {
  let a = seed >>> 0 || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

input.attachInput(canvas);
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

let screen = SCREEN_TITLE;
let kitchen = createKitchen(Math.random);
let frozen = false;

if (shotName) {
  kitchen = createKitchen(seededRng(seed));
  screen = stageShot(shotName, kitchen);
  frozen = true;
}

function startShift() {
  kitchen = createKitchen(Math.random);
  screen = SCREEN_PLAY;
}

let lastStatus = '';
function announce() {
  const text = screen === SCREEN_PLAY
    ? `Lantern Wok: ${Math.ceil(kitchen.timeLeft)} seconds left, ${kitchen.score} coins, ${kitchen.orders.length} tickets waiting.`
    : `Lantern Wok: ${screen} screen.`;
  if (text !== lastStatus) {
    lastStatus = text;
    status.textContent = text;
  }
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  if (!frozen) {
    if (screen === SCREEN_TITLE) {
      if (input.takeConfirm()) startShift();
    } else if (screen === SCREEN_PLAY) {
      if (input.takePause()) screen = SCREEN_PAUSED;
      else {
        updateKitchen(kitchen, dt);
        if (kitchen.over) screen = SCREEN_RESULTS;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.takePause() || input.takeConfirm()) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_RESULTS) {
      if (input.takeConfirm()) startShift();
    }
  }

  const near = screen === SCREEN_PLAY ? nearestStationAny(kitchen) : null;
  if (screen === SCREEN_TITLE) drawTitle(ctx, kitchen);
  else if (screen === SCREEN_PAUSED) drawPaused(ctx, kitchen);
  else if (screen === SCREEN_RESULTS) drawResults(ctx, kitchen);
  else drawKitchen(ctx, kitchen, near ? near.id : null);
  announce();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
