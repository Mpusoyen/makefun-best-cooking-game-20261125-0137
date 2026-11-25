// Keyboard and mouse state for Lantern Wok. Held keys give a movement vector; the interact key is
// exposed both as an edge (pressed this frame) and as held (chopping is hold-to-chop). A mouse
// click on a station sets a walk target: the chef walks there and interacts on arrival.

import { FIELD, STATIONS } from './config.js';

const held = new Set();
let interactEdge = false;
let confirmEdge = false;
let pauseEdge = false;
let clickTarget = null; // { x, y, stationId } in logical canvas coordinates

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function attachInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'KeyE') interactEdge = true;
    if (event.code === 'Enter') confirmEdge = true;
    if (event.code === 'KeyP' || event.code === 'Escape') pauseEdge = true;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * FIELD.width;
    const y = ((event.clientY - rect.top) / rect.height) * FIELD.height;
    confirmEdge = true;
    let stationId = null;
    for (const s of STATIONS) {
      if (Math.abs(x - s.x) <= s.w / 2 + 14 && Math.abs(y - s.y) <= s.h / 2 + 14) stationId = s.id;
    }
    clickTarget = { x, y, stationId };
  });
}

/** Movement vector from held keys, normalized; { x: 0, y: 0 } when idle. */
export function moveVector() {
  let x = 0;
  let y = 0;
  for (const code of held) {
    const v = MOVE_KEYS[code];
    if (v) { x += v[0]; y += v[1]; }
  }
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

export function interactHeld() {
  return held.has('Space') || held.has('KeyE');
}

/** True once per interact press; consumes the edge. */
export function takeInteract() {
  const was = interactEdge;
  interactEdge = false;
  return was;
}

export function takeConfirm() {
  const was = confirmEdge;
  confirmEdge = false;
  return was;
}

export function takePause() {
  const was = pauseEdge;
  pauseEdge = false;
  return was;
}

/** The pending click walk-target, or null. Cleared by the kitchen when reached or overridden. */
export function getClickTarget() {
  return clickTarget;
}
export function clearClickTarget() {
  clickTarget = null;
}
export function hasMoveInput() {
  const v = moveVector();
  return v.x !== 0 || v.y !== 0;
}
