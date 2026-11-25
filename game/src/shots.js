// Screenshot staging for Lantern Wok: ?shot=cover|rush|serve|end (with &seed=N) freezes a real,
// hand-arranged mid-service moment of the actual game state — real orders on the board, a real
// wok mid-cook, a real plate mid-assembly — so captures show the game exactly as it plays.

import { RECIPES } from './config.js';
import { SCREEN_PLAY, SCREEN_RESULTS } from './render.js';

function ticket(k, dishIds, patienceFrac) {
  const max = 70;
  const order = {
    id: k.orders.length + 1,
    dishes: dishIds.map((recipeId) => ({ recipeId, served: false })),
    patience: max * patienceFrac,
    maxPatience: max,
  };
  k.orders.push(order);
  return order;
}

function steamAt(k, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    k.particles.push({ x: x - 16 + i * 14, y: y - i * 9, vx: 0, vy: -30, life: 0.8, color: 'steam', size: 6 + i * 1.5 });
  }
}

function coinBurstAt(k, x, y) {
  const spots = [[-30, -40], [-8, -62], [16, -48], [34, -70], [-44, -16], [44, -22], [0, -30], [22, -84]];
  for (const [dx, dy] of spots) {
    k.particles.push({ x: x + dx, y: y + dy, vx: 0, vy: 0, life: 0.9, color: '#ffd94d', size: 4.5 });
  }
}

function base(k, elapsed, score, combo, served) {
  k.elapsed = elapsed;
  k.timeLeft = 180 - elapsed;
  k.score = score;
  k.combo = combo;
  k.comboTimer = combo > 1 ? 6 : 0;
  k.bestCombo = combo;
  k.servedCount = served;
  k.rushAnnounced = elapsed >= 78;
}

/** Cover: mid-service — three tickets, chef mid-chop, a wok cooking, a plate 2 of 3 assembled. */
function stageCover(k) {
  base(k, 65, 145, 2, 5);
  ticket(k, ['friedRice'], 0.8);
  ticket(k, ['chiliChicken'], 0.55);
  ticket(k, ['noodleBowl'], 0.92);
  k.chef.x = 330; k.chef.y = 452;
  k.carry = [{ ing: 'chicken', state: 'raw' }];
  k.chop.itemIndex = 0;
  k.chop.progress = 0.6;
  k.woks[0].item = { ing: 'shrimp', state: 'raw' };
  k.woks[0].phase = 'cooking';
  k.woks[0].progress = 0.52;
  steamAt(k, 585, 268, 4);
  k.plate = [{ ing: 'rice', state: 'cooked' }, { ing: 'egg', state: 'cooked' }];
  return SCREEN_PLAY;
}

/** Rush hour: four tickets, both woks busy, banner up, chef crossing the floor with produce. */
function stageRush(k) {
  base(k, 112, 268, 4, 9);
  ticket(k, ['royalPlatter'], 0.42);
  ticket(k, ['friedRice', 'noodleBowl'], 0.66);
  ticket(k, ['chiliChicken'], 0.3);
  ticket(k, ['noodleBowl'], 0.85);
  k.bannerText = 'RUSH HOUR!';
  k.bannerTimer = 2.6;
  k.chef.x = 712; k.chef.y = 452; k.chef.facing = 1;
  k.carry = [{ ing: 'greens', state: 'raw' }, { ing: 'chili', state: 'raw' }];
  k.woks[0].item = { ing: 'chicken', state: 'chopped' };
  k.woks[0].phase = 'cooking';
  k.woks[0].progress = 0.62;
  k.woks[0].stirred = true;
  steamAt(k, 585, 268, 4);
  k.woks[1].item = { ing: 'egg', state: 'cooked' };
  k.woks[1].phase = 'done';
  k.woks[1].burnTimer = 2.1;
  k.plate = [{ ing: 'noodles', state: 'cooked' }, { ing: 'egg', state: 'cooked' }, { ing: 'greens', state: 'chopped' }];
  return SCREEN_PLAY;
}

/** Serve: a finished Lantern Fried Rice on its way to the pass, combo live, coins bursting. */
function stageServe(k) {
  base(k, 96, 214, 3, 7);
  ticket(k, ['friedRice'], 0.82);
  ticket(k, ['noodleBowl'], 0.6);
  k.chef.x = 1052; k.chef.y = 408; k.chef.facing = 1;
  k.carry = [{ plate: 'friedRice' }];
  k.woks[0].item = { ing: 'noodles', state: 'raw' };
  k.woks[0].phase = 'cooking';
  k.woks[0].progress = 0.3;
  steamAt(k, 585, 268, 3);
  k.plate = [{ ing: 'greens', state: 'chopped' }];
  coinBurstAt(k, 1140, 330);
  k.floaters.push({ x: 1000, y: 300, text: `${RECIPES.friedRice.name} — ready to serve!`, color: '#8be26a', life: 1.1 });
  return SCREEN_PLAY;
}

/** End: the results screen of a strong shift — three stars, fourteen dishes, best combo x5. */
function stageEnd(k) {
  base(k, 180, 386, 0, 14);
  k.timeLeft = 0;
  k.bestCombo = 5;
  k.lostCount = 2;
  k.over = true;
  k.chef.x = 640; k.chef.y = 470;
  return SCREEN_RESULTS;
}

/** Set kitchen `k` to the named scene and return the screen to draw over it. */
export function stageShot(name, k) {
  if (name === 'rush') return stageRush(k);
  if (name === 'serve') return stageServe(k);
  if (name === 'end') return stageEnd(k);
  return stageCover(k);
}
