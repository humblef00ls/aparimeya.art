# Rendering model

## Scope and units

The renderer models the spatial light paths around a stationary, non-rotating Schwarzschild black hole. Distances are dimensionless: the Schwarzschild radius `r_s = 2GM/c²` is one. The horizon is at `r = 1`, the photon sphere at `r = 1.5`, and the disk's inner edge at the Schwarzschild ISCO, `r = 3`. The disk ends at `r = 10`.

This is an interactive visualization, not a numerical-relativity or radiative-transfer research tool. It does not model a Kerr metric, frame dragging, coordinate-time delays, polarization, plasma dynamics or a physical spectrum. Changing the animation speed does not change spacetime or photon propagation.

## Curved rays

Each fullscreen fragment constructs a ray in the observer's local orthonormal camera frame. A static observer's radial component is converted to orbital coordinates using `sqrt(1 - 1/r)`. In the orbital plane, the Schwarzschild null-geodesic orbit can be expressed in Cartesian coordinates as:

```text
x'' = -(3/2) L² x / |x|⁵
L²  = |x × x'|²
```

Here the prime denotes an affine parameter derivative, and `r_s = 1`. The shader computes the conserved angular momentum at launch and advances position and velocity with velocity Verlet. The integration step scales from `0.035r` near the photon sphere to `0.075r` outside `r = 6`, clamped to `[0.035, 1.4]`, with up to 320 steps. Rays within `r = 1.015` are captured; rays beyond `r = 65` escape. Rays that exhaust the budget receive no background contribution. This bounded integration trades precision in very high-order images for interactive performance.

Turning lensing off removes the acceleration and radial-coordinate correction, giving straight rays for comparison. The horizon remains an absorbing surface.

## Disk and sky

The disk lies on `y = 0`. Each step checks for a sign change and interpolates the intersection, so a thin disk cannot be skipped just because it lies between integration samples. Multiple crossings produce secondary disk images naturally. The disk uses partial transmission; radiance and transmission are accumulated front to back.

Emission uses periodic orbital coordinates, radial filaments and smooth inner/outer falloffs. The texture is procedural, deterministic and animated with a Kepler-like radial speed. Color and intensity are artist-directed. The disk's orbital velocity produces an approximate Doppler factor, with a gravitational redshift factor, to brighten approaching material and dim receding material. This is an illustrative bolometric approximation, not spectral radiative transfer.

Escaping rays sample a procedural cube-projected star field using their final direction, so the background also lenses. Star points are illustrative; their magnification and photometry are not scientifically calibrated.

## Render passes

1. Trace into a floating-point (`RGBA16F`) render target. Values above one remain available for bloom.
2. Area-filter and extract bright light into a half-display-resolution target before decimation.
3. Apply a horizontal Gaussian blur with contiguous bilinear samples.
4. Blur vertically into a separate target.
5. Composite scene and bloom, apply an ACES-style filmic curve and display gamma, then select discrete source-pixel centers and add static sub-byte dither per source pixel.
6. If selected, run ASCII or ordered dither on the completed display image. Original bypasses this stage and releases its full-size buffer.

With glow, grid and final effects disabled, only the trace and composite passes execute. The optional gravity grid adds a separate pass and render target; its light is composited using the ray tracer’s transmission mask before final effects.

There is no temporal accumulation or history texture: motion stays responsive and does not ghost. Every resolution uses two base rays and sixteen stratified samples in the narrow band around the critical impact parameter. Upscaling uses nearest-neighbor scene sampling and quantizes bloom and dither to the same pixel grid. There is no screen-space edge smoothing. Very thin images can still alias at low pixel counts, but enlargement does not smear adjacent pixels. Bloom is an optical presentation effect, not additional emitted light in the physical simulation.

## Performance and lifetime

The Resolution slider directly controls a scale from 0.25× to 1.75× per dimension, with 1× at its default midpoint. Pixel count therefore changes quadratically with scale. An 8,388,608-pixel ceiling bounds allocations on very large displays. Ray counts remain constant while resolution changes. Bloom buffers and kernel radius use display dimensions, independent of the Resolution slider, so lowering resolution does not enlarge the glow. Browser CSS dimensions determine camera aspect; internal pixel dimensions never affect the field of view. Portrait views increase vertical field of view to retain horizontal framing. The final composite runs at CSS pixel resolution rather than unrestricted device-pixel ratio.

Camera damping uses elapsed time. The simulation clamps unusually large time steps after stalls and stops requesting frames while the page is hidden. Time pause leaves the render loop active so navigation still works. GPU targets are reallocated only on size/resolution changes. All targets, materials, geometry, events, resize observers and animation callbacks are released on teardown. Context loss presents a restart action.

## Where to make changes

- Camera views, resolution bounds, disk radii: `model.ts`.
- Ray step policy, horizon/escape criteria: `trace.frag.glsl`.
- Disk structure, emission and orbital animation: `disk.glsl`.
- Star density and appearance: `sky.glsl`.
- Bloom and tone mapping: corresponding shaders and `renderer.ts`.
- Controls and labels: the Svelte components in `components/`.

A rotating black hole requires a different geodesic model; it should not be simulated by merely twisting the disk texture or adding a visual spin slider.

## Performance measurements

Statistics are sampled over roughly 750 ms. Frame intervals use the animation-frame clock without the animation's stall clamp; CPU submission uses `performance.now()` around the render calls and excludes asynchronous GPU execution. Draw calls are counted across all passes. Render-target memory is the sum of the RGBA16F allocations, including the optional final-effect buffer (eight bytes per texel), excluding driver overhead and the display buffer. Optional browser heap reporting is not total application or GPU memory. No unsupported measurement is substituted with a fabricated value.

## Appearance and visual guides

Disk color is an sRGB UI value converted to linear RGB by Three.js before emission. Texture strength blends from uniform radial emission to procedural filaments, with texture scale and brightness independent. A path-length footprint estimate based on display dimensions, independent of the Resolution slider, attenuates high-frequency bands at small screen scales; it is not a full geodesic ray-differential solution.

Stars have deterministic variations in size, brightness and color, with rare bright halos. Neighboring cells contribute to prevent large points from being cut off by cell boundaries. The stars remain illustrative and may stretch strongly under lensing.

The gravity grid is a qualitative surface `y = -2 - 9/(1 + 0.08r²)` below the disk. Straight observer rays intersect it using bounded stepping and bisection. It renders in a separate optional pass. Its contribution is attenuated by disk transmission and excluded for captured rays. It is a visual aid, not a Schwarzschild embedding diagram or part of the geodesic equations.

ASCII averages display-image samples per character cell and draws a procedural 5×7 glyph palette. Dither quantizes display RGB to four levels per channel with a 4×4 Bayer threshold matrix. Both run after bloom, tone mapping and pixel scaling; UI panels are unaffected. Increasing effect size enlarges characters or dither pixels.

### Final filters

After compositing and the optional ASCII/Dither pass, an optional gradient map converts display-space luma to three palette stops. It samples at output pixel centers and does not blur or resample the effect. All palettes start at black so glyph gaps and empty space remain black. None bypasses the pass. A separate intermediate buffer is full-size only when both a shader effect and a filter are active; GPU estimates and cleanup include that buffer.

The gravity grid solves the well’s implicit cubic along each ray. Derivative roots split it into monotone intervals, refined by bisection. Every crossing contributes transparent line coverage, so the near wall does not hide the bottom. Intersection bounds follow the well’s enclosing sphere rather than a fixed distance from the camera.
