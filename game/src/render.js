// All canvas drawing for Lantern Wok: the lantern-lit stall, order board, stations, food art,
// the chef, HUD and the title / pause / results overlays. Nothing here changes game state; it
// reads the kitchen and paints it. Food is drawn from shapes — every ingredient has its own
// little picture and a prep badge (knife for chopped, flame for wokked, ash for burnt).

import {
  FIELD, BOARD_HEIGHT, HUD_HEIGHT, STATIONS, INGREDIENTS, RECIPES, COMBO_WINDOW_SECONDS,
} from './config.js';
import { patienceFraction } from './orders.js';
import { plateMatch, starsFor } from './kitchen.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_RESULTS = 'results';

const INK = '#2b1a12';
const PAPER = '#ffedbe';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(0,0,0,0.35)') {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

function patienceColor(frac) {
  if (frac > 0.5) return '#7ec850';
  if (frac > 0.25) return '#f2b13c';
  return '#e84c3d';
}

/** One ingredient's picture at (x, y) inside a `size` box, with a prep badge when not raw. */
export function drawIngredientIcon(ctx, item, x, y, size) {
  const ing = INGREDIENTS[item.ing];
  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size / 44; // icons are designed on a 44px grid
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  if (item.state === 'burnt') {
    ctx.fillStyle = '#3a332c';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#191512'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(9, 8); ctx.moveTo(9, -6); ctx.lineTo(-9, 8); ctx.stroke();
    ctx.restore();
    return;
  }
  switch (item.ing) {
    case 'rice':
      ctx.fillStyle = '#8a5a33'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ing.color;
      for (const [gx, gy] of [[-8, -2], [0, -5], [8, -2], [-4, 1], [5, 1]]) {
        ctx.beginPath(); ctx.ellipse(gx, gy, 4.6, 2.4, 0.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'noodles':
      ctx.strokeStyle = ing.color; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      for (const off of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.moveTo(-13, off);
        ctx.bezierCurveTo(-5, off - 7, 5, off + 7, 13, off);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a5a33'; ctx.beginPath(); ctx.ellipse(0, 12, 16, 4, 0, 0, Math.PI); ctx.fill();
      break;
    case 'egg':
      ctx.fillStyle = ing.color; ctx.beginPath(); ctx.ellipse(0, 0, 14, 11, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ing.dark; ctx.beginPath(); ctx.arc(1, 0, 6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'chicken':
      ctx.fillStyle = ing.color;
      ctx.beginPath(); ctx.ellipse(-2, -2, 12, 9, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fdf6ec'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(13, 11); ctx.stroke();
      ctx.fillStyle = '#fdf6ec'; ctx.beginPath(); ctx.arc(14, 12, 3.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'shrimp':
      ctx.strokeStyle = ing.dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI * 0.7, Math.PI * 1.95); ctx.stroke();
      ctx.strokeStyle = ing.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI * 0.7, Math.PI * 1.95); ctx.stroke();
      ctx.fillStyle = ing.dark; ctx.beginPath(); ctx.arc(9, -8, 2.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'greens':
      ctx.fillStyle = ing.dark;
      for (const a of [-0.7, 0, 0.7]) {
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, -8, 5.5, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = ing.color; ctx.beginPath(); ctx.ellipse(0, -6, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'chili':
      ctx.strokeStyle = ing.color; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(2, 12, 11, -6); ctx.stroke();
      ctx.strokeStyle = '#3e7d27'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(11, -6); ctx.quadraticCurveTo(13, -11, 9, -13); ctx.stroke();
      break;
    default:
      ctx.fillStyle = ing.color; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Prep badge: knife ticks for chopped, a flame for wokked.
  if (item.state === 'chopped' || item.state === 'chopped+cooked') {
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 2;
    const bx = x + size - 9;
    const by = y + 5;
    ctx.beginPath(); ctx.moveTo(bx - 4, by + 4); ctx.lineTo(bx + 4, by - 4); ctx.stroke();
  }
  if (item.state === 'cooked' || item.state === 'chopped+cooked') {
    ctx.fillStyle = '#ff8a3c';
    const fx = x + size - 8;
    const fy = y + size - 6;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 7);
    ctx.quadraticCurveTo(fx + 5, fy - 1, fx + 2.5, fy + 4);
    ctx.quadraticCurveTo(fx, fy + 6, fx - 2.5, fy + 4);
    ctx.quadraticCurveTo(fx - 5, fy - 1, fx, fy - 7);
    ctx.fill();
  }
}

/** A finished plate: white disc, the dish's components arranged on it, name ribbon under. */
export function drawPlate(ctx, recipeId, x, y, size) {
  const recipe = RECIPES[recipeId];
  ctx.fillStyle = '#fdfbf4';
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8cdb4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
  const n = recipe.parts.length;
  recipe.parts.forEach((part, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = n === 1 ? 0 : size * 0.22;
    drawIngredientIcon(ctx, { ing: part.ing, state: part.prep }, x + Math.cos(a) * r - size * 0.19, y + Math.sin(a) * r - size * 0.19, size * 0.38);
  });
}

function drawOrderBoard(ctx, k) {
  ctx.fillStyle = '#3d2317';
  ctx.fillRect(0, 0, FIELD.width, BOARD_HEIGHT);
  ctx.fillStyle = '#5a3420';
  ctx.fillRect(0, BOARD_HEIGHT - 8, FIELD.width, 8);
  ctx.fillStyle = PAPER;
  ctx.font = '700 17px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('ORDERS', 18, 24);
  if (k.orders.length === 0) {
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#cdb694';
    ctx.fillText('Waiting for the first ticket…', 18, 66);
  }
  k.orders.forEach((order, i) => {
    const x = 110 + i * 292;
    const y = 10;
    const w = 280;
    const h = 98;
    ctx.fillStyle = '#fff6da';
    roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'left';
    let title = order.dishes.map((d) => RECIPES[d.recipeId].name).join(' + ');
    if (title.length > 34) title = `${title.slice(0, 33)}…`;
    ctx.fillText(title, x + 10, y + 19);
    // Ingredient icons for every unserved dish, ticked when served.
    let ix = x + 8;
    for (const dish of order.dishes) {
      for (const part of RECIPES[dish.recipeId].parts) {
        drawIngredientIcon(ctx, { ing: part.ing, state: part.prep }, ix, y + 26, 34);
        ix += 38;
      }
      if (dish.served) {
        ctx.strokeStyle = '#4d9b2f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ix - 34, y + 43); ctx.lineTo(ix - 26, y + 52); ctx.lineTo(ix - 12, y + 32); ctx.stroke();
      }
      ix += 8;
    }
    const frac = patienceFraction(order);
    bar(ctx, x + 10, y + 70, w - 70, 10, frac, patienceColor(frac));
    ctx.fillStyle = INK;
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'right';
    const reward = order.dishes.reduce((s, d) => s + RECIPES[d.recipeId].reward, 0);
    ctx.fillText(`${reward}c`, x + w - 10, y + 80);
    if (frac < 0.25 && Math.floor(k.elapsed * 4) % 2 === 0) {
      ctx.fillStyle = '#e84c3d';
      ctx.font = '700 13px Georgia, serif';
      ctx.fillText('HURRY!', x + w - 10, y + 19);
    }
  });
}

function drawHud(ctx, k) {
  const y = BOARD_HEIGHT;
  ctx.fillStyle = '#241209';
  ctx.fillRect(0, y, FIELD.width, HUD_HEIGHT);
  const mm = Math.floor(k.timeLeft / 60);
  const ss = Math.floor(k.timeLeft % 60).toString().padStart(2, '0');
  ctx.textAlign = 'left';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillStyle = k.timeLeft <= 20 ? '#ff7a5c' : '#ffd94d';
  ctx.fillText(`⏱ ${mm}:${ss}`, 18, y + 33);
  ctx.font = '700 24px Georgia, serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`Coins: ${k.score}`, 220, y + 32);
  if (k.combo > 1) {
    ctx.fillStyle = '#ff9d5c';
    ctx.fillText(`COMBO x${Math.min(k.combo, 5)}`, 470, y + 32);
    bar(ctx, 700, y + 14, 110, 12, k.comboTimer / COMBO_WINDOW_SECONDS, '#ff9d5c');
  }
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#d9c9a8';
  ctx.textAlign = 'right';
  ctx.fillText(`Served: ${k.servedCount}   Lost: ${k.lostCount}`, FIELD.width - 18, y + 28);
  if (k.messageTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = '700 17px Georgia, serif';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(k.message, FIELD.width / 2, y + 30);
  }
}

function drawFloor(ctx, k) {
  const top = BOARD_HEIGHT + HUD_HEIGHT;
  ctx.fillStyle = '#4a2c18';
  ctx.fillRect(0, top, FIELD.width, FIELD.height - top);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let y = top + 42; y < FIELD.height; y += 42) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
  }
  // Warm lantern glows.
  for (const [lx, ly] of [[220, 210], [760, 210], [1080, 640], [420, 620]]) {
    const g = ctx.createRadialGradient(lx, ly, 8, lx, ly, 130);
    g.addColorStop(0, 'rgba(255,166,66,0.20)');
    g.addColorStop(1, 'rgba(255,166,66,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - 130, ly - 130, 260, 260);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(lx, ly - 26, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, ly - 60); ctx.lineTo(lx, ly - 33); ctx.stroke();
  }
}

function drawStation(ctx, k, s, nearId) {
  const x = s.x - s.w / 2;
  const y = s.y - s.h / 2;
  const near = nearId === s.id;
  ctx.save();
  if (s.kind === 'crate') {
    ctx.fillStyle = '#7a4a26';
    roundRect(ctx, x, y, s.w, s.h, 8); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#54331a'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 6, y + s.h - 20, s.w - 12, 13);
    drawIngredientIcon(ctx, { ing: s.ing, state: 'raw' }, s.x - 24, y + 4, 48);
    ctx.fillStyle = PAPER; ctx.font = '700 13px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(s.label, s.x, y + s.h - 8);
  } else if (s.kind === 'board') {
    ctx.fillStyle = '#8a5f36';
    roundRect(ctx, x, y, s.w, s.h, 10); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#5d3c1e'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    ctx.fillStyle = '#e8cf9f';
    roundRect(ctx, x + 14, y + 12, s.w - 28, s.h - 40, 6); ctx.fill();
    const chopping = k.chop.itemIndex >= 0 ? k.carry[k.chop.itemIndex] : null;
    if (chopping) drawIngredientIcon(ctx, chopping, s.x - 22, s.y - 26, 44);
    ctx.fillStyle = PAPER; ctx.font = '700 13px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('CHOP', s.x, y + s.h - 9);
    if (k.chop.progress > 0) bar(ctx, x + 14, y + s.h - 24, s.w - 28, 7, k.chop.progress, '#c8f0a0');
  } else if (s.kind === 'wok') {
    const wok = k.woks.find((w) => w.stationId === s.id);
    ctx.fillStyle = '#33302e';
    roundRect(ctx, x, y, s.w, s.h, 12); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#17150f'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    // Flame under the pan.
    if (wok.phase !== 'idle') {
      ctx.fillStyle = '#ff7a2e';
      ctx.beginPath(); ctx.ellipse(s.x, y + s.h - 14, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.ellipse(s.x, y + s.h - 14, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#211d1a';
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, 44, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#45403a';
    ctx.beginPath(); ctx.ellipse(s.x, s.y - 8, 38, 21, 0, 0, Math.PI * 2); ctx.fill();
    if (wok.item) {
      drawIngredientIcon(ctx, wok.item, s.x - 20, s.y - 28, 40);
      if (wok.phase === 'cooking') {
        bar(ctx, x + 10, y + 8, s.w - 20, 9, wok.progress, '#ffb347');
        if (!wok.stirred && wok.progress > 0.35) {
          ctx.fillStyle = Math.floor(k.elapsed * 5) % 2 === 0 ? '#ffe9b0' : '#ff9d5c';
          ctx.font = '700 15px Georgia, serif'; ctx.textAlign = 'center';
          ctx.fillText('STIR!', s.x, y - 8);
        }
      } else if (wok.phase === 'done') {
        bar(ctx, x + 10, y + 8, s.w - 20, 9, wok.burnTimer / 3, '#e84c3d');
        ctx.fillStyle = '#8be26a'; ctx.font = '700 14px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('DONE', s.x, y - 10);
      } else if (wok.phase === 'burnt') {
        ctx.fillStyle = '#ff6b5c'; ctx.font = '700 14px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('BURNT!', s.x, y - 10);
      }
    } else {
      ctx.fillStyle = '#8d8578'; ctx.font = '700 12px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(s.label.toUpperCase(), s.x, y + s.h - 8);
    }
  } else if (s.kind === 'shelf') {
    ctx.fillStyle = '#6e4525';
    roundRect(ctx, x, y, s.w, s.h, 10); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#452a12'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    ctx.fillStyle = PAPER; ctx.font = '700 13px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('PLATING', s.x, y + 18);
    if (k.plate.length > 0) {
      ctx.fillStyle = '#fdfbf4';
      ctx.beginPath(); ctx.arc(s.x, s.y + 14, 34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d8cdb4'; ctx.lineWidth = 2; ctx.stroke();
      k.plate.forEach((c, i) => {
        const a = (i / Math.max(1, k.plate.length)) * Math.PI * 2 - Math.PI / 2;
        const r = k.plate.length === 1 ? 0 : 15;
        drawIngredientIcon(ctx, c, s.x + Math.cos(a) * r - 13, s.y + 14 + Math.sin(a) * r - 13, 26);
      });
      const match = plateMatch(k);
      ctx.font = '700 12px Georgia, serif';
      ctx.fillStyle = match ? '#8be26a' : '#ffe9b0';
      const label = match ? `${match.name} — ready!` : `${k.plate.length} on the plate`;
      ctx.fillText(label, s.x, y + s.h - 8);
    } else {
      ctx.fillStyle = '#cdb694'; ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText('plate components here', s.x, s.y + 44);
    }
  } else if (s.kind === 'pass') {
    ctx.fillStyle = '#59331d';
    roundRect(ctx, x, y, s.w, s.h, 10); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#33200f'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    ctx.fillStyle = '#ffd94d'; ctx.font = '700 15px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('SERVE', s.x, y + 26);
    ctx.fillText('PASS', s.x, y + 46);
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y + 74, 12, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x - 16, s.y + 74); ctx.lineTo(s.x + 16, s.y + 74); ctx.stroke();
  } else if (s.kind === 'trash') {
    ctx.fillStyle = '#4c4a45';
    roundRect(ctx, x, y, s.w, s.h, 8); ctx.fill();
    ctx.strokeStyle = near ? '#ffd94d' : '#26241f'; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    ctx.fillStyle = '#cfc9bd'; ctx.font = '700 12px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('TRASH', s.x, s.y + 20);
    ctx.fillRect(x + 12, y + 28, s.w - 24, 6);
  }
  ctx.restore();
}

function drawChef(ctx, k) {
  const chef = k.chef;
  const bob = chef.moving ? Math.sin(chef.walkPhase) * 3 : 0;
  const x = chef.x;
  const y = chef.y + bob;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, chef.y + 26, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Body and apron.
  ctx.fillStyle = '#b8433a';
  roundRect(ctx, x - 16, y - 8, 32, 34, 9); ctx.fill();
  ctx.fillStyle = '#fdf6ec';
  roundRect(ctx, x - 11, y - 2, 22, 26, 5); ctx.fill();
  // Head and toque.
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(x, y - 20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 11, y - 40, 22, 12, 5); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 6, y - 40, 7, 0, Math.PI * 2); ctx.arc(x + 6, y - 40, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x + chef.facing * 4, y - 20, 1.8, 0, Math.PI * 2); ctx.fill();
  // Carried things, held up front.
  k.carry.forEach((item, i) => {
    const ix = x + (i - (k.carry.length - 1) / 2) * 30;
    const iy = y + 16;
    ctx.fillStyle = 'rgba(20,12,6,0.55)';
    roundRect(ctx, ix - 17, iy - 17, 34, 34, 7); ctx.fill();
    if (item.plate) drawPlate(ctx, item.plate, ix, iy, 30);
    else drawIngredientIcon(ctx, item, ix - 15, iy - 15, 30);
  });
  ctx.restore();
}

function drawParticles(ctx, k) {
  for (const p of k.particles) {
    if (p.color === 'steam') {
      ctx.fillStyle = `rgba(240,240,235,${0.35 * Math.max(0, p.life)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (0.9 - p.life) * 7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.textAlign = 'center';
  for (const f of k.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.font = '700 17px Georgia, serif';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx, k) {
  if (k.bannerTimer <= 0) return;
  const a = Math.min(1, k.bannerTimer);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#a8232a';
  roundRect(ctx, FIELD.width / 2 - 210, 196, 420, 58, 12); ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(k.bannerText, FIELD.width / 2, 236);
  ctx.globalAlpha = 1;
}

/** The full in-play frame: board, HUD, floor, stations, chef, effects. */
export function drawKitchen(ctx, k, nearId) {
  drawFloor(ctx, k);
  drawOrderBoard(ctx, k);
  drawHud(ctx, k);
  const sx = k.shake ? (Math.sin(k.elapsed * 90) * k.shake * 0.4) : 0;
  ctx.save();
  ctx.translate(sx, 0);
  for (const s of STATIONS) drawStation(ctx, k, s, nearId);
  drawChef(ctx, k);
  drawParticles(ctx, k);
  ctx.restore();
  drawBanner(ctx, k);
}

function panel(ctx, w, h) {
  const x = FIELD.width / 2 - w / 2;
  const y = FIELD.height / 2 - h / 2;
  ctx.fillStyle = 'rgba(16,8,4,0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#fff3d0';
  roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = '#a8232a'; ctx.lineWidth = 4; ctx.stroke();
  return { x, y };
}

export function drawTitle(ctx, k) {
  drawKitchen(ctx, k, null);
  const { x, y } = panel(ctx, 640, 470);
  ctx.fillStyle = '#a8232a';
  ctx.font = '700 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('LANTERN WOK', FIELD.width / 2, y + 66);
  ctx.fillStyle = INK;
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText('Night Market Kitchen', FIELD.width / 2, y + 96);
  ctx.font = '16px Georgia, serif';
  ctx.textAlign = 'left';
  const lines = [
    'Run the stall for one 180-second shift. Tickets land on the',
    'order board — cook what they ask before patience runs out.',
    '',
    'Move: WASD / arrows (or click a station to walk there)',
    'Interact: Space / E — pick up, plate, serve, stir, trash',
    'Hold Space at the board to chop. Woks burn if left too long!',
    '',
    'Crates → chop → wok → plate at the shelf → serve at the pass.',
    'Fast serves build a combo; full-patience serves earn tips.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, x + 52, y + 140 + i * 24));
  ctx.textAlign = 'center';
  ctx.font = '700 21px Georgia, serif';
  ctx.fillStyle = '#a8232a';
  ctx.fillText('Press Enter or click to open the stall', FIELD.width / 2, y + 428);
}

export function drawPaused(ctx, k) {
  drawKitchen(ctx, k, null);
  const { y } = panel(ctx, 380, 190);
  ctx.fillStyle = INK;
  ctx.font = '700 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', FIELD.width / 2, y + 76);
  ctx.font = '16px Georgia, serif';
  ctx.fillText('Press P or Esc to get back to the fire', FIELD.width / 2, y + 116);
}

export function drawResults(ctx, k) {
  drawKitchen(ctx, k, null);
  const { y } = panel(ctx, 520, 430);
  ctx.fillStyle = '#a8232a';
  ctx.font = '700 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHIFT OVER!', FIELD.width / 2, y + 58);
  const stars = starsFor(k);
  ctx.font = '52px Georgia, serif';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < stars ? '#f2b13c' : '#d8cdb4';
    ctx.fillText('★', FIELD.width / 2 - 62 + i * 62, y + 122);
  }
  ctx.fillStyle = INK;
  ctx.font = '21px Georgia, serif';
  ctx.fillText(`Coins earned: ${k.score}`, FIELD.width / 2, y + 176);
  ctx.font = '18px Georgia, serif';
  ctx.fillText(`Dishes served: ${k.servedCount}`, FIELD.width / 2, y + 212);
  ctx.fillText(`Tickets lost: ${k.lostCount}`, FIELD.width / 2, y + 242);
  ctx.fillText(`Best combo: x${Math.max(1, Math.min(k.bestCombo, 5))}`, FIELD.width / 2, y + 272);
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillStyle = '#7a5a34';
  const verdict = stars >= 3 ? 'The whole market is talking about your wok.'
    : stars === 2 ? 'A fine night — the regulars will be back.'
    : 'The lanterns dim, but tomorrow is another shift.';
  ctx.fillText(verdict, FIELD.width / 2, y + 316);
  ctx.font = '700 19px Georgia, serif';
  ctx.fillStyle = '#a8232a';
  ctx.fillText('Press Enter to work another shift', FIELD.width / 2, y + 372);
}
