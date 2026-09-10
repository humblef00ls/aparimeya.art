import { hexColor } from "../math.ts";
import { gradientStops } from "../filters.ts";
import {
  DISK_INNER_RADIUS,
  DISK_OUTER_RADIUS,
  type SimulationSettings,
} from "../model.ts";
import type { OrbitCamera } from "../orbit-camera.ts";

export const FRAME_UNIFORM_BYTES = 27 * 16;

/** One vec4-aligned frame block; layout is mirrored in shaders/common.wgsl. */
export class FrameUniforms {
  readonly data = new Float32Array(FRAME_UNIFORM_BYTES / 4);
  setBlurDirection(x: number, y: number) {
    this.data.set([x, y], 38);
  }

  update(
    camera: OrbitCamera,
    settings: SimulationSettings,
    width: number,
    height: number,
    traceWidth: number,
    traceHeight: number,
    time: number,
  ) {
    const d = this.data;
    d.set([width, height, traceWidth, traceHeight], 0);
    const vector = (
      offset: number,
      v: { x: number; y: number; z: number },
      w: number,
    ) => d.set([v.x, v.y, v.z, w], offset);
    vector(
      4,
      camera.position,
      Math.tan((42 * Math.PI) / 360) * Math.max(1, height / width),
    );
    vector(8, camera.forward, time);
    vector(12, camera.right, Number(settings.lensing));
    vector(16, camera.up, Number(settings.doppler));
    d.set([...hexColor(settings.diskColor, true), settings.diskTexture], 20);
    d.set(
      [
        settings.diskScale,
        settings.diskBrightness,
        Number(settings.stars),
        settings.starSize,
      ],
      24,
    );
    d.set(
      [
        settings.starVariation,
        settings.starDensity,
        DISK_INNER_RADIUS,
        DISK_OUTER_RADIUS,
      ],
      28,
    );
    d.set(
      [
        settings.exposure,
        settings.bloom,
        settings.postEffect === "ascii" ? 1 : 2,
        settings.postEffect === "ascii"
          ? settings.asciiSize
          : settings.ditherSize,
      ],
      32,
    );
    d.set([1 / width, 1 / height, 0, 0], 36);
    const stops = gradientStops(settings.filter, settings.customGradient);
    d.set([stops.length, Number(settings.gravityGrid), 0, 0], 40);
    stops.forEach((s, i) =>
      d.set([...hexColor(s.color), s.position], 44 + i * 4),
    );
  }
}
