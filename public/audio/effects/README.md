# User-supplied sound effects

These excerpts come from Mike's `sounds/` folder, supplied for this game. The originals remain untouched. No additional license to the original recordings is asserted here.

| Export | Source | Duration cap | Use |
| --- | --- | --- | --- |
| shoot.mp3 | shoot.ogg | 0.24 s | fire and lightning casting |
| hit.mp3 | hit.ogg | 0.59 s | player damage and electrical impacts |
| death.mp3 | death.ogg | 2.47 s | player death and pitched boss warnings |
| fall.mp3 | fall.ogg | 1.78 s | wind casting and slowed storm rumbles |
| land.mp3 | land.ogg | 0.94 s | heavy spell impacts |
| munch.mp3 | munch.ogg | 0.88 s | monster kills |
| jump.mp3 | jump.ogg | 1.5 s | rolls, rings and power-ups |
| portal.mp3 | teepee.ogg | 1.2 s | original pickup accent (retained source) |

Exports use stereo 44.1 kHz / 128 kbps MP3, short edge fades, and measured peak gain toward -3 dBFS (gain capped at +18 dB). Cues vary playback rate slightly, with distinct rates/gains for each event. There are no synthesized oscillator or noise effects. `music.ogg` is not included; the background remains procedural Slumbr ambience.

## Sampled chimes and celebration music

`collect-chime.mp3` (0.23 s), `milestone.mp3` (2 s), `victory.mp3` (2.8 s), `festival.mp3` (4.5 s), and `grand-festival.mp3` (6.8 s) derive from the shipped land, hit, and jump recordings. Short recorded attacks excite resonant filters tuned to a D-major mallet palette. Layered chords, panned notes, edge fades, and short stereo reflections are baked into the exports. No additional recordings or runtime synthesis are needed.

The pickup replaces the old vocal portal excerpt. The three milestone arrangements escalate at 1,000 / 10,000 / 50,000 m; victory plays for defeated bosses and completed races. Melodies preserve exact tuning, gently duck ambience, and use one protected voice within the existing 16-voice limit. Pause, mute, and retry stop them.

Regenerate with Python 3, NumPy, and FFmpeg on PATH: `python scripts/make-audio.py`. Exports are stereo 44.1 kHz / 128 kbps MP3, normalized to -7 dBFS (pickup) or -5 dBFS (music) before encoding. Together the new assets add about 261 KiB.
