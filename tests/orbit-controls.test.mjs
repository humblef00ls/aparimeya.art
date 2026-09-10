import test from "node:test";
import assert from "node:assert/strict";
import { OrbitControls } from "../src/lib/black-hole/orbit-controls.ts";

function setup(t) {
  const previous = globalThis.window;
  globalThis.window = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    clientHeight: 800,
    focus() {},
    setPointerCapture() {},
  });
  const zooms = [],
    orbits = [];
  const controls = new OrbitControls(
    canvas,
    {
      zoom: (delta) => zooms.push(delta),
      orbit: (...delta) => orbits.push(delta),
    },
    () => {},
  );
  t.after(() => {
    controls.dispose();
    globalThis.window = previous;
  });
  function emit(type, properties = {}) {
    const event = Object.assign(
      new Event(type, { cancelable: true }),
      properties,
    );
    canvas.dispatchEvent(event);
    return event;
  }
  return { controls, emit, zooms, orbits };
}

test("trackpad pinch zooms both ways and prevents page zoom; scrolling keeps its sensitivity", (t) => {
  const { emit, zooms } = setup(t);
  for (const deltaY of [-10, 10]) {
    assert.ok(
      emit("wheel", { deltaY, deltaMode: 0, ctrlKey: true }).defaultPrevented,
    );
  }
  emit("wheel", { deltaY: 10, deltaMode: 0, ctrlKey: false });
  assert.deepEqual(zooms, [-0.1, 0.1, 0.01]);
});

test("Safari cumulative scales become incremental zoom without duplicate wheel zoom", (t) => {
  const { emit, zooms } = setup(t);
  emit("gesturestart", { scale: 1 });
  assert.ok(emit("gesturechange", { scale: 2 }).defaultPrevented);
  emit("wheel", { deltaY: -10, deltaMode: 0, ctrlKey: true });
  emit("gesturechange", { scale: 1 });
  emit("gestureend");
  emit("wheel", { deltaY: 10, deltaMode: 0 });
  assert.deepEqual(zooms, [Math.log(0.5), Math.log(2), 0.01]);
});

test("touch pinch handles both directions without also applying Safari gestures or orbiting", (t) => {
  const { emit, zooms, orbits } = setup(t);
  for (const [pointerId, clientX] of [
    [1, 0],
    [2, 100],
  ])
    emit("pointerdown", {
      pointerId,
      clientX,
      clientY: 0,
      pointerType: "touch",
    });
  emit("gesturestart", { scale: 1 });
  emit("pointermove", { pointerId: 2, clientX: 200, clientY: 0 });
  emit("gesturechange", { scale: 2 });
  emit("pointermove", { pointerId: 2, clientX: 100, clientY: 0 });
  assert.deepEqual(zooms, [Math.log(0.5), Math.log(2)]);
  assert.deepEqual(orbits, []);
});

test("invalid scales cannot corrupt zoom and blur resets interrupted gestures", (t) => {
  const { emit, zooms } = setup(t);
  emit("gesturestart", { scale: 1 });
  for (const scale of [0, -1, NaN, Infinity]) emit("gesturechange", { scale });
  globalThis.window.dispatchEvent(new Event("blur"));
  emit("gesturechange", { scale: 2 });
  emit("wheel", { deltaY: 10, deltaMode: 0 });
  assert.deepEqual(zooms, [0.01]);
});

test("disposal removes all zoom listeners", (t) => {
  const { controls, emit, zooms } = setup(t);
  controls.dispose();
  emit("gesturestart", { scale: 1 });
  emit("gesturechange", { scale: 2 });
  emit("wheel", { deltaY: 10, deltaMode: 0, ctrlKey: true });
  assert.deepEqual(zooms, []);
});
