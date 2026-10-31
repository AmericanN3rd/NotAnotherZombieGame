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

Open the URL Vite prints. `npm run build` typechecks and writes `dist/`. `npm run preview` serves that folder. `npm test` checks the shop limits and the active-reload timing.

### GitHub Pages

`vite.config.ts` uses a relative `base`, so `dist/` works at a project-site subpath. `.github/workflows/pages.yml` builds and deploys on pushes to `main` (and when the workflow is run by hand). After the action is enabled in the repo’s Pages settings (source: GitHub Actions), the climb is served from the Pages URL.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A/D or arrows | Left stick |
| Jump | Space (W or Up when you are not on a ladder) | Jump |
| Climb | W/S or Up/Down while overlapping a ladder | Stick up / down |
| Knife | J or X | Knife |
| Shoot | K or Z | Fire |
| Reload | R | Reload |
| Use | E or F | Use |
| Flare | G or 3 | Flare on the HUD |
| Pause | Esc or P | — |

Aim a little up or down by holding up or down while you fire, as long as you are not climbing.

Touch controls show on coarse pointers, narrow windows, or `?touch=1`.

Gunshots are loud and pull nearby undead. The knife is silent. Reload is a moving bar: tap again in the green band for a clean reload, tap outside it and the gun jams, or let the bar finish for a slow safe reload. The flare gun is carried and does not fire.

## Floors

1. **Quiet.** A ward with something that sleeps until you shoot, the line “they’re inside, be careful.”, the line “I can’t wake up.”, and the first vending cache. The wallet starts at 36 coins (a stand-in for Recon earnings). This floor will only sell 30 coins of gear: pistol rounds, compensator, power, or a silencer.
2. **Two ways up.** Spikes and pits along the maintenance hall, with no undead. A vent is faster and ends at a computer lock. Bypass it and the undead (and a ferret) on the other side wake up.
3. **Hollow floors.** More undead, ferrets, and a macaw that screams and calls bigger threats. Ladders start here. A crumbled span drops you to the bottom of the floor; you keep your gear, then climb out. The landing above that is as far as this prototype goes.

Walking into a floor above your gear (one step per installed upgrade, starting from the kit you already have) shows a warning and does not stop you.

## Stubbed

- Recon mode, and any multiplayer session that would fill the coin wallet for real
- Switch split-screen co-op
- Floors 4–6, unsafe ladders, and the pet-store sanctuary
- The roof, the working flare gun, and both helicopter endings
- Real art and recorded audio (shapes, and a small synthesizer, on purpose)

Developer hooks exist in `npm run dev` and on `?debug=1`: `window.__nazg.goto(floor)`, `.place(x, y)`, `.pos()`, `.kill()`, `.fill()`, `.coins(n)`.
