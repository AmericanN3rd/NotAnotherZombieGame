# NAZG (Not Another Zombie Game)

A playable prototype of the first three floors of a 2D horror platformer. You climb a dead tower alone. Notes are the only voices. The flare gun stays on your belt for a roof that this build does not reach.

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
| Flare | G or 3 | Flare on the HUD | LB (a reminder; it still does not fire) |
| Pause | Esc or P | — | Menu |
| Shop rows | 1–4 | tap a row | Stick or D-pad, A buys, B backs out |
| Menus | click | tap | A confirms, B backs out, Menu toggles pause |

Aim a little up or down with W/S, the touch stick, or the left stick while you fire, as long as you are not climbing. Pushing the stick up does not jump; A does.

Touch controls show on coarse pointers, narrow windows, or `?touch=1`, and hide again once a pad is the active input.

Gunshots are loud and pull nearby undead. The knife is silent. Reload is a moving bar: press reload again in the green band for a clean reload, press outside it and the gun jams, or let the bar finish for a slow safe reload. That second press is the same button on a pad as the first. Notes are picked up by walking over them. B / E holds the lock bypass and opens the cache. The flare gun is carried and does not fire.

## Floors

1. **Quiet.** A ward with something that sleeps until you shoot, the line “they’re inside, be careful.”, the line “I can’t wake up.”, and the first vending cache. The wallet starts at 36 coins (a stand-in for Recon earnings). This floor will only sell 30 coins of gear: pistol rounds, compensator, power, or a silencer.
2. **Two ways up.** Spikes and pits along the maintenance hall, with no undead. A vent is faster and ends at a computer lock. Bypass it and the undead (and a ferret) on the other side wake up.
3. **Hollow floors.** More undead, ferrets, and a macaw that screams and calls bigger threats. Ladders start here. A crumbled span drops you to the bottom of the floor; you keep your gear, then climb out.
4–8. **Generated.** Hand-authored chunks (corridors, spike runs, pits, ladder shafts, vents, locks, crumble drops, shops, note nooks) are chained from a seed. Difficulty ticks up each floor: more and tougher undead, denser traps, fewer medkits and coins. From floor 4, a ladder slips if an undead is close. The pause screen shows the seed that built the floor; Settings can lock one for testing, and `window.__nazg.setSeed(n)` does the same. Floor 8 ends on another “to be continued.”
6. **Wager.** A vending machine offers three optional lanes under the hall. Harder lanes pay more coins. The stairs up stay on the main floor.

The first time you climb, a short intro plays: rain, the door, thunder, then the tower answering. After that it can be skipped, or replayed from Settings. Brightness and a low-effects toggle live there too.

Walking into a floor above your gear (one step per installed upgrade, starting from the kit you already have) shows a warning and does not stop you. You can finish the whole climb without meeting anyone. There are no living people in this build.

CC0 audio is listed in `AUDIO_CREDITS.md`. A dedicated teeth-grinding take was not found; the intro uses a CC0 bone snap for that layer and a CC0 scrape for the walls.

## Stubbed

- Recon mode, and any multiplayer session that would fill the coin wallet for real
- Switch split-screen co-op
- Floors 4–6, unsafe ladders, and the pet-store sanctuary
- The roof, the working flare gun, and both helicopter endings
- Real art and recorded audio (shapes, and a small synthesizer, on purpose)

Developer hooks exist in `npm run dev` and on `?debug=1`: `window.__nazg.goto(floor)`, `.place(x, y)`, `.pos()`, `.kill()`, `.fill()`, `.coins(n)`.
