import test from "node:test";
import assert from "node:assert/strict";
import {
  constrainOrbit,
  renderSize,
  RAY_SAMPLES,
  RING_SAMPLES,
  DEFAULT_SETTINGS,
  VIEWS,
  DISK_OUTER_RADIUS,
} from "../src/lib/black-hole/model.ts";

test("extreme zoom and orbit input cannot enter the disk or reach a camera pole", () => {
  const near = constrainOrbit({ azimuth: 200, elevation: 10, distance: 0 });
  const far = constrainOrbit({ azimuth: -200, elevation: -10, distance: 1e6 });
  assert.ok(near.distance > DISK_OUTER_RADIUS);
  assert.ok(far.distance === 110);
  assert.ok(near.elevation < Math.PI / 2);
  assert.ok(far.elevation > -Math.PI / 2);
  assert.equal(near.azimuth, 200);
});

test("every camera preset stays in the safe observation volume", () => {
  for (const view of Object.values(VIEWS))
    assert.deepEqual(constrainOrbit(view), view);
});

test("resolution controls only pixel dimensions, with a quarter-resolution default", () => {
  assert.equal(DEFAULT_SETTINGS.resolution, 0.25);
  assert.deepEqual(renderSize(1280, 720, 1), { width: 1280, height: 720 });
  assert.deepEqual(renderSize(1280, 720, 0.25), { width: 320, height: 180 });
  assert.deepEqual(renderSize(1280, 720, 1.75), { width: 2240, height: 1260 });
  assert.equal(RAY_SAMPLES, 2);
  assert.equal(RING_SAMPLES, 16);
});

test("resolution grows monotonically while respecting allocation limits and aspect ratio", () => {
  let previousPixels = 0;
  for (let i = 0; i <= 100; i++) {
    const size = renderSize(3840, 2160, 0.25 + i * 0.015);
    assert.ok(size.width * size.height >= previousPixels);
    assert.ok(size.width * size.height <= 8388608);
    assert.ok(Math.abs(size.width / size.height - 16 / 9) < 0.01);
    previousPixels = size.width * size.height;
  }
});

test("invalid values and tiny containers produce safe render sizes", () => {
  assert.deepEqual(renderSize(0, 0, 0.25), { width: 1, height: 1 });
  assert.deepEqual(renderSize(NaN, Infinity, NaN), { width: 1, height: 1 });
  assert.deepEqual(renderSize(1280, 720, -1), renderSize(1280, 720, 0.25));
  assert.deepEqual(renderSize(1280, 720, 5), renderSize(1280, 720, 1.75));
  assert.deepEqual(renderSize(1280, 720, NaN), renderSize(1280, 720, 1));
});
