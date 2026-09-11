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
| R | Restart the journey, or retry the same race player and course; saved bests remain |
| Tap Space | Barrel roll above 4 m; dodge enemy projectiles during the roll |
| Hold Shift | Skyfire boost (25 power to start) |
| Esc / P | Pause / resume |
| M | Mute / enable Slumbr ambience and recorded effects |
| Enter | Start / retry |

Skimming below 3.5 m gives speed and power. Roll, thread golden rings, narrowly avoid obstacles, and defeat spirits to build a scoring chain and refill skyfire. Gold wisps extend an existing chain and curve toward the next clear lane. Boost maintains speed at any altitude, but drains power. A run ends after three hits. Ward crystals heal and briefly shield you. Each roll needs a fresh key press; a collision cancels its reward. Near misses score after clearing an obstacle.

Horned stalkers track your flight, armored brutes fire faster projectiles, and hexers cast spread volleys. Charge rings warn before shots fire; the aim is locked during the warning so you can dodge. The reticle turns gold over a target and flashes on hits. Follow your twin silk trails through rolls and boosted flight.

Fireballs explode, splash nearby enemies and leave a burn. Lightning strikes instantly and chains with diminishing damage. Wind blasts sweep away hostile shots, stagger and shove monsters, and deal bonus damage to burning targets. Frost empowers fire shatters; Echo adds projectiles or lightning jumps. All three weapons are available from the start.

Progression takes inspiration from [Soar](https://github.com/threapchills/soar): permanent weapon levels plus temporary, combinable boosts. Monsters drop loot; Rapid Fire and Fury last 10 seconds, Focus lasts 12 seconds, and Overdrive lasts 8 seconds. Repeat boosts refresh their timer. Spell crystals cap at level three; further duplicates grant Overdrive. The selected spell, level and remaining boost times appear in the HUD.

The first boss arrives at 2,600 m. Four encounters rotate: a cinder dragon, an exiled carpet vizier, an armored scarab and a sand wyrm. Bosses accelerate toward a fighting distance, steer after the rider, and close in during charge bursts. The first dragon has 34 HP and a roughly 100 m/s pursuit cap; late-run bosses reach 41–55 HP and up to 190 m/s. Freezing still opens a gap, and early overdrive can escape. Getting 85 m ahead earns a smaller escape reward. A bounded 50–80 second encounter limit prevents endless fights. Only the scarab has wards: two fragile sigils with no second shield phase. Attacks accelerate with distance and at half health. Kills restore a heart and grant Overdrive and loot. Scenery hazards fade during encounters, then return in newly streamed chunks beyond the visible horizon. Boss recovery spacing gradually falls from about 3,300 to 1,600 m; kill streaks cannot skip it.

Biomes mix ground bandit hordes firing flaming arrows, archers on physical towers, strafing carpet mages with predictive aim, fire-fanning drakes, and legacy spirits and ogres. River fish leap once from the water in a targeted arc, with a splash cue. Mobile enemies can continue pursuing after their original scenery chunk disappears, with a ten-enemy pursuit cap. Projectiles keep their telegraphed aim, can approach from behind, and remain clearable with wind.

Smooth terrain terraces vary elevation by up to 30 m. Adventure routes include 320 m cliff tunnels and caves, with a 58 m opening, a 32 m ceiling, advance warnings, colored crystals and warm local lighting. The flight height readout remains relative to the terrain. Leaves, sand and gusts sweep laterally through the world instead of inheriting the rider’s steering and climb. Projectiles and ghosts use brighter cores and shared soft halos; ink contours remain in the final render.

Cliff rails begin at 640 m and recur every 2,560 m, alternating sides. Follow the glowing cliff edge at 6–46 m altitude: close skimming grants +18 m/s, skyfire and chain rewards. The outer obstacle lane clears along each rail. Rails are disabled in boss arenas.

The reticle has a white core, black contour, and glow for visibility against light and dark scenes. Firing captures the mouse pointer and disables text selection during play. W climbs and S descends; the altitude display indicates the direction. Monster kills and player death scatter stylized red 3D ribbons.

## Art and ambience

**Magnet** is a permanent, stackable pickup with 28 / 40 / 52 m attraction range. It pulls gold, spell upgrades, wards and monster loot in all three dimensions, including from behind a fast carpet. Caught items home in until collected and leave mint sparks. A glowing horseshoe marks the pickup, an aura circles the carpet, and the HUD shows the active range. A low Magnet appears on the gold route around 424 m and every 3,072 m thereafter, with additional random drops.

Boss entrances preserve the terrain, landmarks, foliage, roadside towers and outer cliff masses. Obstructing buildings and inner cave lips fade under a brief drifting dust veil, with temporary rider protection and a delayed opening volley. Existing cleared chunks stay cleared after the fight; normal hazards return through distant streaming rather than appearing around the rider. Biomes and scenery continue along the original route.

The world quantizes combined sunlight, ambient fill and cast shadows into three distinct cel-shaded bands, with cool shadows and warm highlights. A screen-space pass draws black silhouettes and finer internal contours, fading them into distant fog. Procedural plaster pigment, sand ripples and woven carpet textures stay attached to the models; mipmaps filter fine detail during fast flight. Its graphic direction takes inspiration from Sable and Chants of Sennaar. Models and textures are generated in code; no textures or assets from those games are used.

Magical objects emit HDR color, with a selective glow blurred at quarter resolution before the black outlines are applied. Browsers without floating-point color targets use an 8-bit saturation-gated fallback. Four fixed, non-shadow-casting point lights illuminate nearby toon surfaces from casting, projectiles and impacts. Narrow stepped rim lighting accents silhouettes. Curling impact sparks, luminous spell and carpet trails, a rotating casting rune, golden dust and night fireflies use two bounded particle clouds (384 sparks and 100 ambient motes).

The continuous background is atmospheric; short sampled melodies celebrate milestones and victories. Take Flight unlocks audio automatically through the user's click or Enter press; deliberate muting and volume preferences are remembered. The background is an emergent mix of nine Slumbr excerpts, normalized to -18 LUFS with a stronger mixer and a quick first fade-in. Air, land and dream layers overlap in 9–13 second phrases, varying offsets, playback rate, stereo placement and filtering. Zone, height, speed, wind, night, rain and sand steer the mix. Pausing or leaving the window fades audio down.

Action effects use eight excerpts from the user-supplied `sounds/` folder, plus five sampled chime and fanfare arrangements derived from those recordings. Casting, impacts, kills, death, pickups, tricks and boss warnings use these recordings with cue-specific gains and playback rates. Pickups use a short glassy chime. The 1,000 / 10,000 / 50,000 m celebrations have increasingly elaborate melodies, and boss kills and race finishes play a victory cue. Effects preload when audio starts and are capped at sixteen voices, with one protected musical voice, light ambience ducking, retrigger limits and cancellation on mute/pause/retry. Source mappings are in `public/audio/effects/README.md`. **Audio mix** on the title/pause screen offers separate ambience and effects sliders and reports loading, playing, muted or failed status. Press M or the wave button to toggle sound.

Giant acacias, tall palms and dense shrubs fill the greener zones. Swirling leaves, curved wind streaks, slanted rain and sand particles use fixed pools. Weather evolves in 24-second phrases; dry biomes turn rain into sandstorms, and thunderstorms bring darker skies, distant flashes and thunder. Wind strength also steers the Slumbr ambience mix. Score multipliers cap at 8×.

A quiet [Ko-fi link](https://ko-fi.com/threapchills), matching the destination in Slumbr, appears only on the title screen. It is a plain link without an embedded widget.

Thirteen procedural zones advance every 2,560 m, twice their former length: the Amber City, Gilded Gardens, Saffron Sea, Singing Canyons, River of Stars, Emerald Fields, Ancestors’ Reach, Lantern Fishing Village, Waking Peaks, Jade Jungle, Opal Beach, Smouldering Isle and Mountain Temples. The opening 2,500 m retains the gentle difficulty curve; pressure then rises faster, with further attack-speed and pursuit escalation through 80,000 m. Short recovery phrases remain throughout. Day and night cycle independently of rain, wind and sand. Distant sky stays visible through tunnel mouths; solid roofs and walls occlude it. Each new run has a new seed. Best distance and score are saved locally in the browser.

The playable corridor is 108 m wide, with five winding safe-lane choices, a 54 m flight ceiling and a 680 m planet radius. Low-flight speed reaches 76 m/s before difficulty bonuses, while skyfire reaches 102 m/s; dives add momentum. Steering reaches more than 90% of its target speed within 100 ms and brakes rapidly on release. Spells travel faster to keep up with the carpet. Architecture uses varied footprints, heights, full-angle decorative rotations, irregular spacing and larger landmarks. Playable obstacles use rotated collision boxes that match their models. Side scenery stays outside the playable corridor, and every generated obstacle row preserves a clear lane.

## Adventure pacing

Adventure runs use an 82% simulation tempo for flight, combat and world animation, while input damping and camera follow keep their immediate response. The HUD reports actual speed at this tempo. Difficulty climbs gradually through 1.5, 5, 12, 24, 40 and 64 km: taller and denser obstacles, more frequent and larger enemy groups, shorter attack intervals, and quicker hostile shots. The last 512 m of each 2,048 m phrase eases obstacle and encounter density. Enemies start after 640 m; guards, mages and drakes unlock after 1.2, 2.5 and 5 km. Health remains capped. Race timing, physics and saved ghosts retain their existing rules.

## Hot-seat ghost races

The active gate has a luminous rim and orbiting diamond runes. Passing a gate showers sparks around its rim; the finish gives a larger gold burst. The race HUD keeps the selected spell visible and reports each checkpoint's exact crossing time, or the gap ahead/behind the opponent when their ghost includes splits. Existing ghosts still play; newly saved personal bests include split timing. R starts a fresh countdown for the same player without changing the course or either best time.

Choose **Race a friend** for two players taking turns on one keyboard. Easy (896 m) has broad gates and sparse obstacles, Medium (1,280 m) adds rooftop slaloms, and Hard (1,536 m) has tighter gates and dense canyon formations. Each difficulty has its own generated course and two local personal bests. Both players use identical layouts, flight rules, starting power and checkpoint rewards. Aim and cast in races to smash crates, urns and rocks; props reset for every attempt. Ghosts cannot be shot or collided with. Other biomes use timber, hay bales and ancient seals in adventure mode. Monsters and enclosed passages stay in adventure mode.

The three-second countdown holds the carpet still. Fly through every checkpoint gate and the checkered finish ring; the HUD shows the next gate’s number, distance and height. W climbs, S descends, A/D steer, Shift boosts and Space rolls. Low flight and completed rolls build power; gates refill 12 power. Collisions or missed gates return you to the last checkpoint with a brief recovery while the timer keeps running. Attempts end after three minutes if unfinished.

After finishing, pass the keyboard using **Pass to Player 2/1**, or retry with the same player. Only a faster completed run replaces that player’s ghost. Player 1 races Player 2’s rose ghost, and Player 2 races Player 1’s cyan ghost. Playback follows recorded positions by elapsed time, including resets, and never collides with the rider. Best times and their recordings persist in this browser when local storage is available. **New course** clears both players’ times only for the selected difficulty. Pause freezes the countdown, race clock and ghost.

Race ambience continues through results, keyboard handoffs and pauses; M and the small sound button still mute everything. Recordings for the previous course version remain stored separately because breakable obstacles change the course rules.

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

- `src/game.js`: seeded generation, flight rules, scoring and spell progression.
- `src/collision.js`: swept carpet collisions, solid wall sliding and race crash detection. Damage immunity protects hearts without letting the rider phase through geometry.
- `src/landscape.js`: elevation and shared tunnel geometry/collision dimensions, including ceilings and angled ribs.
- `tests/collision.test.js`: cave seams, entrances, ceilings, boosted impacts, rotated obstacles, arena clearing and race collisions.
- `src/world.js`: procedural 3D models, sphere placement and merged scenery.
- `src/main.js`: rendering, input, combat, effects and screens.
- `src/race.js`: procedural courses, checkpoint rules, race timing and saved ghost records.
- `src/race-view.js`: checkpoint and finish gates and translucent opponent playback.
- `tests/race.test.js`: course fairness, complete simulated flights, resets, finish timing, ghost persistence and visuals.
- `src/audio.js`: gesture-based startup, saved mix controls, pause/mute and audio status.
- `src/sample-effects.js`: recorded effects, preload/cache and bounded playback.
- `tests/audio.test.js`: startup, audio routing, preferences, mute races and sample playback.
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


## Obstacle silhouettes and cave gauntlets

Adventure obstacle rows mix round columns, pyramids, sloping wedges, and open colonnades with the original buildings. The swept collision hulls follow the new silhouettes; sloping corners and arch openings provide real flight clearance.

After 25,000 m, three 1,024 m cave gauntlets rotate: **THE PENDULUM VAULT** (giant swinging double axes at alternating heights), **THE MOLTEN ARTERY** (animated magma, telegraphed geysers and rising lava blobs), and **THE SHIFTING SEALS** (stone gates whose glowing openings move sideways and vertically). The first begins at 25,600 m. Start-to-start spacing falls from 7,168 m to 2,560 m as distance increases. Each has eight hazard stations, a remaining-distance display, and a 1,500-point survival reward with skyfire and a victory cue. Bosses and ordinary enemy volleys clear before the approach; pause and time bending freeze or slow the traps with the game.

Static shape meshes remain merged into chunks. Only nearby trap stations animate, with shared geometry/materials and bounded collision lists. The magma shader uses a handful of sine functions and requires no texture downloads or extra rendering pass.
