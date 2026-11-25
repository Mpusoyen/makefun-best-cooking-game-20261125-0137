// Order tickets: generation, patience, and matching a finished plate to the ticket that wants it.
// An order is one or two dishes (two-dish tickets appear later in the shift). Each dish on the
// ticket is served independently; the ticket pays out when its last dish lands at the pass.

import { RECIPES, RECIPE_IDS, patienceFor } from './config.js';

let nextOrderId = 1;

/** A fresh ticket. `elapsed` drives patience and whether a second dish is added. */
export function makeOrder(elapsed, rng) {
  const first = RECIPE_IDS[Math.floor(rng() * RECIPE_IDS.length)];
  const dishes = [{ recipeId: first, served: false }];
  if (elapsed > 55 && rng() < 0.45) {
    let second = RECIPE_IDS[Math.floor(rng() * RECIPE_IDS.length)];
    if (second === first) second = RECIPE_IDS[(RECIPE_IDS.indexOf(first) + 1) % RECIPE_IDS.length];
    dishes.push({ recipeId: second, served: false });
  }
  const patience = patienceFor(elapsed) * (dishes.length > 1 ? 1.35 : 1);
  return { id: nextOrderId++, dishes, patience, maxPatience: patience };
}

/** Base coin reward of a ticket: the sum of its dishes. */
export function orderReward(order) {
  return order.dishes.reduce((sum, d) => sum + RECIPES[d.recipeId].reward, 0);
}

/** Fraction of patience left, 1 (fresh) to 0 (about to walk away). */
export function patienceFraction(order) {
  return Math.max(0, order.patience / order.maxPatience);
}

/**
 * Find the ticket that wants `recipeId` next: the one with the least patience left among those
 * still waiting for that dish. Returns { order, dish } or null.
 */
export function findOrderForDish(orders, recipeId) {
  let best = null;
  for (const order of orders) {
    for (const dish of order.dishes) {
      if (dish.recipeId === recipeId && !dish.served) {
        if (!best || order.patience < best.order.patience) best = { order, dish };
      }
    }
  }
  return best;
}

/** True when every dish on the ticket has been served. */
export function orderComplete(order) {
  return order.dishes.every((d) => d.served);
}

/** Reset the id counter (new shift / screenshot staging). */
export function resetOrderIds() {
  nextOrderId = 1;
}
