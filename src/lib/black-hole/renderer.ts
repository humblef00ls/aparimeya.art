import type { OrbitCamera } from "./orbit-camera";
import {
  renderSize,
  RAY_SAMPLES,
  RING_SAMPLES,
  type SimulationSettings,
} from "./model";
import { FrameUniforms } from "./gpu/uniforms";
import { RenderTarget } from "./gpu/target";
import { FullscreenPass } from "./gpu/pass";
import common from "./shaders/common.wgsl?raw";
import noise from "./shaders/noise.wgsl?raw";
import disk from "./shaders/disk.wgsl?raw";
import sky from "./shaders/sky.wgsl?raw";
import trace from "./shaders/trace.wgsl?raw";
import grid from "./shaders/grid.wgsl?raw";
import post from "./shaders/post.wgsl?raw";

type Stage =
  | "trace"
  | "grid"
  | "prefilter"
  | "horizontal"
  | "vertical"
  | "composite"
  | "effects"
  | "gradientMap";
type Target =
  | "image"
  | "grid"
  | "display"
  | "filterInput"
  | "bloomSource"
  | "bloomHorizontal"
  | "bloomVertical";

/** Direct WebGPU: explicit passes and resource ownership, no graphics framework. */
export class BlackHoleRenderer {
  private readonly uniforms = new FrameUniforms();
  private readonly targets: Record<Target, RenderTarget>;
  private readonly dummy: RenderTarget;
  private readonly passes = new Map<string, FullscreenPass>();
  private width = 0;
  private height = 0;
  private renderWidth = 1;
  private renderHeight = 1;
  private drawCalls = 0;
  private disposed = false;
  private lensing = true;
  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: OrbitCamera,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly format: GPUTextureFormat,
  ) {
    this.targets = Object.fromEntries(
      [
        "image",
        "grid",
        "display",
        "filterInput",
        "bloomSource",
        "bloomHorizontal",
        "bloomVertical",
      ].map((name) => [name, new RenderTarget(device, name)]),
    ) as Record<Target, RenderTarget>;
    this.dummy = new RenderTarget(device, "Unused input");
  }

  static async create(
    canvas: HTMLCanvasElement,
    camera: OrbitCamera,
    onError: (message: string) => void = () => {},
  ) {
    if (!navigator.gpu)
      throw new Error(
        "This simulation requires WebGPU. Open it in a browser with WebGPU enabled.",
      );
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter)
      throw new Error("No WebGPU adapter is available on this device.");
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
      },
    });
    const context = canvas.getContext("webgpu");
    if (!context) {
      device.destroy();
      throw new Error("The browser could not create a WebGPU canvas.");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "opaque",
      colorSpace: "srgb",
    });
    const renderer = new BlackHoleRenderer(
      canvas,
      camera,
      device,
      context,
      format,
    );
    device.addEventListener("uncapturederror", (event) => {
      if (!renderer.disposed) onError(event.error.message);
    });
    void device.lost.then((info) => {
      if (!renderer.disposed)
        onError(
          `The graphics connection was interrupted (${info.reason}). Restart the simulation to reconnect.`,
        );
    });
    try {
      await renderer.initialize();
      return renderer;
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  private async initialize() {
    const device = this.device;
    const layout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        ...[2, 3, 4].map((binding) => ({
          binding,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" as const },
        })),
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [layout],
    });
    const nearest = device.createSampler({
      minFilter: "nearest",
      magFilter: "nearest",
    });
    const linear = device.createSampler({
      minFilter: "linear",
      magFilter: "linear",
    });
    const modules: Record<string, GPUShaderModule> = {};
    for (const [name, source] of Object.entries({
      trace: [noise, disk, sky, trace].join("\n"),
      grid,
      post,
    })) {
      const module = device.createShaderModule({
        label: name,
        code: common + "\n" + source,
      });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === "error");
      if (errors.length)
        throw new Error(
          `${name} shader: ${errors.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join("\n")}`,
        );
      modules[name] = module;
    }
    const stages: Stage[] = [
      "trace",
      "grid",
      "prefilter",
      "horizontal",
      "vertical",
      "composite",
      "effects",
      "gradientMap",
    ];
    const results = await Promise.allSettled(
      stages.map(async (stage) => {
        const module =
          modules[stage === "trace" || stage === "grid" ? stage : "post"];
        const entryPoint =
          stage === "trace" || stage === "grid"
            ? "main"
            : stage === "horizontal" || stage === "vertical"
              ? "blur"
              : stage;
        const formats: GPUTextureFormat[] =
          stage === "composite" ||
          stage === "effects" ||
          stage === "gradientMap"
            ? ["rgba16float", this.format]
            : ["rgba16float"];
        for (const format of formats) {
          const pipeline = await device.createRenderPipelineAsync({
            label: `${stage} → ${format}`,
            layout: pipelineLayout,
            vertex: { module, entryPoint: "vertexMain" },
            fragment: {
              module,
              entryPoint,
              targets: [{ format }],
              constants:
                stage === "trace"
                  ? { raySamples: RAY_SAMPLES, ringSamples: RING_SAMPLES }
                  : undefined,
            },
            primitive: { topology: "triangle-list" },
          });
          const sampler =
            stage === "prefilter" ||
            stage === "composite" ||
            stage === "gradientMap"
              ? nearest
              : linear;
          this.passes.set(
            `${stage}:${format}`,
            new FullscreenPass(device, layout, [sampler, linear], pipeline),
          );
        }
      }),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw failure.reason;
  }

  resize(width: number, height: number, settings: SimulationSettings) {
    if (this.disposed) return;
    const size = renderSize(width, height, settings.resolution);
    if (
      Math.max(width, height, size.width, size.height) >
      this.device.limits.maxTextureDimension2D
    )
      throw new Error(
        "The requested render dimensions exceed this device’s WebGPU texture limit.",
      );
    if (width !== this.width || height !== this.height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.width = width;
    this.height = height;
    this.renderWidth = size.width;
    this.renderHeight = size.height;
    const t = this.targets;
    t.image.resize(size.width, size.height);
    t.grid.resize(
      settings.gravityGrid ? size.width : 1,
      settings.gravityGrid ? size.height : 1,
    );
    const display =
      settings.postEffect !== "none" || settings.filter !== "none";
    t.display.resize(display ? width : 1, display ? height : 1);
    const filterInput =
      settings.postEffect !== "none" && settings.filter !== "none";
    t.filterInput.resize(filterInput ? width : 1, filterInput ? height : 1);
    for (const target of [t.bloomSource, t.bloomHorizontal, t.bloomVertical])
      target.resize(
        Math.max(1, Math.floor(width / 2)),
        Math.max(1, Math.floor(height / 2)),
      );
  }

  render(time: number, settings: SimulationSettings) {
    if (this.disposed) return;
    this.lensing = settings.lensing;
    this.drawCalls = 0;
    this.uniforms.update(
      this.camera,
      settings,
      this.width,
      this.height,
      this.renderWidth,
      this.renderHeight,
      time,
    );
    const data = this.uniforms.data,
      t = this.targets;
    const encoder = this.device.createCommandEncoder({
      label: "Black hole frame",
    });
    const screen = this.context.getCurrentTexture().createView();
    const pass = (
      stage: Stage,
      target: RenderTarget | null,
      source = this.dummy,
      grid = this.dummy,
      bloom = this.dummy,
    ) => {
      this.passes
        .get(`${stage}:${target ? "rgba16float" : this.format}`)!
        .draw(encoder, target?.view ?? screen, data, [
          source.view,
          grid.view,
          bloom.view,
        ]);
      this.drawCalls++;
    };
    pass("trace", t.image);
    if (settings.gravityGrid) pass("grid", t.grid);
    if (settings.bloom > 0) {
      pass("prefilter", t.bloomSource, t.image);
      this.uniforms.setBlurDirection(1 / t.bloomHorizontal.width, 0);
      pass("horizontal", t.bloomHorizontal, t.bloomSource);
      this.uniforms.setBlurDirection(0, 1 / t.bloomVertical.height);
      pass("vertical", t.bloomVertical, t.bloomHorizontal);
    }
    const effect = settings.postEffect !== "none",
      filter = settings.filter !== "none";
    pass(
      "composite",
      effect || filter ? t.display : null,
      t.image,
      settings.gravityGrid ? t.grid : this.dummy,
      settings.bloom > 0 ? t.bloomVertical : this.dummy,
    );
    if (effect) pass("effects", filter ? t.filterInput : null, t.display);
    if (filter) pass("gradientMap", null, effect ? t.filterInput : t.display);
    this.device.queue.submit([encoder.finish()]);
  }

  /** Used by the benchmark to distinguish submission from completed GPU work. */
  waitForIdle() {
    return this.device.queue.onSubmittedWorkDone();
  }
  getStats() {
    return {
      renderWidth: this.renderWidth,
      renderHeight: this.renderHeight,
      displayWidth: this.width,
      displayHeight: this.height,
      samples: RAY_SAMPLES,
      maxSamples: this.lensing ? RING_SAMPLES : RAY_SAMPLES,
      drawCalls: this.drawCalls,
      textures: Object.values(this.targets).length + 1,
      targetBytes:
        Object.values(this.targets).reduce((sum, t) => sum + t.bytes, 0) +
        this.dummy.bytes,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.passes.forEach((pass) => pass.dispose());
    this.passes.clear();
    Object.values(this.targets).forEach((target) => target.dispose());
    this.dummy.dispose();
    this.context.unconfigure();
    this.device.destroy();
  }
}
