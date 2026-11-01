# NAZG (Not Another Zombie Game)

A roguelike climb through a dead tower. The lobby is your camp and the main menu. You go up alone, lose the run's gear when you fall, and keep the salvage. Notes are the only voices. You never meet anyone alive.

## Why Phaser 3, TypeScript, and Vite

Story Mode has to run in a phone browser and on a desktop keyboard, and the design later wants split-screen co-op: two cameras, independent vertical scroll, merging when the climbers are close.

Phaser 3 already has arcade physics, a follow camera, pointer input, and a scale manager that letterboxes a fixed 640×360 world into any viewport. Co-op can grow inside that same scene: a second player body and a second camera with its own viewport and `startFollow`. Both bodies share one physics world, which is what a shared tower wants. The floor loader is the piece that would become a streaming layout later; movement, weapons, and the shop do not depend on it.

Vite builds a static `dist/` folder, so the same project runs locally and on GitHub Pages. TypeScript keeps the reload timing, the floor spend limit, and the run state honest as those systems get more gear.

A custom canvas loop would have meant rewriting physics and cameras before the first floor was fun. A heavier engine would have fought a simple static export.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` typechecks and writes `dist/`. `npm run preview` serves that folder. `npm test` checks the shop limits, the active-reload timing, and the Xbox button mapping.

### GitHub Pages

`vite.config.ts` uses a relative `base`, so `dist/` works at a project-site subpath. `.github/workflows/pages.yml` builds and deploys on pushes to `main` (and when the workflow is run by hand). After the action is enabled in the repo’s Pages settings (source: GitHub Actions), the climb is served from the Pages URL.

### Android (private APK, not Play Store)

The phone build is a Capacitor wrapper around the same Vite output. It stays landscape and fullscreen, keeps the screen on, and the Android back button pauses. Xbox pads use the same standard Gamepad mapping inside the WebView. There is no Play Console setup.

Releases are cut by pushing a `v*` tag (or running the Android APK workflow by hand). The workflow attaches an APK to a GitHub Release. This repository is private, so the file is only visible when you are signed in.

Install on a phone:

1. On the phone, open the release page in a browser where you are signed in to GitHub: https://github.com/AmericanN3rd/NotAnotherZombieGame/releases
2. Download the `.apk`.
3. If Android asks, allow **Install unknown apps** for that browser.
4. Open the downloaded file and install it.
5. To update, download the newer APK and install it over the old one. That only works when both files were signed with the same key. A debug-signed build will not update a release-signed build, or the other way around.
6. **v0.1.0 will not update in place.** That APK was signed with the CI runner's own debug key. Uninstall it once, then install v0.2.0. Debug builds from v0.2.0 on share `android/app/debug.keystore` (the public Android debug alias `androiddebugkey`), so later debug APKs install over each other.

On launch, if the phone is online, the app tries to read `version.json` from the latest release. A private asset refuses that anonymous request, so the check fails silently and the game just starts. If a newer version is readable, a prompt opens the release page in the browser.

A release-signed APK needs these Actions secrets (the keystore never belongs in the repo):

- `ANDROID_KEYSTORE_BASE64` — base64 of the `.keystore` file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If any of them are missing, the workflow builds a debug-signed APK instead and names it `NAZG-<version>-debug.apk`. That debug APK is signed with the committed debug keystore, not a fresh key from the runner. The store password and key password are Android's public debug defaults (`android` / `androiddebugkey`). They are not a release secret. Do not commit a release keystore.

## Controls

Keyboard, touch, and a standard-layout gamepad (the Xbox mapping in the browser Gamepad API) all drive the same actions. The pad is polled every frame, so plugging one in mid-climb works without a reload. The last device you actually used is the active one: on-screen touch controls hide while a pad is in use, and prompts switch to Xbox labels (`B` at the vending machine, `Y in the green` on the reload bar, a legend along the bottom).

| Action | Keyboard | Touch | Xbox pad |
| --- | --- | --- | --- |
| Move | A/D or arrows | Left stick | Left stick or D-pad |
| Jump | Space (W or Up off a ladder) | Jump | A |
| Climb | W/S or Up/Down on a ladder | Stick up / down | Stick or D-pad up / down |
| Knife | J or X | Knife | X |
| Shoot | K or Z | Fire | RT |
| Reload | R | Reload | Y or RB |
| Use | E or F | Use | B |
| Flare | G or 3 | Flare on the HUD | LB (fires a bought shell, otherwise a reminder) |
| Pack | I or C | Pack | View |
| Pause | Esc or P, or Android back | — | Menu |
| Shop rows | 1–8 | tap a row | Stick or D-pad, A buys, B backs out |
| Pack rows | click | tap Wear or a slot | A wears, X uses the health item, B closes |
| Menus | click | tap | A confirms, B backs out, Menu toggles pause |

Aim a little up or down with W/S, the touch stick, or the left stick while you fire, as long as you are not climbing. Pushing the stick up does not jump; A does.

Touch controls show on coarse pointers, narrow windows, or `?touch=1`, and hide again once a pad is the active input.

Gunshots are loud and pull nearby undead. A hard landing does too, unless you bought Rubber Soles for that floor. The knife is silent, and it dulls. A sharp knife hits. A worn knife sometimes glances. A dull knife mostly glances and swings slower. A sharpening stone, found or bought, puts the edge back. A pipe does not dull. A hatchet hits harder and dulls faster.

Reload is a moving bar: press reload again in the green band for a clean reload, press outside it and the gun jams, or let the bar finish for a slow safe reload. Steady Hands widens the green band for the floor. Gun Oil makes a bad tap do nothing instead of jamming. That second press is the same button on a pad as the first. Notes are picked up by walking over them. B / E holds the lock bypass and opens the cache. The flare gun fires only after you buy a Flare Shell. One shell stuns whatever is close, then it is gone.

## Camp

Floor 1 is the lobby. Walk to a station and use it. The board on the left is notices: settings, controls, and credits. The stairs on the right start a climb. The first time you stand in the lobby, one line tells you that.

Salvage is banked as you pick up coins, when you clear a floor, and as a scrap if you die with empty pockets. It stays in `localStorage` (`nazg-meta`, version 1). The run's coins, gun parts, knife edge, and pack are thrown out on death or when you leave the climb. v0.2.0 did not save a run. Brightness, low effects, the intro flag, and a locked seed still live in `nazg-settings` and are kept. Salvage and the stations start at zero because they did not exist. Settings has **Reset progress**, which clears the camp and leaves those options alone.

| Station | What it buys |
| --- | --- |
| Workbench | Faster reload, a wider active-reload band, a knife that dulls slower. Gun Oil enters the caches at the first level. |
| Armory | A larger magazine, more starting ammunition, then a jacket, then a bandage and a helm. Hollow points and flare shells enter later. |
| Infirmary | Up to three extra health. Adrenaline shots enter at the first level. |
| Radio | How far the stairs will take you: floor 5, then 8, then 12, then the hatch on 16. Bait, rubber soles, and lucky coins enter as it climbs. |

Costs run 8, then the teens, then the thirties and forties, so a short clear buys a level and a full camp takes a string of runs. The lobby shows it: a bare room, then a barricade, then sandbags, then patched walls and more bulbs.

Each climb reseeds floors 4 and up unless Settings locks a seed.

## Floors

1. **Lobby.** No enemies. Stations, a note (“they’re inside, be careful.”), and the stairs.
2. **The first hall.** The old quiet ward: a sleeper, the vending cache, a sharpening stone, and a jacket on the floor. The wallet still starts at 36 coins. This floor will only sell 30 coins of gear.
3. **Two ways up.** Spikes and pits along the maintenance hall, with no undead. A vent is faster and ends at a computer lock. Bypass it and the undead (and a ferret) on the other side wake up.
4 and up. **Generated.** Ladders, crumble drops, and the rest of the old third floor now come from the generator. The radio at camp has to be raised before the stairs will pass floor 5, then 8, then 12.

4–8. **Generated tenement.** Hand-authored chunks (corridors, spike runs, pits, ladder shafts, vents, locks, crumble drops, shops, note nooks) are chained from a seed. Difficulty ticks up each floor: more and tougher undead, denser traps, fewer medkits and coins. From floor 4, a ladder slips if an undead is close. The pause screen shows the seed that built the floor; Settings can lock one for testing, and `window.__nazg.setSeed(n)` does the same.
6. **Wager.** A vending machine offers three optional lanes under the hall. Harder lanes pay more coins. The stairs up stay on the main floor.
9–12. **Ward.** The same generator, in a green emptied ward. New chunks: steam that scalds on a cycle, a blackout with dead bulbs, and an alarm hall. Spend limits keep falling. Medkits are gone by 12.
13–16. **Machinery.** Colder light, grate jumps, and the same rising pressure, capped so a floor does not become a maze. Floor 16 ends at a locked hatch. The roof is still not a level. There is no base camp, no one to recruit, and no one alive.

## Vending cache

Every machine still has a per-floor spend limit. Rounds and a sharpening stone are always for sale. Gun parts (compensator, power, silencer) stay until you own them. On top of that, each floor stocks up to three powers from the ones the camp has unlocked, chosen from the climb seed. Prices rise about 12% per floor. A fresh camp stocks Steady Hands, Sharpened Knife, and Hollow Points. The other powers arrive as the stations level.

| Power | Effect |
| --- | --- |
| Steady Hands | Wider reload window for this floor |
| Gun Oil | A mistimed reload tap does not jam, this floor |
| Hollow Points | Shots deal +1 damage, this floor |
| Sharpened Knife | The blade counts as sharp, wears half as fast, and deals +1, this floor |
| Rubber Soles | Hard landings make no noise, this floor |
| Birdseed | Macaws ignore you for 12 seconds |
| Ferret Bait | Ferrets ignore you for 12 seconds |
| Adrenaline Shot | Heal 2 and move faster for 8 seconds |
| Flare Shell | Kept until fired. Stuns enemies within reach |
| Lucky Coin | Kept until the next hit, which then deals nothing |

Floor buffs clear when you take the stairs. Shells and lucky charges stay in your pocket.

## Pack

Helmet, armor, weapon, and a health item. Open it with Pack, I, or View on a pad. Found gear goes in the bag until you wear it. Tap a worn slot to take it off.

| Slot | Items |
| --- | --- |
| Helmet | Cloth wrap (longer i-frames), scavenged helm (one point off a hit every 6 seconds), riot visor (macaws cannot hurt you) |
| Armor | Lined jacket or scrap plate (hits deal 1 less, and still at least 1; plate also slows you), trauma vest (+1 max health) |
| Weapon | Knife (starts here), hatchet (harder, dulls faster), pipe (longer reach, no edge to lose) |
| Health | Bandage heals 1, stim heals 2 and sprints, field kit heals 3. Using it spends one. |

## Music

Three slots loop and crossfade when you move between the lobby, the climb, and floor 16:

| Slot | File |
| --- | --- |
| Basecamp | `public/audio/music/camp.ogg` |
| Climb | `public/audio/music/climb.ogg` |
| Hatch | `public/audio/music/hatch.ogg` |

Replace a slot by dropping a file on that name. `.ogg` (Vorbis) is the one to use for the Android WebView: it is small, Chromium decodes it, and a loop crossfades cleanly. `.m4a` (AAC) is the other phone-friendly choice. `.mp3` also plays. If several extensions share a name, `.ogg` is the one that loads. Do not use WAV; it is heavy to decode on a phone. The files shipping here are CC0 placeholders (a piano sting and the Abyss bed). Credits, including an **Original music by the user** section, are in `AUDIO_CREDITS.md`.

## Phone performance

On a headless Chrome window at 1280×720, floor 8 (10 undead) went from 34 fps to 41 fps with effects on, and from 47 fps to 60 fps with low effects. The worst frame in low effects dropped from 33 ms to 17 ms. Floor 12 held 42 fps with effects and 60 with low effects.

Low effects now skips the grain, the vignette pulse, the thunder, the dust, and the Phaser light layer, and it culls enemies a little tighter. The flashlight cone stays. Bullets are pooled instead of created and destroyed. Steady bulbs are drawn once. Gunshot noise reuses one buffer: 400 shots of 8000 samples cost 13.8 ms when allocated each time and about 0.01 ms from the cache. A full light redraw of 80 bulbs for 400 frames cost 3.28 ms; drawing the steady bulbs once and only the flickering ones after that cost 1.42 ms. Sprites share one texture atlas.

The first time you climb, a short intro plays: rain, the door, thunder, then the tower answering. After that it can be skipped, or replayed from Settings. Brightness and a low-effects toggle live there too.

Walking into a floor above your gear (one step per installed upgrade, starting from the kit you already have) shows a warning and does not stop you. You can finish the whole climb without meeting anyone. There are no living people in this build.

CC0 audio is listed in `AUDIO_CREDITS.md`. A dedicated teeth-grinding take was not found; the intro uses a CC0 bone snap for that layer and a CC0 scrape for the walls.

## Stubbed

- Recon mode, and any multiplayer session that would fill the coin wallet for real
- Switch split-screen co-op
- Floors past the locked hatch, the pet-store sanctuary, and a working helicopter
- A release keystore in GitHub Actions secrets (debug builds already share one debug key)
- Real art and recorded audio (shapes, and a small synthesizer, on purpose)

Developer hooks exist in `npm run dev` and on `?debug=1`: `window.__nazg.goto(floor)`, `.place(x, y)`, `.pos()`, `.kill()`, `.fill()`, `.coins(n)`.
