import test from "node:test";
import assert from "node:assert/strict";
import { OrbitCamera } from "../src/lib/black-hole/orbit-camera.ts";

test("camera basis remains orthonormal after extreme orbit and zoom gestures", () => {
  const camera = new OrbitCamera();
  camera.orbit(100, 100);
  camera.zoom(-100);
  for (let i = 0; i < 120; i++) camera.update(1 / 60);
  for (const basis of [camera.forward, camera.right, camera.up]) {
    assert.ok(Math.abs(basis.length() - 1) < 1e-12);
  }
  assert.ok(Math.abs(camera.forward.dot(camera.up)) < 1e-12);
  assert.ok(Math.abs(camera.forward.dot(camera.right)) < 1e-12);
  assert.ok(Math.abs(camera.up.dot(camera.right)) < 1e-12);
  assert.ok(camera.forward.dot(camera.position.clone().normalize()) < -0.999);
  assert.ok(camera.distance >= 13);
});

test("camera damping produces the same pose at 30 Hz and 120 Hz", () => {
  const slow = new OrbitCamera();
  const fast = new OrbitCamera();
  for (const camera of [slow, fast]) {
    camera.orbit(0.8, 0.4);
    camera.zoom(0.2);
  }
  for (let i = 0; i < 30; i++) slow.update(1 / 30);
  for (let i = 0; i < 120; i++) fast.update(1 / 120);
  assert.ok(slow.position.distanceTo(fast.position) < 1e-10);
});

test("reset returns to the original view even after many revolutions", () => {
  const camera = new OrbitCamera();
  const initial = camera.position.clone();
  camera.orbit(Math.PI * 80, 1);
  camera.zoom(2);
  camera.update(10);
  camera.setView("cinematic");
  camera.update(10);
  assert.ok(camera.position.distanceTo(initial) < 1e-10);
});
