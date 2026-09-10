import { Vector3 } from "./math.ts";
import {
  clamp,
  constrainOrbit,
  VIEWS,
  type OrbitState,
  type ViewPreset,
} from "./model.ts";

export interface MotionPose {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Camera geometry only. Input and DOM lifetime belong to OrbitControls. */
export class OrbitCamera {
  readonly position = new Vector3();
  readonly forward = new Vector3();
  readonly right = new Vector3();
  readonly up = new Vector3();
  private state: OrbitState = { ...VIEWS.cinematic };
  private target: OrbitState = { ...VIEWS.cinematic };
  private motion: MotionPose = { yaw: 0, pitch: 0, roll: 0 };
  private motionTarget: MotionPose = { yaw: 0, pitch: 0, roll: 0 };
  private readonly worldUp = new Vector3(0, 1, 0);

  private entranceTime = 0;

  private readonly entranceDuration: number;

  constructor(entranceDuration = 0) {
    this.entranceDuration = entranceDuration;
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

  /** Sensor offsets never modify the orbit selected with touch or auto orbit. */
  setMotion(pose: MotionPose) {
    if (Object.values(pose).every(Number.isFinite))
      this.motionTarget = { ...pose };
  }

  update(delta: number, autoOrbit = false) {
    if (autoOrbit) this.target.azimuth += delta * 0.0495;
    const blend = 1 - Math.exp(-delta * 12);
    for (const key of ["azimuth", "elevation", "distance"] as const) {
      this.state[key] += (this.target[key] - this.state[key]) * blend;
    }
    for (const key of ["yaw", "pitch", "roll"] as const) {
      const difference = this.motionTarget[key] - this.motion[key];
      this.motion[key] +=
        Math.atan2(Math.sin(difference), Math.cos(difference)) * blend;
    }
    this.entranceTime += delta;
    const progress =
      this.entranceDuration > 0
        ? Math.min(1, this.entranceTime / this.entranceDuration)
        : 1;
    // Smoothstep settles with zero velocity; the normal orbit target stays unchanged.
    const entrance = 1 - progress * progress * (3 - 2 * progress);
    const distance = this.state.distance * (1 + 0.24 * entrance);
    const azimuth = this.state.azimuth + this.motion.yaw;
    const elevation = clamp(
      this.state.elevation + this.motion.pitch + 0.09 * entrance,
      -1.45,
      1.45,
    );
    const horizontal = distance * Math.cos(elevation);
    this.position.set(
      horizontal * Math.sin(azimuth),
      distance * Math.sin(elevation),
      horizontal * Math.cos(azimuth),
    );
    this.forward.copy(this.position).negate().normalize();
    this.right.crossVectors(this.forward, this.worldUp).normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    this.right.applyAxisAngle(this.forward, -this.motion.roll);
    this.up.crossVectors(this.right, this.forward).normalize();
  }

  get distance() {
    return this.state.distance;
  }
  get inclination() {
    return 90 - (this.state.elevation * 180) / Math.PI;
  }
}
