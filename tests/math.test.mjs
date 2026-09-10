import assert from "node:assert/strict";
import test from "node:test";
import { Vector3, Quaternion, hexColor } from "../src/lib/black-hole/math.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("camera rotations follow the right-hand rule and preserve vector length", () => {
  const v = new Vector3(1, 0, 0).applyAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2,
  );
  near(v.x, 0);
  near(v.y, 0);
  near(v.z, -1);
  near(v.length(), 1);
  const zero = new Vector3().normalize();
  assert.deepEqual([zero.x, zero.y, zero.z], [0, 0, 0]);
});

test("composed unit rotation and its inverse restore an arbitrary vector", () => {
  const q = new Quaternion().setFromYXZ(0.7, -1.2, 0.3);
  const original = new Vector3(2, -3, 5);
  const restored = original
    .clone()
    .applyQuaternion(q)
    .applyQuaternion(q.clone().invert());
  near(restored.distanceTo(original), 0);
  const identity = q.clone().multiply(q.clone().invert());
  near(identity.x, 0);
  near(identity.y, 0);
  near(identity.z, 0);
  near(identity.w, 1);
});

test("disk colors use linear light while final gradient colors remain display RGB", () => {
  const display = hexColor("#808080");
  const linear = hexColor("#808080", true);
  for (const channel of display) near(channel, 128 / 255);
  for (const channel of linear) near(channel, 0.21586050011389926);
  assert.deepEqual(hexColor("#000000", true), [0, 0, 0]);
  assert.deepEqual(hexColor("#ffffff", true), [1, 1, 1]);
  near(hexColor("#0a0000", true)[0], 10 / 255 / 12.92);
});
