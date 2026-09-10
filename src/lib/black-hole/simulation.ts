import { OrbitCamera, type MotionPose } from "./orbit-camera";
import { OrbitControls } from "./orbit-controls";
import { BlackHoleRenderer } from "./renderer";
import type { SimulationSettings, ViewPreset } from "./model";

export interface SimulationStats {
  fps: number;
  frameMs: number;
  longestFrameMs: number;
  cpuMs: number;
  heapBytes: number | null;
  renderer: ReturnType<BlackHoleRenderer["getStats"]>;
}

/** Coordinates time, input and rendering; exposes a small API to the UI. */
export class BlackHoleSimulation {
  private readonly camera: OrbitCamera;
  private firstFrame = true;
  private readonly renderer: BlackHoleRenderer;
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private readonly events = new AbortController();
  private settings: SimulationSettings;
  private frame = 0;
  private lastTime = 0;
  private simulationTime = 0;
  private sampleTime = 0;
  private sampleFrames = 0;
  private cpuTime = 0;
  private longestFrame = 0;
  private width = 1;
  private height = 1;
  private disposed = false;
  private failed = false;

  constructor(
    canvas: HTMLCanvasElement,
    settings: SimulationSettings,
    private readonly onStats: (stats: SimulationStats) => void,
    private readonly onError: (message: string) => void,
    onInteract: () => void,
    private readonly onReady: () => void,
    animateEntrance = true,
  ) {
    this.camera = new OrbitCamera(animateEntrance ? 1.8 : 0);
    this.settings = { ...settings };
    this.renderer = new BlackHoleRenderer(canvas, this.camera);
    this.controls = new OrbitControls(canvas, this.camera, onInteract);
    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    try {
      this.resizeObserver.observe(canvas);
      this.resize(canvas);
    } catch (error) {
      // Construction can fail before the UI owns this instance. Release resources here.
      this.dispose();
      throw error;
    }
    const signal = this.events.signal;
    document.addEventListener(
      "visibilitychange",
      () => {
        cancelAnimationFrame(this.frame);
        this.lastTime = 0;
        this.sampleTime = 0;
        this.sampleFrames = 0;
        this.cpuTime = 0;
        this.longestFrame = 0;
        if (!document.hidden && !this.failed)
          this.frame = requestAnimationFrame(this.tick);
      },
      { signal },
    );
    canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        cancelAnimationFrame(this.frame);
        this.failed = true;
        onError(
          "The graphics connection was interrupted. Restart the simulation to reconnect.",
        );
      },
      { signal },
    );
    this.frame = requestAnimationFrame(this.tick);
  }

  update(settings: SimulationSettings) {
    this.settings = { ...settings };
    this.renderer.resize(this.width, this.height, this.settings);
  }

  setMotion(pose: MotionPose) {
    this.camera.setMotion(pose);
  }

  setView(view: ViewPreset) {
    this.camera.setView(view);
  }

  private resize(canvas: HTMLCanvasElement) {
    this.width = Math.max(1, Math.round(canvas.clientWidth));
    this.height = Math.max(1, Math.round(canvas.clientHeight));
    this.renderer.resize(this.width, this.height, this.settings);
  }

  private tick = (now: number) => {
    if (this.disposed || this.failed) return;
    const frameMs = this.lastTime ? now - this.lastTime : 0;
    const delta = this.lastTime
      ? Math.min((now - this.lastTime) / 1000, 0.1)
      : 0;
    this.lastTime = now;
    if (!this.settings.paused)
      this.simulationTime += delta * this.settings.speed;
    this.camera.update(delta, this.settings.autoOrbit && !this.settings.paused);
    const cpuStart = performance.now();
    try {
      this.renderer.render(this.simulationTime, this.settings);
      if (this.firstFrame) {
        this.firstFrame = false;
        this.onReady();
      }
    } catch (error) {
      this.failed = true;
      this.onError(
        error instanceof Error
          ? error.message
          : "The simulation could not render.",
      );
      return;
    }
    if (this.sampleTime) {
      this.sampleFrames++;
      this.cpuTime += performance.now() - cpuStart;
      this.longestFrame = Math.max(this.longestFrame, frameMs);
    } else this.sampleTime = now;
    const elapsed = now - this.sampleTime;
    if (elapsed >= 750 && this.sampleFrames > 0) {
      const memory = (
        performance as Performance & { memory?: { usedJSHeapSize: number } }
      ).memory;
      this.onStats({
        fps: Math.round((this.sampleFrames * 1000) / elapsed),
        frameMs: elapsed / this.sampleFrames,
        longestFrameMs: this.longestFrame,
        cpuMs: this.cpuTime / this.sampleFrames,
        heapBytes: memory?.usedJSHeapSize ?? null,
        renderer: this.renderer.getStats(),
      });
      this.sampleFrames = 0;
      this.cpuTime = 0;
      this.longestFrame = 0;
      this.sampleTime = now;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.events.abort();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
