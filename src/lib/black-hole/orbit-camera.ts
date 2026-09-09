import { Vector3 } from "three";
import {
  constrainOrbit,
  VIEWS,
  type OrbitState,
  type ViewPreset,
} from "./model.ts";

/** Camera geometry only. Input and DOM lifetime belong to OrbitControls. */
export class OrbitCamera {
  readonly position = new Vector3();
  readonly forward = new Vector3();
  readonly right = new Vector3();
  readonly up = new Vector3();
  private state: OrbitState = { ...VIEWS.cinematic };
  private target: OrbitState = { ...VIEWS.cinematic };
  private readonly worldUp = new Vector3(0, 1, 0);

  constructor() {
    this.update(0);
  }

  orbit(horizontal: number, vertical: number) {
    this.target = constrainOrbit({
      ...this.target,
      azimuth: this.target.azimuth - horizontal,
      elevation: this.target.elevation + vertical,
    });
  }

  zoom(logarithmicDelta: number) {
    this.target = constrainOrbit({
      ...this.target,
      distance: this.target.distance * Math.exp(logarithmicDelta),
    });
  }

  setView(preset: ViewPreset) {
    // Choose the nearest equivalent azimuth so presets never spin a full revolution.
    const view = VIEWS[preset];
    const offset = Math.round(
      (this.state.azimuth - view.azimuth) / (2 * Math.PI),
    );
    this.target = { ...view, azimuth: view.azimuth + offset * 2 * Math.PI };
  }

  update(delta: number, autoOrbit = false) {
    if (autoOrbit) this.target.azimuth += delta * 0.055;
    const blend = 1 - Math.exp(-delta * 12);
    for (const key of ["azimuth", "elevation", "distance"] as const) {
      this.state[key] += (this.target[key] - this.state[key]) * blend;
    }
    const { distance, azimuth, elevation } = this.state;
    const horizontal = distance * Math.cos(elevation);
    this.position.set(
      horizontal * Math.sin(azimuth),
      distance * Math.sin(elevation),
      horizontal * Math.cos(azimuth),
    );
    this.forward.copy(this.position).negate().normalize();
    this.right.crossVectors(this.forward, this.worldUp).normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
  }

  get distance() {
    return this.state.distance;
  }
  get inclination() {
    return 90 - (this.state.elevation * 180) / Math.PI;
  }
}
