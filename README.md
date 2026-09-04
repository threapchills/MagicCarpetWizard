# Magic Carpet Wizard

**A Thousand Skies** — an endless 3D carpet-flying arcade game on a tiny spherical world.

Fly at **https://threapchills.github.io/MagicCarpetWizard/** once GitHub Pages deployment is enabled.

## Fly

| Control | Action |
| --- | --- |
| W / S (or up / down) | Climb / descend |
| A / D (or left / right) | Steer |
| Mouse + hold left click | Aim and cast spells |
| Space | Barrel roll above 4 m; dodge enemy projectiles during the roll |
| Hold Shift | Skyfire boost (25 power to start) |
| Esc / P | Pause / resume |
| M | Toggle procedural music and sound |
| Enter | Start / retry |

Skimming below 3.5 m gives speed and power. Roll, thread golden rings, narrowly avoid obstacles, and defeat spirits to build a scoring chain and refill skyfire. Gold wisps extend an existing chain. Boost maintains speed at any altitude, but drains power. A run ends after three hits. Ward crystals heal and briefly shield you.

Spell crystals stack up to three levels. Ember increases damage; Frost slows spirits and enables fire shatters; Storm chains hits to nearby foes; Echo adds bolts; Charm attracts pickups. All collected effects combine automatically. Score multipliers cap at 8×.

Seven procedural zones advance every 720 m: the Amber City, Sultan’s Gardens, Saffron Sea, Singing Canyons, River of Stars, Emerald Fields, and Ancestors’ Reach. The cycle repeats with capped difficulty scaling. Day and night cycle independently of procedural rain, wind and sand weather. Each new run has a new seed. Best distance and score are saved locally in the browser.

## Develop

Requires Node.js 22 and a browser with WebGL 2. Desktop mouse and keyboard are required for gameplay.

```sh
npm ci
npm run dev
npm test
npm run build
```

Built with Three.js and Vite. All game models, scenery, particles, sky, music and sound effects are generated in code. No game asset downloads or API keys are needed. Optional Google Fonts fall back to system fonts if unavailable. Geometry is merged per chunk/material, chunks are recycled, and particle/projectile counts are bounded.

## GitHub Pages

In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The included workflow tests and builds on pull requests and on pushes to `main`; successful `main` builds deploy `dist/` to Pages. Asset URLs are relative, so the game supports the repository subpath.

## Project structure

- `src/game.js`: seeded generation, flight rules, scoring, spell progression and collision rules.
- `src/world.js`: procedural 3D models, sphere placement and merged scenery.
- `src/main.js`: rendering, input, combat, effects and screens.
- `src/audio.js`: synthesized soundscape.
- `tests/game.test.js`: deterministic generation, flight, balance and long-run checks.

The setting and characters are original. The brief’s references guide the feeling of flight, curvature and adventure; their artwork and assets are not used.
