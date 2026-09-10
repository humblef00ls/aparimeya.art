import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "../src/lib/black-hole/math.ts";
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

const accessKey = "aparimeya.motion-access.v1";
function motionBrowser(t, requestPermission) {
  const values = new Map();
  const window = Object.assign(new EventTarget(), {
    isSecureContext: true,
    DeviceOrientationEvent: requestPermission ? { requestPermission } : {},
  });
  const replacements = {
    window,
    document: Object.assign(new EventTarget(), { hidden: false }),
    screen: { orientation: { angle: 0 } },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  for (const [key, value] of Object.entries(replacements)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  const statuses = [];
  const controls = new DeviceOrientationControls(
    () => {},
    (status) => statuses.push(status),
  );
  t.after(() => controls.dispose());
  const sample = () =>
    window.dispatchEvent(
      Object.assign(new Event("deviceorientation"), {
        alpha: 0,
        beta: 30,
        gamma: 5,
      }),
    );
  return { values, controls, statuses, sample };
}

test("fresh visits do not request motion permission automatically", async (t) => {
  const browser = motionBrowser(t, () =>
    assert.fail("unexpected permission request"),
  );
  await browser.controls.restore();
  assert.deepEqual(browser.statuses, []);
});

test("successful grants restore motion on the next visit", async (t) => {
  let requests = 0;
  const b = motionBrowser(t, async () => {
    requests++;
    return "granted";
  });
  await b.controls.enable();
  b.sample();
  assert.equal(b.values.get(accessKey), "granted");
  b.controls.dispose();
  b.statuses.length = 0;
  await b.controls.restore();
  b.sample();
  assert.equal(requests, 2);
  assert.equal(b.statuses.at(-1), "active");
  assert.ok(!b.statuses.includes("requesting"));
});

test("denied access is not remembered across visits", async (t) => {
  let requests = 0;
  const b = motionBrowser(t, async () => {
    requests++;
    return "denied";
  });
  await b.controls.enable();
  assert.equal(b.statuses.at(-1), "denied");
  await b.controls.restore();
  assert.equal(requests, 1);
  assert.equal(b.values.has(accessKey), false);
});

test("expired grants return to the prompt and allow an explicit retry", async (t) => {
  let expired = true;
  const b = motionBrowser(t, async () => {
    if (expired)
      throw new DOMException("User activation required", "NotAllowedError");
    return "granted";
  });
  b.values.set(accessKey, "granted");
  await b.controls.restore();
  assert.equal(b.statuses.at(-1), "off");
  assert.equal(b.values.has(accessKey), false);
  expired = false;
  await b.controls.enable();
  b.sample();
  assert.equal(b.statuses.at(-1), "active");
});

test("browsers without a permission API remember access after a sensor reading", async (t) => {
  const b = motionBrowser(t);
  await b.controls.enable();
  assert.equal(b.values.has(accessKey), false);
  b.sample();
  assert.equal(b.values.get(accessKey), "granted");
});
