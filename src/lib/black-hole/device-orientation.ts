import { Quaternion, Vector3 } from "./math.ts";
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
    .setFromYXZ(
      sample.beta * radians,
      sample.alpha * radians,
      -sample.gamma * radians,
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
  | "restoring"
  | "requesting"
  | "waiting"
  | "active"
  | "denied"
  | "unavailable";
type PermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const MOTION_ACCESS_KEY = "aparimeya.motion-access.v1";

export function isMobileMotionDevice() {
  return (
    navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches
  );
}

function rememberMotionAccess(granted: boolean) {
  try {
    if (granted) localStorage.setItem(MOTION_ACCESS_KEY, "granted");
    else localStorage.removeItem(MOTION_ACCESS_KEY);
  } catch {
    /* Storage is optional; explicit activation still works. */
  }
}

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

  /** A saved grant is a hint, never a substitute for the browser's permission check. */
  async restore() {
    try {
      if (localStorage.getItem(MOTION_ACCESS_KEY) !== "granted") return;
    } catch {
      return;
    }
    await this.enable(true);
  }

  async enable(automatic = false) {
    this.disable();
    if (!this.supported) {
      this.onStatus("unavailable");
      return;
    }
    const generation = this.generation;
    this.onStatus(automatic ? "restoring" : "requesting");
    try {
      const api = window.DeviceOrientationEvent as PermissionEvent;
      // Existing grants resolve without a gesture. A new grant requires the button click.
      const permission = api.requestPermission
        ? await api.requestPermission()
        : "granted";
      if (generation !== this.generation) return;
      if (permission !== "granted") {
        rememberMotionAccess(false);
        this.onStatus(automatic ? "off" : "denied");
        return;
      }
      if (api.requestPermission) rememberMotionAccess(true);
      this.events = new AbortController();
      const signal = this.events.signal;
      this.onStatus(automatic ? "restoring" : "waiting");
      this.timeout = setTimeout(() => {
        this.disable();
        this.onStatus(automatic ? "off" : "unavailable");
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
          if (!this.reference) {
            this.reference = current.clone();
            rememberMotionAccess(true);
          }
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
        rememberMotionAccess(false);
        this.onStatus(automatic ? "off" : "denied");
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
