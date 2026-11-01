# Changelog

## 0.3.0

- Floor 1 is the lobby camp and the main menu. Notices on the wall open settings, controls, and credits. The stairs start a climb. Nobody else is there.
- Salvage is pocketed during a run and kept on death. Coins, gun parts, the knife’s edge, and found gear are lost. Each run reseeds floors 4 and up unless a seed is locked in settings.
- Four stations level up with salvage: workbench (reload and knife), armory (ammo and starting gear), infirmary (max health), radio (how high the climb can go, and which powers the caches stock). The lobby grows barricades, sandbags, lights, and patched walls as the stations rise.
- Floors 2 and 3 stay hand-built (the old quiet hall, then the two routes). The old top floor’s ladders and crumble live in the generator from floor 4. A first visit to the lobby says what the stations and the stairs are.
- Meta progress is `nazg-meta` version 1. v0.2.0 had no run save. Brightness, low effects, the intro flag, and a locked seed in `nazg-settings` are kept. Salvage and stations start at zero. Settings can reset progress without touching those options.
- Three music slots loop and crossfade: `public/audio/music/camp`, `climb`, and `hatch`. The files there are CC0 placeholders. Drop ogg, m4a, or mp3 on those names to replace them.
- Debug APK stays on the committed `androiddebugkey` certificate, versionCode 3, so it installs over 0.2.0.

## 0.2.0

- HUD is three readable meters: vital, magazine, and knife edge. Menus, the vending cache, and the pack use larger touch targets. Pad and keyboard prompts stay.
- The knife dulls with use. A worn edge glances. A dull edge mostly misses and swings slower. Sharpening stones are on the ground and in the machine.
- Each vending cache stocks three seeded powers. Prices rise as you climb. The floor spend limit still applies. Rounds, stones, and unowned gun parts stay in the machine.
- A pack with helmet, armor, weapon, and health slots. Found items change how hard you are to kill.
- The climb continues through floor 16. Floors 9–12 are an emptied ward (steam, blackouts, alarm halls). Floors 13–16 are machinery and grate jumps. The hatch above 16 stays shut. Nobody alive is added.
- Phone cost: pooled bullets, one sprite atlas, steady lights drawn once, cached gunshot noise, tighter culling, and a low-effects mode that drops the grain, vignette pulse, dust, thunder, and Phaser lights.
- Debug APKs are signed with the committed `android/app/debug.keystore` (public Android debug alias `androiddebugkey`) so later debug builds install over each other. v0.1.0 was signed with the runner's own debug key and will not update in place.

## 0.1.0

- Private Capacitor Android build. A `v*` tag publishes an APK on a GitHub Release. No Play Store setup.
