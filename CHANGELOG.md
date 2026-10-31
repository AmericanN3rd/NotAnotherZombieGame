# Changelog

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
