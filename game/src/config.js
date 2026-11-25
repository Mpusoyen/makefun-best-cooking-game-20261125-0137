// Lantern Wok: Night Market Kitchen — tuning, ingredients, recipes and the kitchen layout.
// Everything the other modules need to agree on lives here: what an ingredient is, how it must be
// prepped, which dishes the stall serves, where each station stands, and how the rush escalates.

export const FIELD = { width: 1280, height: 800 };
export const BOARD_HEIGHT = 118; // order board band across the top of the canvas
export const HUD_HEIGHT = 44; // timer / coins / combo strip under the board

export const SHIFT_SECONDS = 180;
export const CHEF_SPEED = 305;
export const CARRY_MAX = 2;
export const CHOP_SECONDS = 1.15;
export const COOK_SECONDS = 6.0;
export const BURN_GRACE_SECONDS = 3.0; // time a finished wok item survives before it burns
export const COMBO_WINDOW_SECONDS = 9;
export const MAX_ORDERS = 4;

// Prep states an ingredient moves through: raw -> chopped -> chopped+cooked, or raw -> cooked.
// A component is plate-ready when its state equals the recipe's prep string for that ingredient.
export const PREP_COOKED = 'cooked';
export const PREP_CHOPPED = 'chopped';
export const PREP_CHOPPED_COOKED = 'chopped+cooked';

export const INGREDIENTS = {
  rice:    { id: 'rice',    name: 'Rice',    color: '#f3ead2', dark: '#cbbd97', chop: false, cook: true },
  noodles: { id: 'noodles', name: 'Noodles', color: '#f2c14e', dark: '#c79a2e', chop: false, cook: true },
  egg:     { id: 'egg',     name: 'Egg',     color: '#fdfdf6', dark: '#f0a13c', chop: false, cook: true },
  chicken: { id: 'chicken', name: 'Chicken', color: '#e8907c', dark: '#b85c48', chop: true,  cook: true },
  shrimp:  { id: 'shrimp',  name: 'Shrimp',  color: '#f49e7a', dark: '#d2691e', chop: false, cook: true },
  greens:  { id: 'greens',  name: 'Greens',  color: '#6fbf4a', dark: '#3e7d27', chop: true,  cook: false },
  chili:   { id: 'chili',   name: 'Chili',   color: '#d63a2f', dark: '#8f1f16', chop: true,  cook: false },
};
export const INGREDIENT_IDS = Object.keys(INGREDIENTS);

/** The prep string a fully prepped ingredient ends in ('cooked', 'chopped' or 'chopped+cooked'). */
export function fullPrep(ingredientId) {
  const ing = INGREDIENTS[ingredientId];
  if (ing.chop && ing.cook) return PREP_CHOPPED_COOKED;
  if (ing.chop) return PREP_CHOPPED;
  return PREP_COOKED;
}

/** True when an item in `state` still needs the chopping board. */
export function needsChop(ingredientId, state) {
  return INGREDIENTS[ingredientId].chop && state === 'raw';
}

/** True when an item in `state` still needs the wok. */
export function needsCook(ingredientId, state) {
  const ing = INGREDIENTS[ingredientId];
  if (!ing.cook) return false;
  if (ing.chop) return state === PREP_CHOPPED;
  return state === 'raw';
}

// Recipes: each dish is a set of components that combine differently — some chopped, some wokked,
// the Royal Wok Platter wants its chicken both chopped and wokked.
export const RECIPES = {
  friedRice: {
    id: 'friedRice', name: 'Lantern Fried Rice', reward: 24,
    parts: [{ ing: 'rice', prep: PREP_COOKED }, { ing: 'egg', prep: PREP_COOKED }, { ing: 'shrimp', prep: PREP_COOKED }],
  },
  chiliChicken: {
    id: 'chiliChicken', name: 'Ember Chili Chicken', reward: 26,
    parts: [{ ing: 'chicken', prep: PREP_CHOPPED_COOKED }, { ing: 'chili', prep: PREP_CHOPPED }, { ing: 'greens', prep: PREP_CHOPPED }],
  },
  noodleBowl: {
    id: 'noodleBowl', name: 'Market Noodle Bowl', reward: 22,
    parts: [{ ing: 'noodles', prep: PREP_COOKED }, { ing: 'egg', prep: PREP_COOKED }, { ing: 'greens', prep: PREP_CHOPPED }],
  },
  royalPlatter: {
    id: 'royalPlatter', name: 'Royal Wok Platter', reward: 34,
    parts: [{ ing: 'rice', prep: PREP_COOKED }, { ing: 'chicken', prep: PREP_CHOPPED_COOKED }, { ing: 'egg', prep: PREP_COOKED }, { ing: 'chili', prep: PREP_CHOPPED }],
  },
};
export const RECIPE_IDS = Object.keys(RECIPES);

// Stations. Crates sit along the left wall and the bottom; work stations fill the middle floor;
// the serving pass is the counter on the right. x/y is the centre a chef walks to.
export const STATIONS = [
  { id: 'crate-rice',    kind: 'crate', ing: 'rice',    x: 74,  y: 218, w: 116, h: 76, label: 'Rice' },
  { id: 'crate-noodles', kind: 'crate', ing: 'noodles', x: 74,  y: 308, w: 116, h: 76, label: 'Noodles' },
  { id: 'crate-egg',     kind: 'crate', ing: 'egg',     x: 74,  y: 398, w: 116, h: 76, label: 'Egg' },
  { id: 'crate-chicken', kind: 'crate', ing: 'chicken', x: 74,  y: 488, w: 116, h: 76, label: 'Chicken' },
  { id: 'crate-shrimp',  kind: 'crate', ing: 'shrimp',  x: 240, y: 742, w: 116, h: 76, label: 'Shrimp' },
  { id: 'crate-greens',  kind: 'crate', ing: 'greens',  x: 372, y: 742, w: 116, h: 76, label: 'Greens' },
  { id: 'crate-chili',   kind: 'crate', ing: 'chili',   x: 504, y: 742, w: 116, h: 76, label: 'Chili' },
  { id: 'board',  kind: 'board', x: 330, y: 430, w: 150, h: 96, label: 'Chopping Board' },
  { id: 'wok-1',  kind: 'wok',   x: 585, y: 300, w: 120, h: 104, label: 'Wok 1' },
  { id: 'wok-2',  kind: 'wok',   x: 585, y: 500, w: 120, h: 104, label: 'Wok 2' },
  { id: 'shelf',  kind: 'shelf', x: 880, y: 400, w: 170, h: 120, label: 'Plating Shelf' },
  { id: 'pass',   kind: 'pass',  x: 1168, y: 400, w: 120, h: 210, label: 'Serving Pass' },
  { id: 'trash',  kind: 'trash', x: 1010, y: 742, w: 92, h: 76, label: 'Trash' },
];

export function stationById(id) {
  return STATIONS.find((s) => s.id === id) || null;
}

// Rush curve: as the shift runs, tickets arrive faster and patience runs thinner.
export function spawnInterval(elapsed) {
  const t = Math.min(1, elapsed / SHIFT_SECONDS);
  return 13 - 5.5 * t; // 13s early, 7.5s late
}
export function patienceFor(elapsed) {
  const t = Math.min(1, elapsed / SHIFT_SECONDS);
  return 78 - 26 * t; // 78s early, 52s late
}
export const RUSH_AT_ELAPSED = 78; // seconds in, the RUSH HOUR banner fires and spawns tighten
export function isRush(elapsed) {
  return elapsed >= RUSH_AT_ELAPSED;
}

// End-of-shift star thresholds, in coins.
export const STAR_THRESHOLDS = [90, 190, 300];
