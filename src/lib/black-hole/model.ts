import type { FilterPreset } from "./filters";

/** All distances are expressed in Schwarzschild radii (rₛ = 2GM/c² = 1). */
export const HORIZON_RADIUS = 1;
export const DISK_INNER_RADIUS = 3;
export const DISK_OUTER_RADIUS = 10;

export type PostEffect = "none" | "ascii" | "dither";
export type ViewPreset = "cinematic" | "edge" | "overhead";

export interface SimulationSettings {
  exposure: number;
  bloom: number;
  speed: number;
  lensing: boolean;
  doppler: boolean;
  stars: boolean;
  paused: boolean;
  autoOrbit: boolean;
  resolution: number;
  diskColor: string;
  diskTexture: number;
  diskScale: number;
  diskBrightness: number;
  starSize: number;
  starVariation: number;
  starDensity: number;
  gravityGrid: boolean;
  postEffect: PostEffect;
  filter: FilterPreset;
  asciiSize: number;
  ditherSize: number;
}

export const DEFAULT_SETTINGS: Readonly<SimulationSettings> = Object.freeze({
  exposure: 1.15,
  bloom: 0.75,
  speed: 1,
  lensing: true,
  doppler: true,
  stars: true,
  paused: false,
  autoOrbit: true,
  resolution: 0.33,
  diskColor: "#7952e8",
  diskTexture: 0.6,
  diskScale: 1,
  diskBrightness: 1,
  starSize: 1.55,
  starVariation: 0.9,
  starDensity: 1.3,
  gravityGrid: false,
  postEffect: "dither",
  filter: "none",
  asciiSize: 7,
  ditherSize: 8,
});

export interface OrbitState {
  azimuth: number;
  elevation: number;
  distance: number;
}

export const VIEWS: Readonly<Record<ViewPreset, Readonly<OrbitState>>> = {
  cinematic: { azimuth: 0.35, elevation: 0.16, distance: 28 },
  edge: { azimuth: 0.35, elevation: 0.025, distance: 28 },
  overhead: { azimuth: 0.35, elevation: 1.35, distance: 32 },
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Keep the camera outside the disk and avoid the look-at pole singularity. */
export function constrainOrbit(state: OrbitState): OrbitState {
  return {
    azimuth: state.azimuth,
    elevation: clamp(state.elevation, -1.45, 1.45),
    distance: clamp(state.distance, 13, 110),
  };
}

// Sampling is independent of resolution: changing pixel dimensions must not change the model.
export const RAY_SAMPLES = 2;
export const RING_SAMPLES = 16;

// Keep extreme display sizes from allocating unbounded floating-point buffers.
const MAX_RENDER_PIXELS = 8_388_608;

export function renderSize(width: number, height: number, resolution: number) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const scale = Math.min(
    Number.isFinite(resolution) ? clamp(resolution, 0.25, 1.75) : 1,
    Math.sqrt(MAX_RENDER_PIXELS / (w * h)),
  );
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
  };
}
