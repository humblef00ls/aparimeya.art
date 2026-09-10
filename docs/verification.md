# Verification

Run `npm run check`, `npm test` and `npm run build` before shipping.

Automated tests cover camera basis orthogonality after extreme input, frame-rate-independent damping, reset after multiple revolutions, safe orbit bounds, preset validity and render-budget behavior at 4K and small sizes.

Browser QA must use a real GPU-capable browser; a successful JavaScript build does not compile or validate GLSL programs. Check:

- Initial view produces a black shadow, foreground disk, lensed far-side arc and secondary image.
- Cinematic, edge-on and overhead presets converge to their distinct views.
- Drag and wheel change the camera; reset restores the default view.
- Arrow keys, plus/minus and R operate when the canvas has focus, without hijacking form inputs.
- Lensing off removes the warped disk image; Doppler off removes directional brightness asymmetry.
- Stars and glow toggle independently. Exposure, speed and the Resolution slider affect their intended properties.
- Pause freezes animation while manual orbit remains available. Auto orbit stops on manual input.
- Only three icon buttons (performance, final shaders, appearance) are visible when panels are closed. All panels fit desktop and phone widths; opening one closes the other. Escape closes a panel and returns focus to its button.
- Stats updates while open. The Resolution slider starts at 1× and changes target resolution while ray samples remain constant; glow off reduces draw calls from five to two. The gravity grid adds one call and a trace-sized buffer. A final effect adds one call and a display-sized buffer; Original releases that buffer. Memory labels distinguish estimates from browser measurements.
- Thin ring edges use adaptive spatial coverage; bloom shows no coarse checkerboard pattern when zoomed.
- No shader/WebGL errors appear in the browser console.
- A lost GPU context or unavailable float color buffer produces an actionable error instead of a blank page.

The implementation was checked in the Codex inbuilt browser. Actual touch hardware, low-end mobile GPUs and other browsers require separate device testing; responsive viewport testing alone does not establish their performance.

Additional appearance QA: set disk texture to zero and verify a smooth disk; change color; vary star size/density/variation; toggle the gravity well; switch between Original, ASCII and Dither; resize with an effect enabled; adjust effect size; verify Escape focus and panel exclusivity. The slider changes pixel dimensions only. Check that low resolutions produce crisp pixel blocks, not smooth interpolation, and that sampling remains 2–16. Check its minimum, midpoint and maximum, with stable camera framing. No cross-device frame-rate guarantee is implied.

## Mobile defaults and orientation update

- Verified the production build in the in-app browser at 532 × 852: violet-indigo disk, quarter-resolution pixels, and dither render correctly.
- Verified the extended zoom limit still shows the disk and star field; inward rays from beyond the previous escape radius are no longer discarded.
- Verified the motion-enable control and the browser's denied-permission message. Physical phone sensors were not available for end-to-end testing.
- Automated orientation tests cover portrait/landscape calibration, bounded tilt, roll, orthonormal camera vectors, and disposal while permission is pending.

## Flowing disk and glass controls

- Verified stronger disk variation in the default quarter-resolution dither view.
- Dragged the canvas and confirmed Auto orbit remained enabled.
- Opened the shader choices inside settings; only stats and settings buttons remain on the canvas.
- Changed the disk color to amber and verified matching slider, value, and active-control colors. The panel visibly blurs the scene behind it without a border.
