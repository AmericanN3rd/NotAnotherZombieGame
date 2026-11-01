# Audio credits

Everything in `public/audio/` is CC0 (public domain). Each license was checked on the OpenGameArt source page, which links [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required. Gunshots, the knife, reloads, and footsteps stay synthesized in the game and are not listed here.

`rain.ogg` and `thunder.ogg` are trims of the same recording: the bed is the opening rain, and the thunder one-shot is the strike later in that file.

A dedicated teeth-grinding recording with a verified CC0 license was not found. `teeth.ogg` is a CC0 bone break/snap, used as the grinding layer in the intro. Wall scratching is a CC0 scrape, not a fingernail foley take.

| File | Title | Author | Source | License |
| --- | --- | --- | --- | --- |
| `rain.ogg`, `thunder.ogg` | Rain + Long Thunder | WuxiaScrub | https://opengameart.org/content/rain-long-thunder | CC0 |
| `door-slam.ogg` | wood_slam_02, from 100 CC0 metal and wood SFX | rubberduck | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | CC0 |
| `wail.ogg` | Female high-pitched scream SFX | WuxiaScrub | https://opengameart.org/content/female-high-pitched-scream-sfx | CC0 |
| `teeth.ogg` | Fleshy Bone Break/Snap SFX | Zane Little Music | https://opengameart.org/content/fleshy-bone-breaksnap-sfx | CC0 |
| `scratch.ogg` | Scrapes (`scrape-1`) | AntumDeluge | https://opengameart.org/content/scrapes | CC0 |
| `piano.ogg` | Piano sting, from String and piano horror stings | congusbongus | https://opengameart.org/content/string-and-piano-horror-stings | CC0 |
| `strings.ogg` | Abyss, from String and piano horror stings | congusbongus | https://opengameart.org/content/string-and-piano-horror-stings | CC0 |
| `music/camp.ogg` | Piano sting (placeholder camp theme) | congusbongus | https://opengameart.org/content/string-and-piano-horror-stings | CC0 |
| `music/climb.ogg` | Abyss (placeholder climb theme) | congusbongus | https://opengameart.org/content/string-and-piano-horror-stings | CC0 |
| `music/hatch.ogg` | Abyss, same file as the climb placeholder until a third bed is dropped in | congusbongus | https://opengameart.org/content/string-and-piano-horror-stings | CC0 |

## Original music by the user

These three slots are ready for original tracks. The CC0 files above are placeholders and can be replaced without code changes.

| Slot | Path | When it plays |
| --- | --- | --- |
| Basecamp | `public/audio/music/camp.ogg` | The lobby |
| Climb | `public/audio/music/climb.ogg` | Floors 2–15 |
| Hatch | `public/audio/music/hatch.ogg` | Floor 16 |

The game also accepts `.m4a` and `.mp3` with the same base name (`camp.m4a`, `climb.mp3`). If more than one extension is present, `.ogg` wins. Ogg Vorbis is the best fit for the Android WebView: Chromium decodes it, the files stay small, and looping is gapless enough for a crossfade. AAC in `.m4a` is the other format that phones handle cheaply. MP3 works in the WebView too. Avoid WAV; it is large and slow to decode on a phone.

Keep the loops seamless at the file's edges. The game crossfades about 1.2 seconds when the slot changes and loops whatever buffer it decoded.
