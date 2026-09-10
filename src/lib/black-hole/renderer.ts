import {
  Color,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import {
  DISK_INNER_RADIUS,
  DISK_OUTER_RADIUS,
  renderSize,
  RAY_SAMPLES,
  RING_SAMPLES,
  type SimulationSettings,
} from "./model";
import { FILTERS } from "./filters";
import filterShader from "./shaders/filter.frag.glsl?raw";
import type { OrbitCamera } from "./orbit-camera";
import vertexShader from "./shaders/fullscreen.vert.glsl?raw";
import traceSource from "./shaders/trace.frag.glsl?raw";
import noise from "./shaders/noise.glsl?raw";
import disk from "./shaders/disk.glsl?raw";
import gridSource from "./shaders/grid.frag.glsl?raw";
import grid from "./shaders/grid.glsl?raw";
import effectsShader from "./shaders/effects.frag.glsl?raw";
import sky from "./shaders/sky.glsl?raw";
import prefilterShader from "./shaders/prefilter.frag.glsl?raw";
import bloomShader from "./shaders/bloom.frag.glsl?raw";
import compositeShader from "./shaders/composite.frag.glsl?raw";

/** Owns the GPU lifetime. Ray tracing, filtered bloom and display compositing. */
export class BlackHoleRenderer {
  private readonly gpu: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly grid: ShaderMaterial;
  private readonly gridImage: WebGLRenderTarget;
  private readonly trace: ShaderMaterial;
  private readonly prefilter: ShaderMaterial;
  private readonly bloomSource: WebGLRenderTarget;
  private readonly blur: ShaderMaterial;
  private readonly effects: ShaderMaterial;
  private readonly filter: ShaderMaterial;
  private readonly filterInput: WebGLRenderTarget;
  private readonly display: WebGLRenderTarget;
  private readonly composite: ShaderMaterial;
  private readonly quad: Mesh;
  private readonly image: WebGLRenderTarget;
  private readonly bloomHorizontal: WebGLRenderTarget;
  private readonly bloomVertical: WebGLRenderTarget;
  private width = 0;
  private height = 0;
  private renderWidth = 0;
  private renderHeight = 0;

  constructor(canvas: HTMLCanvasElement, camera: OrbitCamera) {
    this.gpu = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!this.gpu.extensions.has("EXT_color_buffer_float")) {
      this.gpu.dispose();
      throw new Error(
        "This simulation needs WebGL 2 with floating-point color buffers. Try a current browser with hardware acceleration enabled.",
      );
    }
    this.gpu.setPixelRatio(1);
    this.gpu.info.autoReset = false;
    this.gpu.debug.onShaderError = (gl, program, vertex, fragment) => {
      console.error(
        "Shader compilation failed",
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(vertex),
        gl.getShaderInfoLog(fragment),
      );
      throw new Error(
        "The graphics driver could not compile the simulation. Try another browser or update your graphics driver.",
      );
    };
    const target = () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
    this.image = target();
    this.image.texture.minFilter = NearestFilter;
    this.image.texture.magFilter = NearestFilter;
    this.gridImage = target();
    this.display = target();
    this.filterInput = target();
    this.filterInput.texture.minFilter = NearestFilter;
    this.filterInput.texture.magFilter = NearestFilter;
    this.bloomSource = target();
    this.bloomHorizontal = target();
    this.bloomVertical = target();
    this.trace = new ShaderMaterial({
      vertexShader,
      fragmentShader: traceSource
        .replace("/* NOISE */", noise)
        .replace("/* DISK */", disk)
        .replace("/* SKY */", sky),
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uResolution: { value: new Vector2(1, 1) },
        uTraceResolution: { value: new Vector2(1, 1) },
        uSamples: { value: RAY_SAMPLES },
        uRingSamples: { value: RING_SAMPLES },
        uCamera: { value: camera.position },
        uForward: { value: camera.forward },
        uRight: { value: camera.right },
        uUp: { value: camera.up },
        uTime: { value: 0 },
        uDiskColor: { value: new Color() },
        uDiskTexture: { value: 1 },
        uDiskScale: { value: 1 },
        uDiskBrightness: { value: 1 },
        uStarSize: { value: 1 },
        uStarVariation: { value: 0.7 },
        uStarDensity: { value: 1 },
        uLensing: { value: 1 },
        uDoppler: { value: 1 },
        uStars: { value: 1 },
        uDiskInner: { value: DISK_INNER_RADIUS },
        uDiskOuter: { value: DISK_OUTER_RADIUS },
        uFov: { value: Math.tan((42 * Math.PI) / 360) },
      },
    });
    this.grid = new ShaderMaterial({
      vertexShader,
      fragmentShader: gridSource.replace("/* GRID */", grid),
      depthTest: false,
      depthWrite: false,
      uniforms: Object.fromEntries(
        [
          "uResolution",
          "uTraceResolution",
          "uCamera",
          "uForward",
          "uRight",
          "uUp",
          "uFov",
        ].map((name) => [name, this.trace.uniforms[name]]),
      ),
    });
    this.prefilter = new ShaderMaterial({
      vertexShader,
      fragmentShader: prefilterShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSource: { value: this.image.texture },
        uTexel: { value: new Vector2(1, 1) },
      },
    });
    this.blur = new ShaderMaterial({
      vertexShader,
      fragmentShader: bloomShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSource: { value: this.image.texture },
        uDirection: { value: new Vector2() },
      },
    });
    this.composite = new ShaderMaterial({
      vertexShader,
      fragmentShader: compositeShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexel: { value: new Vector2(1, 1) },
        uScene: { value: this.image.texture },
        uGrid: { value: this.gridImage.texture },
        uGravityGrid: { value: 0 },
        uBloom: { value: this.bloomVertical.texture },
        uExposure: { value: 1 },
        uBloomStrength: { value: 0.5 },
      },
    });
    this.effects = new ShaderMaterial({
      vertexShader,
      fragmentShader: effectsShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSource: { value: this.display.texture },
        uResolution: { value: new Vector2(1, 1) },
        uEffect: { value: 1 },
        uSize: { value: 8 },
      },
    });
    this.filter = new ShaderMaterial({
      vertexShader,
      fragmentShader: filterShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSource: { value: this.filterInput.texture },
        uShadows: { value: new Color() },
        uMidtones: { value: new Color() },
        uHighlights: { value: new Color() },
      },
    });
    this.quad = new Mesh(this.geometry, this.trace);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  resize(width: number, height: number, settings: SimulationSettings) {
    const size = renderSize(width, height, settings.resolution);
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.gpu.setSize(width, height, false);
      // Keep the whole disk in frame on portrait displays.
      this.trace.uniforms.uFov.value =
        Math.tan((42 * Math.PI) / 360) * Math.max(1, height / width);
    }
    // Optional stages allocate full-size buffers only when needed.
    const needsDisplay =
      settings.postEffect !== "none" || settings.filter !== "none";
    const needsFilterInput =
      settings.postEffect !== "none" && settings.filter !== "none";
    this.filterInput.setSize(
      needsFilterInput ? width : 1,
      needsFilterInput ? height : 1,
    );
    this.display.setSize(needsDisplay ? width : 1, needsDisplay ? height : 1);
    this.gridImage.setSize(
      settings.gravityGrid ? size.width : 1,
      settings.gravityGrid ? size.height : 1,
    );
    this.effects.uniforms.uResolution.value.set(width, height);
    this.trace.uniforms.uResolution.value.set(width, height);
    // Keep glow radius in display pixels; resolution must not inflate the optical effect.
    this.prefilter.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.bloomHorizontal.setSize(
      Math.max(1, Math.floor(width / 2)),
      Math.max(1, Math.floor(height / 2)),
    );
    this.bloomSource.setSize(
      this.bloomHorizontal.width,
      this.bloomHorizontal.height,
    );
    this.bloomVertical.setSize(
      this.bloomHorizontal.width,
      this.bloomHorizontal.height,
    );
    if (this.renderWidth === size.width && this.renderHeight === size.height)
      return;
    this.renderWidth = size.width;
    this.renderHeight = size.height;
    this.image.setSize(size.width, size.height);
    this.composite.uniforms.uTexel.value.set(1 / size.width, 1 / size.height);
    this.trace.uniforms.uTraceResolution.value.set(size.width, size.height);
  }

  render(time: number, settings: SimulationSettings) {
    this.gpu.info.reset();
    this.trace.uniforms.uTime.value = time;
    this.trace.uniforms.uDiskColor.value.set(settings.diskColor);
    this.trace.uniforms.uDiskTexture.value = settings.diskTexture;
    this.trace.uniforms.uDiskScale.value = settings.diskScale;
    this.trace.uniforms.uDiskBrightness.value = settings.diskBrightness;
    this.trace.uniforms.uStarSize.value = settings.starSize;
    this.trace.uniforms.uStarVariation.value = settings.starVariation;
    this.trace.uniforms.uStarDensity.value = settings.starDensity;
    this.composite.uniforms.uGravityGrid.value = Number(settings.gravityGrid);
    this.trace.uniforms.uLensing.value = Number(settings.lensing);
    this.trace.uniforms.uDoppler.value = Number(settings.doppler);
    this.trace.uniforms.uStars.value = Number(settings.stars);
    this.pass(this.trace, this.image);
    if (settings.gravityGrid) this.pass(this.grid, this.gridImage);
    if (settings.bloom > 0) {
      this.pass(this.prefilter, this.bloomSource);
      this.blur.uniforms.uSource.value = this.bloomSource.texture;
      this.blur.uniforms.uDirection.value.set(
        1 / this.bloomHorizontal.width,
        0,
      );
      this.pass(this.blur, this.bloomHorizontal);
      this.blur.uniforms.uSource.value = this.bloomHorizontal.texture;
      this.blur.uniforms.uDirection.value.set(0, 1 / this.bloomVertical.height);
      this.pass(this.blur, this.bloomVertical);
    }
    this.composite.uniforms.uExposure.value = settings.exposure;
    this.composite.uniforms.uBloomStrength.value = settings.bloom;
    const hasFilter = settings.filter !== "none";
    if (settings.postEffect === "none")
      this.pass(this.composite, hasFilter ? this.display : null);
    else {
      this.pass(this.composite, this.display);
      this.effects.uniforms.uEffect.value =
        settings.postEffect === "ascii" ? 1 : 2;
      this.effects.uniforms.uSize.value =
        settings.postEffect === "ascii"
          ? settings.asciiSize
          : settings.ditherSize;
      this.pass(this.effects, hasFilter ? this.filterInput : null);
    }
    if (hasFilter) {
      const colors = FILTERS[settings.filter].colors;
      // Palettes are authored in display space, matching the preceding composite.
      ["uShadows", "uMidtones", "uHighlights"].forEach((name, index) => {
        this.filter.uniforms[name].value
          .set(colors[index])
          .convertLinearToSRGB();
      });
      this.filter.uniforms.uSource.value =
        settings.postEffect === "none"
          ? this.display.texture
          : this.filterInput.texture;
      this.pass(this.filter, null);
    }
  }

  private pass(material: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = material;
    this.gpu.setRenderTarget(target);
    this.gpu.render(this.scene, this.screenCamera);
  }

  getStats() {
    // RGBA16F uses eight bytes per texel. This excludes driver overhead and the display buffer.
    const targetBytes = [
      this.image,
      this.gridImage,
      this.display,
      this.filterInput,
      this.bloomSource,
      this.bloomHorizontal,
      this.bloomVertical,
    ].reduce((bytes, target) => bytes + target.width * target.height * 8, 0);
    return {
      renderWidth: this.renderWidth,
      renderHeight: this.renderHeight,
      displayWidth: this.width,
      displayHeight: this.height,
      samples: this.trace.uniforms.uSamples.value as number,
      maxSamples:
        this.trace.uniforms.uLensing.value > 0.5
          ? (this.trace.uniforms.uRingSamples.value as number)
          : (this.trace.uniforms.uSamples.value as number),
      drawCalls: this.gpu.info.render.calls,
      textures: this.gpu.info.memory.textures,
      targetBytes,
    };
  }

  dispose() {
    this.image.dispose();
    this.gridImage.dispose();
    this.grid.dispose();
    this.display.dispose();
    this.effects.dispose();
    this.filter.dispose();
    this.filterInput.dispose();
    this.bloomSource.dispose();
    this.prefilter.dispose();
    this.bloomHorizontal.dispose();
    this.bloomVertical.dispose();
    this.trace.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.geometry.dispose();
    this.gpu.dispose();
  }
}
