import type { OrbitCamera } from "./orbit-camera";

/** Pointer capture makes drag/release reliable outside the canvas; two pointers pinch. */
export class OrbitControls {
  private readonly events = new AbortController();
  private gestureScale: number | undefined;
  private readonly pointers = new Map<number, { x: number; y: number }>();

  constructor(
    canvas: HTMLCanvasElement,
    camera: OrbitCamera,
    onInteract: () => void,
  ) {
    const signal = this.events.signal;
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        onInteract();
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      },
      { signal },
    );

    canvas.addEventListener(
      "pointermove",
      (event) => {
        const previous = this.pointers.get(event.pointerId);
        if (!previous) return;
        const current = { x: event.clientX, y: event.clientY };
        if (this.pointers.size === 1) {
          camera.orbit(
            (current.x - previous.x) * 0.005,
            (current.y - previous.y) * 0.005,
          );
        } else {
          const other = [...this.pointers.entries()].find(
            ([id]) => id !== event.pointerId,
          )?.[1];
          if (other) {
            const before = Math.hypot(
              previous.x - other.x,
              previous.y - other.y,
            );
            const after = Math.hypot(current.x - other.x, current.y - other.y);
            if (before > 1 && after > 1) camera.zoom(Math.log(before / after));
          }
        }
        this.pointers.set(event.pointerId, current);
      },
      { signal },
    );

    for (const type of [
      "pointerup",
      "pointercancel",
      "lostpointercapture",
    ] as const) {
      canvas.addEventListener(
        type,
        (event) => this.pointers.delete(event.pointerId),
        { signal },
      );
    }
    window.addEventListener(
      "blur",
      () => {
        this.pointers.clear();
        this.gestureScale = undefined;
      },
      { signal },
    );

    // Safari sends cumulative gesture scales instead of Chromium's Ctrl+wheel pinch.
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      canvas.addEventListener(
        type,
        (event) => {
          event.preventDefault();
          if (type === "gestureend") {
            this.gestureScale = undefined;
            return;
          }
          const scale = (event as Event & { scale: number }).scale;
          if (!Number.isFinite(scale) || scale <= 0) return;
          if (type === "gesturestart") {
            this.gestureScale = scale;
            onInteract();
            return;
          }
          if (this.gestureScale === undefined) return;
          // On touch screens, pointer events already handle the same physical pinch.
          if (this.pointers.size < 2)
            camera.zoom(Math.log(this.gestureScale / scale));
          this.gestureScale = scale;
        },
        { passive: false, signal },
      );
    }
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        if (this.gestureScale !== undefined || this.pointers.size >= 2) return;
        onInteract();
        const pixels =
          event.deltaY *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? canvas.clientHeight
              : 1);
        // Trackpad pinch deltas are much smaller than ordinary scroll deltas.
        const sensitivity = event.ctrlKey ? 0.01 : 0.001;
        camera.zoom(Math.max(-0.3, Math.min(0.3, pixels * sensitivity)));
      },
      { passive: false, signal },
    );

    canvas.addEventListener(
      "keydown",
      (event) => {
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-0.08, 0],
          ArrowRight: [0.08, 0],
          ArrowUp: [0, 0.08],
          ArrowDown: [0, -0.08],
        };
        const direction = directions[event.key];
        if (direction) camera.orbit(...direction);
        else if (event.key === "+" || event.key === "=") camera.zoom(-0.12);
        else if (event.key === "-") camera.zoom(0.12);
        else if (event.key.toLowerCase() === "r") camera.setView("cinematic");
        else return;
        event.preventDefault();
        onInteract();
      },
      { signal },
    );
  }

  dispose() {
    this.events.abort();
    this.gestureScale = undefined;
    this.pointers.clear();
  }
}
