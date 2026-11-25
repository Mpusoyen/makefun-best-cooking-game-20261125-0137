// The kitchen simulation: chef movement, carrying, and every station interaction — crates,
// chopping board, the two woks, the plating shelf, the serving pass and the trash. Also owns the
// shift clock, order spawning, score/combo bookkeeping, particles and floating feedback text.

import {
  FIELD, BOARD_HEIGHT, HUD_HEIGHT, SHIFT_SECONDS, CHEF_SPEED, CARRY_MAX, CHOP_SECONDS,
  COOK_SECONDS, BURN_GRACE_SECONDS, COMBO_WINDOW_SECONDS, MAX_ORDERS, STATIONS, stationById,
  INGREDIENTS, RECIPES, spawnInterval, isRush, STAR_THRESHOLDS, needsChop, needsCook, fullPrep,
} from './config.js';
import { makeOrder, findOrderForDish, orderComplete, orderReward, patienceFraction, resetOrderIds } from './orders.js';
import * as input from './input.js';
import * as sound from './audio.js';

const FLOOR_TOP = BOARD_HEIGHT + HUD_HEIGHT + 6;
const INTERACT_RANGE = 96;

export function createKitchen(rng) {
  resetOrderIds();
  return {
    rng,
    elapsed: 0,
    timeLeft: SHIFT_SECONDS,
    spawnTimer: 1.2, // first ticket arrives almost at once
    orders: [],
    chef: { x: 640, y: 470, facing: 1, walkPhase: 0, moving: false },
    carry: [], // items: { ing, state } or a finished plate: { plate: recipeId }
    woks: [
      { stationId: 'wok-1', item: null, progress: 0, phase: 'idle', burnTimer: 0, stirred: false, sizzleTimer: 0 },
      { stationId: 'wok-2', item: null, progress: 0, phase: 'idle', burnTimer: 0, stirred: false, sizzleTimer: 0 },
    ],
    plate: [], // components waiting on the plating shelf: { ing, state }
    chop: { itemIndex: -1, progress: 0 },
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    servedCount: 0,
    lostCount: 0,
    rushAnnounced: false,
    bannerTimer: 0,
    bannerText: '',
    particles: [],
    floaters: [],
    shake: 0,
    message: '',
    messageTimer: 0,
    over: false,
  };
}

function floater(k, x, y, text, color) {
  k.floaters.push({ x, y, text, color, life: 1.1 });
}

function burst(k, x, y, color, count, speed = 130) {
  for (let i = 0; i < count; i += 1) {
    const a = k.rng() * Math.PI * 2;
    const v = speed * (0.35 + k.rng() * 0.75);
    k.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.55 + k.rng() * 0.3, color, size: 2 + k.rng() * 3 });
  }
}

function steam(k, x, y) {
  k.particles.push({ x: x + (k.rng() - 0.5) * 34, y, vx: (k.rng() - 0.5) * 12, vy: -46 - k.rng() * 26, life: 0.9, color: 'steam', size: 5 + k.rng() * 6 });
}

function nearestStation(k, kinds) {
  let best = null;
  let bestDist = INTERACT_RANGE;
  for (const s of STATIONS) {
    if (kinds && !kinds.includes(s.kind)) continue;
    const d = Math.hypot(k.chef.x - s.x, k.chef.y - s.y);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

export function nearestStationAny(k) {
  return nearestStation(k, null);
}

function say(k, text) {
  k.message = text;
  k.messageTimer = 1.6;
}

/** The recipe the shelf plate exactly matches (all parts present, nothing extra), or null. */
export function plateMatch(k) {
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.parts.length !== k.plate.length) continue;
    const used = new Array(k.plate.length).fill(false);
    let ok = true;
    for (const part of recipe.parts) {
      const idx = k.plate.findIndex((c, i) => !used[i] && c.ing === part.ing && c.state === part.prep);
      if (idx < 0) { ok = false; break; }
      used[idx] = true;
    }
    if (ok) return recipe;
  }
  return null;
}

/** True when the shelf plate could still grow into some recipe (subset of its parts). */
function plateIsPartial(k) {
  return Object.values(RECIPES).some((recipe) =>
    k.plate.every((c) => recipe.parts.some((p) => p.ing === c.ing && p.prep === c.state)));
}

function interact(k) {
  const station = nearestStation(k, null);
  if (!station) return;
  const chef = k.chef;

  if (station.kind === 'crate') {
    if (k.carry.length >= CARRY_MAX) { sound.playBuzz(); say(k, 'Hands full!'); return; }
    if (k.carry.some((c) => c.plate)) { sound.playBuzz(); say(k, 'Serve that plate first!'); return; }
    k.carry.push({ ing: station.ing, state: 'raw' });
    sound.playPop();
    burst(k, station.x, station.y - 20, INGREDIENTS[station.ing].color, 5, 80);
    return;
  }

  if (station.kind === 'board') {
    // Chopping is hold-to-chop (handled in update); a tap just gives feedback.
    if (!k.carry.some((c) => c.ing && needsChop(c.ing, c.state))) { sound.playBuzz(); say(k, 'Nothing to chop — bring chicken, greens or chili'); }
    return;
  }

  if (station.kind === 'wok') {
    const wok = k.woks.find((w) => w.stationId === station.id);
    if (wok.phase === 'idle') {
      const idx = k.carry.findIndex((c) => c.ing && needsCook(c.ing, c.state));
      if (idx < 0) { sound.playBuzz(); say(k, 'Nothing for the wok'); return; }
      wok.item = k.carry.splice(idx, 1)[0];
      wok.progress = 0;
      wok.phase = 'cooking';
      wok.stirred = false;
      sound.playPop();
    } else if (wok.phase === 'cooking') {
      if (!wok.stirred && wok.progress > 0.35) {
        wok.stirred = true;
        wok.progress = Math.min(0.92, wok.progress + 0.12);
        k.shake = Math.max(k.shake, 3);
        floater(k, station.x, station.y - 66, 'Stirred!', '#ffd98a');
        sound.playChop();
      }
    } else if (wok.phase === 'done' || wok.phase === 'burnt') {
      if (k.carry.length >= CARRY_MAX) { sound.playBuzz(); say(k, 'Hands full!'); return; }
      const item = wok.item;
      const wasBurnt = wok.phase === 'burnt';
      wok.item = null;
      wok.phase = 'idle';
      wok.progress = 0;
      if (wasBurnt) {
        say(k, 'Burnt! Trash it');
      } else {
        item.state = fullPrep(item.ing);
      }
      k.carry.push(item);
      sound.playPop();
    }
    return;
  }

  if (station.kind === 'shelf') {
    if (k.carry.length > 0 && !k.carry[0].plate) {
      const item = k.carry[0];
      if (item.state === 'burnt') { sound.playBuzz(); say(k, 'Too burnt to plate — trash it'); return; }
      if (fullPrep(item.ing) !== item.state) { sound.playBuzz(); say(k, `${INGREDIENTS[item.ing].name} is not prepped yet`); return; }
      if (k.plate.some((c) => c.ing === item.ing)) { sound.playBuzz(); say(k, 'Already on the plate'); return; }
      k.plate.push(k.carry.shift());
      sound.playPop();
      burst(k, station.x, station.y - 30, '#ffe9b0', 6, 90);
      const recipe = plateMatch(k);
      if (recipe) { floater(k, station.x, station.y - 84, `${recipe.name} ready!`, '#8be26a'); sound.playDing(); }
      else if (!plateIsPartial(k)) say(k, 'That mix matches no recipe…');
      return;
    }
    if (k.carry.length === 0) {
      const recipe = plateMatch(k);
      if (recipe) {
        k.carry.push({ plate: recipe.id });
        k.plate = [];
        sound.playDing();
        floater(k, chef.x, chef.y - 56, recipe.name, '#ffe9b0');
      } else if (k.plate.length > 0) {
        k.plate = []; // scrap a plate that cannot be finished as held
        sound.playTrash();
        say(k, 'Plate scrapped');
      }
    }
    return;
  }

  if (station.kind === 'pass') {
    const plateIdx = k.carry.findIndex((c) => c.plate);
    if (plateIdx < 0) { sound.playBuzz(); say(k, 'Bring a finished plate'); return; }
    const recipeId = k.carry[plateIdx].plate;
    const found = findOrderForDish(k.orders, recipeId);
    if (!found) { sound.playBuzz(); say(k, 'No ticket wants that dish'); return; }
    k.carry.splice(plateIdx, 1);
    found.dish.served = true;
    sound.playDing();
    if (orderComplete(found.order)) {
      completeOrder(k, found.order);
    } else {
      floater(k, station.x - 40, station.y - 90, `${RECIPES[recipeId].name} served — one to go!`, '#ffe9b0');
    }
    return;
  }

  if (station.kind === 'trash') {
    if (k.carry.length === 0) { sound.playBuzz(); return; }
    k.carry = [];
    sound.playTrash();
    burst(k, station.x, station.y - 16, '#9a8f7a', 7, 80);
  }
}

function completeOrder(k, order) {
  k.orders.splice(k.orders.indexOf(order), 1);
  k.combo = k.comboTimer > 0 ? k.combo + 1 : 1;
  k.comboTimer = COMBO_WINDOW_SECONDS;
  k.bestCombo = Math.max(k.bestCombo, k.combo);
  const multiplier = Math.min(k.combo, 5);
  let coins = orderReward(order) * multiplier;
  let tip = 0;
  if (patienceFraction(order) > 0.7) { tip = 6; coins += tip; }
  k.score += coins;
  k.servedCount += 1;
  sound.playCoins();
  const pass = stationById('pass');
  burst(k, pass.x - 30, pass.y - 60, '#ffd94d', 16, 170);
  floater(k, pass.x - 60, pass.y - 110, `+${coins} coins${tip ? ' (tip!)' : ''}`, '#ffd94d');
  if (multiplier > 1) floater(k, pass.x - 60, pass.y - 84, `Combo x${multiplier}`, '#ff9d5c');
}

function updateMovement(k, dt) {
  const chef = k.chef;
  let vx = 0;
  let vy = 0;
  const move = input.moveVector();
  if (move.x !== 0 || move.y !== 0) {
    input.clearClickTarget();
    vx = move.x;
    vy = move.y;
  } else {
    const target = input.getClickTarget();
    if (target) {
      const dx = target.x - chef.x;
      const dy = target.y - chef.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        input.clearClickTarget();
        if (target.stationId) interact(k);
      } else {
        vx = dx / d;
        vy = dy / d;
      }
    }
  }
  chef.moving = vx !== 0 || vy !== 0;
  if (chef.moving) {
    chef.x += vx * CHEF_SPEED * dt;
    chef.y += vy * CHEF_SPEED * dt;
    if (vx !== 0) chef.facing = vx > 0 ? 1 : -1;
    chef.walkPhase += dt * 11;
  }
  chef.x = Math.max(36, Math.min(FIELD.width - 36, chef.x));
  chef.y = Math.max(FLOOR_TOP + 22, Math.min(FIELD.height - 30, chef.y));
}

function updateChopping(k, dt) {
  const board = stationById('board');
  const near = Math.hypot(k.chef.x - board.x, k.chef.y - board.y) < INTERACT_RANGE;
  const idx = k.carry.findIndex((c) => c.ing && needsChop(c.ing, c.state));
  if (near && idx >= 0 && input.interactHeld()) {
    if (k.chop.itemIndex !== idx) { k.chop.itemIndex = idx; k.chop.progress = 0; }
    k.chop.progress += dt / CHOP_SECONDS;
    k.shake = Math.max(k.shake, 1.6);
    if (k.rng() < dt * 14) sound.playChop();
    if (k.chop.progress >= 1) {
      const item = k.carry[idx];
      item.state = 'chopped'; // chicken goes on to the wok from here; greens/chili are done
      k.chop.progress = 0;
      k.chop.itemIndex = -1;
      sound.playDing();
      burst(k, board.x, board.y - 24, INGREDIENTS[item.ing].color, 8, 100);
      floater(k, board.x, board.y - 62, `${INGREDIENTS[item.ing].name} chopped!`, '#c8f0a0');
    }
  } else if (k.chop.progress > 0 && !input.interactHeld()) {
    k.chop.progress = Math.max(0, k.chop.progress - dt * 0.7);
    if (k.chop.progress === 0) k.chop.itemIndex = -1;
  }
}

function updateWoks(k, dt) {
  for (const wok of k.woks) {
    const station = stationById(wok.stationId);
    if (wok.phase === 'cooking') {
      wok.progress += dt / COOK_SECONDS;
      wok.sizzleTimer -= dt;
      if (wok.sizzleTimer <= 0) { sound.playSizzle(); wok.sizzleTimer = 0.22; }
      if (k.rng() < dt * 16) steam(k, station.x, station.y - 34);
      if (wok.progress >= 1) {
        wok.phase = 'done';
        wok.burnTimer = BURN_GRACE_SECONDS;
        sound.playDing();
        floater(k, station.x, station.y - 70, 'Done!', '#8be26a');
      }
    } else if (wok.phase === 'done') {
      wok.burnTimer -= dt;
      if (wok.burnTimer <= 0) {
        wok.phase = 'burnt';
        wok.item.state = 'burnt';
        sound.playAlarm();
        floater(k, station.x, station.y - 70, 'BURNT!', '#ff6b5c');
        burst(k, station.x, station.y - 20, '#555049', 10, 90);
      }
    }
  }
}

function updateOrders(k, dt) {
  k.spawnTimer -= dt;
  const cap = isRush(k.elapsed) ? MAX_ORDERS + 1 : MAX_ORDERS;
  if (k.spawnTimer <= 0 && k.orders.length < cap) {
    k.orders.push(makeOrder(k.elapsed, k.rng));
    k.spawnTimer = spawnInterval(k.elapsed) * (0.75 + k.rng() * 0.5);
    sound.playPop();
  }
  for (let i = k.orders.length - 1; i >= 0; i -= 1) {
    const order = k.orders[i];
    order.patience -= dt;
    if (order.patience <= 0) {
      k.orders.splice(i, 1);
      k.lostCount += 1;
      k.combo = 0;
      k.comboTimer = 0;
      sound.playExpired();
      floater(k, 140 + i * 300, 128, 'Ticket lost!', '#ff8a7a');
    }
  }
}

/** Advance the whole kitchen by dt seconds. Sets k.over when the shift clock runs out. */
export function updateKitchen(k, dt) {
  if (k.over) return;
  k.elapsed += dt;
  k.timeLeft = Math.max(0, SHIFT_SECONDS - k.elapsed);
  if (k.timeLeft <= 0) { k.over = true; return; }

  if (!k.rushAnnounced && isRush(k.elapsed)) {
    k.rushAnnounced = true;
    k.bannerText = 'RUSH HOUR!';
    k.bannerTimer = 3.2;
    k.spawnTimer = Math.min(k.spawnTimer, 1.5);
  }
  if (k.bannerTimer > 0) k.bannerTimer -= dt;
  if (k.messageTimer > 0) k.messageTimer -= dt;
  if (k.comboTimer > 0) { k.comboTimer -= dt; if (k.comboTimer <= 0) k.combo = 0; }
  k.shake = Math.max(0, k.shake - dt * 14);

  updateMovement(k, dt);
  if (input.takeInteract()) interact(k);
  updateChopping(k, dt);
  updateWoks(k, dt);
  updateOrders(k, dt);

  for (let i = k.particles.length - 1; i >= 0; i -= 1) {
    const p = k.particles[i];
    p.life -= dt;
    if (p.life <= 0) { k.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.color !== 'steam') p.vy += 260 * dt;
  }
  for (let i = k.floaters.length - 1; i >= 0; i -= 1) {
    const f = k.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) k.floaters.splice(i, 1);
  }
}

/** Stars earned for a finished shift, 0–3. */
export function starsFor(k) {
  let stars = 0;
  for (const t of STAR_THRESHOLDS) if (k.score >= t) stars += 1;
  if (stars === 0 && k.servedCount > 0) stars = 1;
  return stars;
}
