# Magic Carpet Wizard

**A Thousand Skies** — an endless 3D carpet-flying arcade game on a tiny spherical world.

Fly at **https://threapchills.github.io/MagicCarpetWizard/** once GitHub Pages deployment is enabled.

## Fly

| Control | Action |
| --- | --- |
| W / S (or up / down) | Climb / descend |
| A / D (or left / right) | Steer |
| Mouse + hold left click | Aim and cast spells |
| 1 / 2 / 3 | Fireball / Lightning / Wind blast |
| Q | Cycle spells |
| Tap Space | Barrel roll above 4 m; dodge enemy projectiles during the roll |
| Hold Shift | Skyfire boost (25 power to start) |
| Esc / P | Pause / resume |
| M | Toggle Slumbr ambience and action effects |
| Enter | Start / retry |

Skimming below 3.5 m gives speed and power. Roll, thread golden rings, narrowly avoid obstacles, and defeat spirits to build a scoring chain and refill skyfire. Gold wisps extend an existing chain and curve toward the next clear lane. Boost maintains speed at any altitude, but drains power. A run ends after three hits. Ward crystals heal and briefly shield you. Each roll needs a fresh key press; a collision cancels its reward. Near misses score after clearing an obstacle.

Horned stalkers track your flight, armored brutes fire faster projectiles, and hexers cast spread volleys. Charge rings warn before shots fire; the aim is locked during the warning so you can dodge. The reticle turns gold over a target and flashes on hits. Follow your twin silk trails through rolls and boosted flight.

Fireballs explode, splash nearby enemies and leave a burn. Lightning strikes instantly and chains with diminishing damage. Wind blasts sweep away hostile shots, stagger and shove monsters, and deal bonus damage to burning targets. Frost empowers fire shatters; Echo adds projectiles or lightning jumps. All three weapons are available from the start.

Progression takes inspiration from [Soar](https://github.com/threapchills/soar): permanent weapon levels plus temporary, combinable boosts. Monsters drop loot; Rapid Fire and Fury last 10 seconds, Focus lasts 12 seconds, and Overdrive lasts 8 seconds. Repeat boosts refresh their timer. Spell crystals cap at level three; further duplicates grant Overdrive. The selected spell, level and remaining boost times appear in the HUD.

The first boss arrives at 1,400 m, or after 16 monster kills. It follows the carpet while scenery continues moving; road obstacles and regular enemies clear for the fight. Destroy three orbiting ward sigils to expose its body. At half health, its wards return and attacks accelerate. Victory restores a heart, grants skyfire, Overdrive and loot, and schedules another boss 2,560 m later (or after another 16 kills). Road obstacles return beyond a 128 m grace distance.

Cliff rails begin at 640 m and recur every 2,560 m, alternating sides. Follow the glowing cliff edge at 6–46 m altitude: close skimming grants +18 m/s, skyfire and chain rewards. The outer obstacle lane clears along each rail. Rails are disabled in boss arenas.

The reticle has a white core, black contour, and glow for visibility against light and dark scenes. Firing captures the mouse pointer and disables text selection during play. W climbs and S descends; the altitude display indicates the direction. Monster kills and player death scatter stylized red 3D ribbons.

## Art and ambience

The world quantizes combined sunlight, ambient fill and cast shadows into three distinct cel-shaded bands, with cool shadows and warm highlights. A screen-space pass draws black silhouettes and finer internal contours, fading them into distant fog. Procedural plaster pigment, sand ripples and woven carpet textures stay attached to the models; mipmaps filter fine detail during fast flight. Its graphic direction takes inspiration from Sable and Chants of Sennaar. Models and textures are generated in code; no textures or assets from those games are used.

Magical objects emit HDR color, with a selective glow blurred at quarter resolution before the black outlines are applied. Browsers without floating-point color targets use an 8-bit saturation-gated fallback. Four fixed, non-shadow-casting point lights illuminate nearby toon surfaces from casting, projectiles and impacts. Narrow stepped rim lighting accents silhouettes. Curling impact sparks, luminous spell and carpet trails, a rotating casting rune, golden dust and night fireflies use two bounded particle clouds (384 sparks and 100 ambient motes).

There is **no background music**. The background is an emergent mix of nine sound excerpts from the user-supplied Slumbr app. Air, land and dream layers overlap in 9–13 second phrases, varying sample offsets, playback rate, stereo placement and filtering. Zone, height, speed, night, rain and sand weather steer the mix. Sources load only after sound is enabled, with a bounded decoded-buffer cache and voice count. Pausing or leaving the window fades the ambience down. Short synthesized action effects remain separate from the ambient layer. Press M or the wave button to enable sound.

Giant acacias, tall palms and dense shrubs fill the greener zones. Swirling leaves, curved wind streaks, slanted rain and sand particles use fixed pools. Weather evolves in 24-second phrases; dry biomes turn rain into sandstorms, and thunderstorms bring darker skies, distant flashes and thunder. Wind strength also steers the Slumbr ambience mix. Score multipliers cap at 8×.

A quiet [Ko-fi link](https://ko-fi.com/threapchills), matching the destination in Slumbr, appears only on the title screen. It is a plain link without an embedded widget.

Seven procedural zones advance every 1,280 m: the Amber City, Sultan’s Gardens, Saffron Sea, Singing Canyons, River of Stars, Emerald Fields, and Ancestors’ Reach. The cycle repeats with capped difficulty scaling. Day and night cycle independently of procedural rain, wind and sand weather. Each new run has a new seed. Best distance and score are saved locally in the browser.

The playable corridor is 108 m wide, with five winding safe-lane choices, a 54 m flight ceiling and a 680 m planet radius. Low-flight speed reaches 76 m/s before difficulty bonuses, while skyfire reaches 102 m/s; dives add momentum. Steering reaches more than 90% of its target speed within 100 ms and brakes rapidly on release. Spells travel faster to keep up with the carpet. Architecture uses varied footprints, heights, full-angle decorative rotations, irregular spacing and larger landmarks. Playable obstacles use rotated collision boxes that match their models. Side scenery stays outside the playable corridor, and every generated obstacle row preserves a clear lane.

## Develop

Requires Node.js 22 and a browser with WebGL 2. Desktop mouse and keyboard are required for gameplay.

```sh
npm ci
npm run dev
npm test
npm run build
```

Built with Three.js and Vite. Models, scenery, particles, sky and action effects are generated in code. Slumbr ambience is served from this site's own `audio/slumbr/` folder; source labels and preparation details are recorded there. No API keys are needed. Optional Google Fonts fall back to system fonts if unavailable. Scenery bakes pigment into vertex colors and merges by surface, retaining at most four draws per chunk. Chunks, combat effects, loot and projectiles are bounded; temporary lightning geometry is disposed when its arc expires. Flight and combat run at a fixed 90 Hz, with swept projectile collision checks and bounded catch-up after slow frames.

## GitHub Pages

In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The included workflow tests and builds on pull requests and on pushes to `main`; successful `main` builds deploy `dist/` to Pages. Asset URLs are relative, so the game supports the repository subpath.

## Project structure

- `src/game.js`: seeded generation, flight rules, scoring, spell progression and collision rules.
- `src/world.js`: procedural 3D models, sphere placement and merged scenery.
- `src/main.js`: rendering, input, combat, effects and screens.
- `src/audio.js`: audio routing, pause/mute, and synthesized action effects.
- `src/ambience.js`: Slumbr sample selection, crossfades and environmental mixing.
- `src/toon.js`: combined-light cel shader and procedural pigment textures.
- `src/ink.js`: screen-space black contours with distance fading.
- `src/effects.js`: bounded toon blood ribbons.
- `src/combat.js`: weapon profiles, timed boosts and boss rules.
- `src/battle.js`: casts, impacts, monsters, loot and moving boss encounters.
- `src/weather.js`: biome weather, swirling foliage, rain, sand and wind fields.
- `src/magic.js`: pooled spell lighting, rune aura and luminous particle clouds.
- `tests/magic.test.js`: effect lifetimes, spherical light placement, particle limits and glow render ordering.
- `tests/combat.test.js`: real cast impacts, combinations, boss phases and aimed victories across simulation rates.
- `tests/weather.test.js`: weather budgets and cliff-skimming rules.
- `tests/game.test.js`: deterministic generation, flight, balance and long-run checks.
- `tests/world.test.js`: geometry and spherical placement for all seven zones.
- `tests/runtime.test.js`: actual application loop, controls, combat input, pause/help and restart with a mocked DOM and GPU (not a browser visual test).

The setting and characters are original. The brief’s references guide the feeling of flight, curvature and adventure; their artwork and assets are not used.
