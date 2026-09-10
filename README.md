# Aparimeya.art

An interactive black-hole renderer at [aparimeya.art](https://aparimeya.art). Orbit the accretion disk, watch light bend around the shadow, and adjust the scene in real time.

## How it works

The browser traces light paths around a non-rotating Schwarzschild black hole. Rays intersect a procedural disk or escape into a generated star field. Multiple disk intersections create the thin secondary rings. No image textures or external services are needed.

Three.js manages WebGL resources; custom GLSL shaders calculate the light paths, disk emission, glow, optional ASCII or dither effects, and a final gradient-map filter. SvelteKit provides the page and controls. Cloudflare Workers serves the application; rendering happens on the viewer’s GPU.

The disk’s colors and turbulence are illustrative, not a plasma simulation. The optional gravity grid is a visual guide. [Rendering details](docs/rendering.md) explain the equations and limits.

## Use it

Drag to orbit; scroll or pinch to zoom. The two bottom icons open performance measurements and settings, including final shader effects. With the canvas focused, arrow keys orbit, `+`/`-` zoom, `R` resets, and Space pauses animation.

**Resolution changes pixel dimensions only.** It defaults to 0.33× CSS resolution with dither (Dither scale 8, ASCII scale 7); lower values produce crisp pixel blocks. Ray sampling, disk detail, and glow radius stay fixed. Disk texture strength defaults to 40%, with subtle flowing knots and shaded spiral ridges; set it to zero for a smooth disk.

The default scene uses a violet-indigo disk, a fuller star field, and slow auto orbit, which continues during touch and zoom until switched off. Zoom extends to 110 Schwarzschild radii. In **Camera & rendering**, enable phone motion to add tilt parallax and roll compensation; recenter in your comfortable holding position. iOS asks for permission. Sensor readings stay on-device; this is orientation-driven depth, not positional tracking.

Filters map the finished image’s brightness to Mono, Amber, Aurora, or Cosmic palettes. Custom lets you add, position, recolor, and remove up to 16 gradient stops. Custom stops are saved locally in your browser and restored when you return; select Custom to apply them. They run after ASCII/Dither, preserve sharp edges, and default to None (no extra pass).

## Develop

Use Node 24 and a browser supporting WebGL 2 with floating-point color buffers.

```sh
npm ci
npm run dev
```

```sh
npm run check   # TypeScript and Svelte diagnostics
npm test        # Camera geometry, input bounds, and resolution limits
npm run build  # Cloudflare Worker and browser assets
npm run preview
```

## Code structure

- `src/lib/components/`: page lifecycle and controls. Settings go into the simulation; performance measurements come back at a low frequency.
- `src/lib/black-hole/simulation.ts`: animation, resizing, visibility, and cleanup.
- `orbit-camera.ts` and `orbit-controls.ts`: camera geometry and input handling, kept separate so geometry can be tested without a browser.
- `device-orientation.ts`: sensor permission, calibration, and screen-relative camera offsets.
- `renderer.ts` and `shaders/`: GPU resources and render passes. The renderer owns their allocation and disposal.
- `model.ts`: defaults, camera presets, units, and resolution bounds.

See [verification](docs/verification.md) for the browser checks. A successful build does not validate shader execution on a GPU.

## Deploy

With Wrangler authenticated to the existing Cloudflare account:

```sh
npm run deploy
```

This builds and publishes the `aparimeya-art` Worker configured in `wrangler.jsonc`, including its `aparimeya.art` and `www.aparimeya.art` custom domains. Cloudflare manages DNS and HTTPS; the domain remains registered at Namecheap. GitHub pushes and Cloudflare deployments are separate steps.

## Credits

Inspired by [kavan’s black-hole simulation](https://www.youtube.com/watch?v=8-B6ryuBkCM). Original renderer implementation. Licensed under [AGPL-3.0](LICENSE).
