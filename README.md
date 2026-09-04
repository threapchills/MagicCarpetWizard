# Magic Carpet Wizard

**A Thousand Skies** — an endless 3D carpet-flying arcade game on a tiny spherical world.

Fly at **https://threapchills.github.io/MagicCarpetWizard/** once GitHub Pages deployment is enabled.

## Fly

| Control | Action |
| --- | --- |
| W / S (or up / down) | Climb / descend |
| A / D (or left / right) | Steer |
| Mouse + hold left click | Aim and cast spells |
| Tap Space | Barrel roll above 4 m; dodge enemy projectiles during the roll |
| Hold Shift | Skyfire boost (25 power to start) |
| Esc / P | Pause / resume |
| M | Toggle Slumbr ambience and action effects |
| Enter | Start / retry |

Skimming below 3.5 m gives speed and power. Roll, thread golden rings, narrowly avoid obstacles, and defeat spirits to build a scoring chain and refill skyfire. Gold wisps extend an existing chain and curve toward the next clear lane. Boost maintains speed at any altitude, but drains power. A run ends after three hits. Ward crystals heal and briefly shield you. Each roll needs a fresh key press; a collision cancels its reward. Near misses score after clearing an obstacle.

Spirits show health bars and a pink charging ring before casting. The aiming reticle turns gold over a target and flashes on hits. Follow your twin silk trails through rolls and boosted flight. The journey meter shows the distance to the next zone; each zone has its own larger architectural landmarks.

The reticle has a white core, black contour, and glow for visibility against light and dark scenes. Firing captures the mouse pointer and disables text selection during play. W climbs and S descends; the altitude display indicates the direction. Monster kills and player death scatter stylized red 3D ribbons.

## Art and ambience

The world uses three-band toon lighting, blue-violet shadows, and a screen-space ink pass that traces silhouettes and color boundaries. Its graphic direction takes inspiration from Sable and Chants of Sennaar. Models and materials remain original procedural geometry; no textures or assets from those games are used.

There is **no background music**. The background is an emergent mix of nine sound excerpts from the user-supplied Slumbr app. Air, land and dream layers overlap in 9–13 second phrases, varying sample offsets, playback rate, stereo placement and filtering. Zone, height, speed, night, rain and sand weather steer the mix. Sources load only after sound is enabled, with a bounded decoded-buffer cache and voice count. Pausing or leaving the window fades the ambience down. Short synthesized action effects remain separate from the ambient layer. Press M or the wave button to enable sound.

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

Built with Three.js and Vite. Models, scenery, particles, sky and action effects are generated in code. Slumbr ambience is served from this site's own `audio/slumbr/` folder; source labels and preparation details are recorded there. No API keys are needed. Optional Google Fonts fall back to system fonts if unavailable. Geometry is merged per chunk/material, chunks are recycled, and particle/projectile counts are bounded. Spark particles use one instanced draw call. Flight and combat run at a fixed 90 Hz, with swept projectile collision checks and bounded catch-up after slow frames.

## GitHub Pages

In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The included workflow tests and builds on pull requests and on pushes to `main`; successful `main` builds deploy `dist/` to Pages. Asset URLs are relative, so the game supports the repository subpath.

## Project structure

- `src/game.js`: seeded generation, flight rules, scoring, spell progression and collision rules.
- `src/world.js`: procedural 3D models, sphere placement and merged scenery.
- `src/main.js`: rendering, input, combat, effects and screens.
- `src/audio.js`: audio routing, pause/mute, and synthesized action effects.
- `src/ambience.js`: Slumbr sample selection, crossfades and environmental mixing.
- `src/ink.js`: screen-space ink contours and pigment shading.
- `src/effects.js`: bounded toon blood ribbons.
- `tests/game.test.js`: deterministic generation, flight, balance and long-run checks.
- `tests/world.test.js`: geometry and spherical placement for all seven zones.
- `tests/runtime.test.js`: actual application loop, controls, combat input, pause/help and restart with a mocked DOM and GPU (not a browser visual test).

The setting and characters are original. The brief’s references guide the feeling of flight, curvature and adventure; their artwork and assets are not used.
