import { Euler, Quaternion, Vector3 } from "three";
import { clamp } from "./model.ts";
import type { MotionPose } from "./orbit-camera.ts";

export interface OrientationSample {
  alpha: number;
  beta: number;
  gamma: number;
  screenAngle: number;
}

/** Device axes to camera axes, including portrait/landscape screen rotation. */
export function orientationQuaternion(sample: OrientationSample): Quaternion {
  const radians = Math.PI / 180;
  return new Quaternion()
    .setFromEuler(
      new Euler(
        sample.beta * radians,
        sample.alpha * radians,
        -sample.gamma * radians,
        "YXZ",
      ),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        -sample.screenAngle * radians,
      ),
    );
}

/** Bounded orbit offsets give depth without integrating acceleration (which drifts). */
export function relativeMotion(
  reference: Quaternion,
  current: Quaternion,
): MotionPose {
  const relative = reference.clone().invert().multiply(current);
  const forward = new Vector3(0, 0, -1).applyQuaternion(relative);
  const up = new Vector3(0, 1, 0).applyQuaternion(relative);
  return {
    yaw: clamp(Math.atan2(-forward.x, -forward.z) * 0.35, -0.25, 0.25),
    pitch: clamp(Math.asin(clamp(forward.y, -1, 1)) * 0.35, -0.2, 0.2),
    roll: -Math.atan2(up.x, up.y),
  };
}

export type MotionStatus =
  | "off"
  | "requesting"
  | "waiting"
  | "active"
  | "denied"
  | "unavailable";
type PermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Owns permission and sensor lifetime. Sensor readings stay in this browser. */
export class DeviceOrientationControls {
  readonly supported =
    typeof window.DeviceOrientationEvent !== "undefined" &&
    window.isSecureContext;
  private events?: AbortController;
  private reference?: Quaternion;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;

  private readonly onPose: (pose: MotionPose) => void;
  private readonly onStatus: (status: MotionStatus) => void;

  constructor(
    onPose: (pose: MotionPose) => void,
    onStatus: (status: MotionStatus) => void,
  ) {
    this.onPose = onPose;
    this.onStatus = onStatus;
  }

  async enable() {
    this.disable();
    if (!this.supported) {
      this.onStatus("unavailable");
      return;
    }
    const generation = this.generation;
    this.onStatus("requesting");
    try {
      const api = window.DeviceOrientationEvent as PermissionEvent;
      // iOS requires this call directly in the button's user-activation handler.
      const permission = api.requestPermission
        ? await api.requestPermission()
        : "granted";
      if (generation !== this.generation) return;
      if (permission !== "granted") {
        this.onStatus("denied");
        return;
      }
      this.events = new AbortController();
      const signal = this.events.signal;
      this.onStatus("waiting");
      this.timeout = setTimeout(() => {
        this.disable();
        this.onStatus("unavailable");
      }, 5000);
      window.addEventListener(
        "deviceorientation",
        (event) => {
          if (document.hidden || event.beta === null || event.gamma === null)
            return;
          const sample = {
            alpha: event.alpha ?? 0,
            beta: event.beta,
            gamma: event.gamma,
            screenAngle: screen.orientation?.angle ?? window.orientation ?? 0,
          };
          if (!Object.values(sample).every(Number.isFinite)) return;
          const current = orientationQuaternion(sample);
          if (!this.reference) this.reference = current.clone();
          clearTimeout(this.timeout);
          this.onPose(relativeMotion(this.reference, current));
          this.onStatus("active");
        },
        { signal },
      );
      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) this.recenter();
        },
        { signal },
      );
    } catch {
      if (generation === this.generation) {
        this.disable();
        this.onStatus("denied");
      }
    }
  }

  recenter() {
    this.reference = undefined;
    this.onPose({ yaw: 0, pitch: 0, roll: 0 });
  }

  disable() {
    this.generation++;
    this.events?.abort();
    this.events = undefined;
    clearTimeout(this.timeout);
    this.recenter();
    this.onStatus("off");
  }

  dispose() {
    this.disable();
  }
}
