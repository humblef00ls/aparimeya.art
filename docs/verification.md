# Verification

Run `npm run check`, `npm test`, and `npm run build` before shipping. A successful TypeScript build does not validate WGSL execution; browser checks require a real WebGPU adapter.

The 20 unit tests cover camera geometry and damping, entrance timing, orbit and resolution bounds, quaternion rotation, sRGB conversion, gradient persistence and stop crossing, and phone orientation/calibration/permission cleanup.

## Browser checks

- The first rendered image fades in as the camera settles. Reduced motion skips the entrance. No loading label flashes.
- Drag, wheel/pinch, keyboard navigation, reset, and view presets work. Auto orbit continues during manual input; pause freezes time while navigation remains available.
- Disk color, texture, brightness, glow, stars, lensing, and Doppler controls update independently. Slider accents follow disk color.
- Resolution starts at 0.33× and changes only pixel dimensions. Check minimum and maximum, portrait and landscape, and resizing with a final effect active.
- Original, ASCII, and Dither work with every filter. Custom stops cross one another, can be recolored, and survive reload in local storage. Defaults remain Dither 8 and ASCII 7.
- The grid remains visible above and below the disk, including the bottom through gaps, at near and far zoom limits. Close views may naturally crop it.
- Only the settings and statistics icons appear when panels are closed. Panels stay within the viewport, are mutually exclusive, and close with Escape. FPS, dimensions, ray counts, draw calls, and estimated memory update.
- Missing WebGPU and device loss produce actionable errors. Restart/recreation releases the previous GPU resources. No alternate backend is selected.

## Migration evidence

The September 2026 migration compared 139 fixed-time renders against commit `416742c` in the in-app browser: all effect/filter/grid combinations at three resolutions; fifteen grid angles/distances; appearance toggles; sixteen custom gradient stops; and four viewport sizes. There were no GPU validation errors. The comparison also included six larger reference views. [Results and limitations](webgpu-migration.md).

Lifecycle checks exercised unavailable WebGPU, an initial 1×1 viewport, device destruction, idempotent disposal, and recreating a device on the same canvas. Interactive checks covered the actual Svelte page, resolution updates, and the settings/statistics panels.

Physical phone sensors and other browsers were not available for this migration’s end-to-end tests. Unit tests preserve the orientation behavior, but desktop rendering checks do not establish mobile performance or browser compatibility.

## Repeat the GPU checks

Run `npm run test:gpu`, then open these paths at `http://127.0.0.1:5175`:

- `/tests/browser/benchmark.html`: three default/maximum trials at 1280×720, plus six downloadable reference images.
- `/tests/browser/matrix.html`: 139 configurations with downloadable images and statistics.
- `/tests/browser/lifecycle.html`: unsupported API, device-loss, recreation, and tiny-viewport checks.

These files are outside `static/` and are not deployed. Each page displays its result and exposes downloads; an optional `collector` query parameter can send the same PNG/JSON records to a local HTTP collector. Keep the same browser, viewport, settings, and power conditions when comparing revisions. Avoid running another GPU workload during timing.
