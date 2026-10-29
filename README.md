# Xochimilco de Muertos

A pixel-art pseudo-3D lane runner set in Xochimilco on Día de Muertos. A xoloitzcuintle in a canoa gathers lost souls and brings them to the ofrenda before dawn.

No build step: Three.js loads from a CDN through an import map. To run locally:

```
python3 -m http.server 8000
```

then open http://localhost:8000/.

## Controls
- **Desktop:** ←/→ or A/D to steer, Space/↑ to jump, ↓/S to duck, M to mute.
- **Phone (landscape):** tilt to steer, JUMP button, swipe down to duck. If tilt isn't available, swipe left or right to steer.

## Demo shortcuts
- `1`–`5` jump to a zone, `N` skips to the next one
- Three-finger tap skips to the next zone
- Zone buttons on the title screen
- `?zone=4` starts at a zone, and `?short` makes every zone shorter

All tuning lives in `CONFIG` at the top of `main.js`.
