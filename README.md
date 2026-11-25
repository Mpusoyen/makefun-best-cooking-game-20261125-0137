# Lantern Wok: Night Market Kitchen

[![Competition](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Rank](https://make.fun/badge/best-cooking-game-20261125-0137/Mpusoyen/makefun-best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Reward](https://make.fun/badge/best-cooking-game-20261125-0137/Mpusoyen/makefun-best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

An original cooking game for the [make.fun best-cooking-game bounty](https://make.fun/bounty/best-cooking-game-20261125-0137): you run a lantern-lit night-market stall for one 180-second shift. Tickets land on the order board — fetch ingredients from the crates, chop at the board, cook in two woks (stir when prompted, and don't let a finished dish burn), assemble plates at the plating shelf, and serve them at the pass before each ticket's patience runs out. Fast serves build a combo multiplier, full-patience serves earn tips, and halfway through the shift the RUSH HOUR hits: tickets arrive faster and patience runs thinner.

## How to play

- **Move:** WASD / arrow keys, or click a station to walk there and use it
- **Interact:** Space / E (hold Space at the chopping board to chop)
- **Pause:** P or Esc

**Stations:** ingredient crates (Rice, Noodles, Egg, Chicken, Shrimp, Greens, Chili) along the left and bottom, a chopping board, two wok burners, a plating shelf, the serving pass on the right, and a trash bin for mistakes. You can carry two things at once, so plan your route.

**Recipes:**

- **Lantern Fried Rice** — rice + egg + shrimp, all wokked
- **Ember Chili Chicken** — chicken chopped then wokked, plus chopped chili and greens
- **Market Noodle Bowl** — wokked noodles and egg, plus chopped greens
- **Royal Wok Platter** — wokked rice, chopped-and-wokked chicken, wokked egg, chopped chili

Later tickets ask for two dishes at once. At the end of the shift you get a results screen with stars, coins, dishes served and your best combo.

## Play it

```sh
node serve.ts
```

then open <http://localhost:8080>. The game is plain static files under `game/` — no build step, no network requests; all art is drawn in canvas code and all sounds are synthesized with WebAudio.

## Hand-in

`node main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library (`vendor/makefun-game.ts`, unchanged from the kit).

Try make.fun: <https://make.fun/r/1c6jcmp6>
