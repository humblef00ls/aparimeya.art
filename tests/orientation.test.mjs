import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import {
  orientationQuaternion,
  relativeMotion,
  DeviceOrientationControls,
} from "../src/lib/black-hole/device-orientation.ts";
import { OrbitCamera } from "../src/lib/black-hole/orbit-camera.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test("calibration produces zero offsets in portrait and landscape", () => {
  for (const screenAngle of [0, 90, -90, 180]) {
    const q = orientationQuaternion({
      alpha: 350,
      beta: 70,
      gamma: 12,
      screenAngle,
    });
    const pose = relativeMotion(q, q);
    for (const value of Object.values(pose)) near(value, 0);
  }
});

test("roll is preserved while tilt parallax is bounded", () => {
  const reference = new Quaternion();
  const roll = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    Math.PI / 3,
  );
  near(relativeMotion(reference, roll).roll, Math.PI / 3);
  const tilt = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2,
  );
  near(relativeMotion(reference, tilt).yaw, 0.25);
});

test("motion keeps camera basis orthonormal and never changes zoom or saved orbit", () => {
  const camera = new OrbitCamera();
  const initial = camera.position.clone();
  camera.setMotion({ yaw: 0.2, pitch: 0.15, roll: 1.2 });
  camera.update(10);
  near(camera.distance, 28);
  near(camera.up.dot(camera.right), 0);
  near(camera.up.dot(camera.forward), 0);
  near(camera.up.length(), 1);
  camera.setMotion({ yaw: 0, pitch: 0, roll: 0 });
  camera.update(10);
  near(camera.position.distanceTo(initial), 0);
  camera.zoom(100);
  camera.update(10);
  near(camera.distance, 110);
});

test("disposal during a permission request cannot attach sensor listeners", async () => {
  const original = globalThis.window;
  let resolve;
  const statuses = [];
  globalThis.window = {
    isSecureContext: true,
    DeviceOrientationEvent: {
      requestPermission: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    addEventListener: () => assert.fail("listener attached after disposal"),
  };
  try {
    const controls = new DeviceOrientationControls(
      () => {},
      (s) => statuses.push(s),
    );
    const pending = controls.enable();
    controls.dispose();
    resolve("granted");
    await pending;
    assert.equal(statuses.at(-1), "off");
  } finally {
    globalThis.window = original;
  }
});
