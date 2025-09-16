<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    RayTracer,
    PerspectiveCamera,
    Vector3,
    type RenderSettings,
  } from "$lib/engine";

  let canvas: HTMLCanvasElement;
  let bufferViewerCanvas: HTMLCanvasElement;
  let raytracer: RayTracer;
  let camera: PerspectiveCamera;
  let bufferViewerReady = false;
  let bufferViewerPipeline: GPURenderPipeline;
  let bufferViewerBindGroup: GPUBindGroup;
  let previousFrameTexture: GPUTexture;
  let previousFrameTextureView: GPUTextureView;
  let currentFrameTexture: GPUTexture;
  let currentFrameTextureView: GPUTextureView;
  let frameBufferIndex = 0;
  let animationFrame: number;
  let cleanupInputHandlers: (() => void) | undefined;
  let cleanupResizeHandler: (() => void) | undefined;

  // Camera movement state
  let keys = new Set<string>();
  let mouseX = 0;
  let mouseY = 0;
  let isMouseDown = false;

  // Performance monitoring
  let fps = 0;
  let frameCount = 0;
  let lastTime = 0;
  let currentAspect = 0;
  let currentPosition = { x: 0, y: 0, z: 0 };
  let memoryInfo = { used: 0, total: 0, available: 0 };

  // Temporal accumulation
  let temporalFrameCount = 0;
  let cameraMoved = false;

  // Performance history for graphs - sample every 10 seconds
  let fpsHistory: number[] = Array(150).fill(0);
  let timeHistory: number[] = Array(150).fill(0);
  let memoryHistory: number[] = Array(150).fill(0);
  let lastSampleTime = 0;

  // Camera rotation tracking for reactive updates
  let currentPitch = 0;
  let currentYaw = 0;

  // Camera settings
  let fovDegrees = 60; // Default FOV in degrees (within 10-120 range)

  // Resolution control for performance
  let renderScale = 0.5; // Render at 50% of display resolution
  let renderWidth = 0;
  let renderHeight = 0;
  let displayWidth = 0;
  let displayHeight = 0;

  // Ray tracing settings
  let maxBounces = 10; // Default max bounces (1-25 range)
  let raysPerPixel = 20; // Default rays per pixel (1-16 range) - increased to reduce artifacts

  onMount(async () => {
    if (!navigator.gpu) {
      console.error("WebGPU not supported");
      return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("No GPU adapter found");
      return;
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();

    // Get canvas dimensions for proper aspect ratio
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const aspectRatio = canvasWidth / canvasHeight;

    // Calculate render and display dimensions
    displayWidth = canvasWidth;
    displayHeight = canvasHeight;
    renderWidth = Math.floor(canvasWidth * renderScale);
    renderHeight = Math.floor(canvasHeight * renderScale);

    // Create camera with proper parameters
    camera = new PerspectiveCamera({
      position: new Vector3(0, 3, -8),
      target: new Vector3(0, 0, 0),
      up: Vector3.up(),
      fov: (fovDegrees * Math.PI) / 180, // Convert degrees to radians
      aspect: aspectRatio,
      near: 0.1,
      far: 1000,
    });

    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });

    // Create render settings
    const renderSettings: RenderSettings = {
      renderWidth,
      renderHeight,
      displayWidth,
      displayHeight,
      maxBounces,
      raysPerPixel,
    };

    // Create and use our ray tracer with camera data and render settings
    raytracer = new RayTracer(device, context, format, camera, renderSettings);

    // Start render loop
    startRenderLoop();

    // Setup buffer viewer canvas after a short delay to ensure DOM is ready
    setTimeout(() => {
      console.log("Setting up buffer viewer...");
      setupBufferViewer(device, format);
      console.log("Buffer viewer setup complete");
    }, 100);

    // Setup input handlers
    setupInputHandlers();

    // Setup resize handler
    setupResizeHandler();

    // Initialize slider progress
    setTimeout(() => {
      const fovSlider = document.getElementById(
        "fov-input",
      ) as HTMLInputElement;
      const scaleSlider = document.getElementById(
        "scale-input",
      ) as HTMLInputElement;
      const bouncesSlider = document.getElementById(
        "bounces-input",
      ) as HTMLInputElement;
      const raysSlider = document.getElementById(
        "rays-input",
      ) as HTMLInputElement;
      if (fovSlider) {
        updateSliderProgress({ target: fovSlider } as unknown as Event);
      }
      if (scaleSlider) {
        updateSliderProgress({ target: scaleSlider } as unknown as Event);
      }
      if (bouncesSlider) {
        updateSliderProgress({ target: bouncesSlider } as unknown as Event);
      }
      if (raysSlider) {
        updateSliderProgress({ target: raysSlider } as unknown as Event);
      }
    }, 100);
  });

  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (cleanupInputHandlers) {
      cleanupInputHandlers();
    }
    if (cleanupResizeHandler) {
      cleanupResizeHandler();
    }
  });

  function setupBufferViewer(device: GPUDevice, format: GPUTextureFormat) {
    if (!bufferViewerCanvas) return;

    const bufferContext = bufferViewerCanvas.getContext(
      "webgpu",
    ) as unknown as GPUCanvasContext;
    bufferContext.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });

    // Set canvas size to match the display dimensions
    bufferViewerCanvas.width = 200;
    bufferViewerCanvas.height = 150;

    // Create both frame textures for double buffering
    previousFrameTexture = device.createTexture({
      size: { width: 200, height: 150, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    previousFrameTextureView = previousFrameTexture.createView();

    currentFrameTexture = device.createTexture({
      size: { width: 200, height: 150, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    currentFrameTextureView = currentFrameTexture.createView();

    // Create a simple render pipeline for the buffer viewer
    const shaderModule = device.createShaderModule({
      label: "Buffer viewer shader",
      code: `
        @group(0) @binding(0) var inputTexture: texture_2d<f32>;
        @group(0) @binding(1) var inputSampler: sampler;
        @group(0) @binding(2) var previousFrameTexture: texture_2d<f32>;

        @vertex
        fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
          var pos = array<vec2f, 6>(
            vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
            vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1)
          );
          return vec4f(pos[vertexIndex], 0, 1);
        }

        @fragment
        fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
          let uv = vec2f(position.xy) / vec2f(200, 150);
          
          // Sample current frame (new render)
          let currentFrame = textureSample(inputTexture, inputSampler, uv);
          
          // Sample previous frame (accumulated result)
          let previousFrame = textureSample(previousFrameTexture, inputSampler, uv);
          
          // Blend: add 10% of current light to previous frame
          // Only accumulate light, not darkness
          let blendedColor = previousFrame.rgb;
          
          // For each color channel, only add light if current > previous
          let r = select(previousFrame.r, previousFrame.r + 0.1 * currentFrame.r, currentFrame.r > previousFrame.r);
          let g = select(previousFrame.g, previousFrame.g + 0.1 * currentFrame.g, currentFrame.g > previousFrame.g);
          let b = select(previousFrame.b, previousFrame.b + 0.1 * currentFrame.b, currentFrame.b > previousFrame.b);
          
          return vec4f(r, g, b, 1.0);
        }
      `,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    bufferViewerPipeline = device.createRenderPipeline({
      label: "Buffer viewer pipeline",
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: format,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    // Create bind group
    bufferViewerBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: raytracer.getLastFrameBuffer().createView(),
        },
        {
          binding: 1,
          resource: device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
          }),
        },
        {
          binding: 2,
          resource: previousFrameTextureView,
        },
      ],
    });

    // Mark buffer viewer as ready
    bufferViewerReady = true;
  }

  function renderBufferViewer() {
    if (
      !raytracer ||
      !bufferViewerCanvas ||
      !bufferViewerReady ||
      !bufferViewerPipeline ||
      !bufferViewerBindGroup
    )
      return;

    // Get the lastFrameBuffer from the raytracer
    const lastFrameBuffer = raytracer.getLastFrameBuffer();

    // Update the bind group with the current frame buffer
    const device = raytracer.getDevice();
    const context = bufferViewerCanvas.getContext(
      "webgpu",
    ) as unknown as GPUCanvasContext;

    // Create a new bind group with the current frame buffer and previous frame
    const currentBindGroup = device.createBindGroup({
      layout: bufferViewerPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: lastFrameBuffer.createView(),
        },
        {
          binding: 1,
          resource: device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
          }),
        },
        {
          binding: 2,
          resource:
            frameBufferIndex === 0
              ? previousFrameTextureView
              : currentFrameTextureView,
        },
      ],
    });

    // Render using the pipeline
    const commandEncoder = device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(bufferViewerPipeline);
    renderPass.setBindGroup(0, currentBindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    // Submit the render command
    device.queue.submit([commandEncoder.finish()]);

    // Swap frame buffers for next frame
    frameBufferIndex = 1 - frameBufferIndex;
  }

  function startRenderLoop() {
    function render(currentTime: number) {
      // Calculate FPS
      if (lastTime === 0) {
        lastTime = currentTime;
      }

      frameCount++;
      if (currentTime - lastTime >= 1000) {
        // Update every second
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;

        // Update performance data
        if (camera) {
          currentAspect = Math.round(camera.getAspect() * 100) / 100;
        }

        // Get memory info if available
        if ("memory" in performance) {
          const mem = (performance as any).memory;
          memoryInfo = {
            used: Math.round(mem.usedJSHeapSize / 1024 / 1024),
            total: Math.round(mem.totalJSHeapSize / 1024 / 1024),
            available: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
          };
        } else {
          // Fallback: use a simulated memory value for testing
          memoryInfo.used = Math.floor(Math.random() * 15) + 5; // 5-20 MB
        }

        // Update performance history for graphs every 5 seconds
        const timePerFrame = fps > 0 ? 1000 / fps : 0;
        const sampleTime = Date.now();
        if (sampleTime - lastSampleTime >= 5000) {
          updatePerformanceHistory(fps, timePerFrame, memoryInfo.used);
          lastSampleTime = sampleTime;
        }
      }

      updateCamera();
      raytracer.render(temporalFrameCount);
      temporalFrameCount++; // Increment for temporal accumulation

      // Render the debug buffer viewer
      renderBufferViewer();

      animationFrame = requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  function resetTemporalAccumulation() {
    if (raytracer) {
      raytracer.resetTemporalAccumulation();
    }
    // Reset the frame count in the scene component
    temporalFrameCount = 0;
  }

  function updateFOV() {
    if (camera) {
      const fovRadians = (fovDegrees * Math.PI) / 180;
      camera.setFOV(fovRadians);
      resetTemporalAccumulation();
    }
  }

  function updateRenderScale() {
    if (!raytracer || !canvas) return;

    // Calculate new render dimensions while maintaining exact aspect ratio
    const targetPixels = Math.floor(displayWidth * displayHeight * renderScale);
    const aspectRatio = displayWidth / displayHeight;

    // Calculate dimensions that maintain the exact aspect ratio
    renderHeight = Math.floor(Math.sqrt(targetPixels / aspectRatio));
    renderWidth = Math.floor(renderHeight * aspectRatio);

    // Update raytracer with new render settings
    const renderSettings: RenderSettings = {
      renderWidth,
      renderHeight,
      displayWidth,
      displayHeight,
      maxBounces,
      raysPerPixel,
    };

    raytracer.updateRenderSettings(renderSettings);
    resetTemporalAccumulation();
  }

  function updateSliderProgress(event: Event) {
    const slider = event.target as HTMLInputElement;
    const value = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.setProperty("--range-progress", percentage + "%");
  }

  function updateMaxBounces() {
    if (raytracer) {
      const renderSettings: RenderSettings = {
        renderWidth,
        renderHeight,
        displayWidth,
        displayHeight,
        maxBounces,
        raysPerPixel,
      };
      raytracer.updateRenderSettings(renderSettings);
      resetTemporalAccumulation();
    }
  }

  function updateRaysPerPixel() {
    if (raytracer) {
      const renderSettings: RenderSettings = {
        renderWidth,
        renderHeight,
        displayWidth,
        displayHeight,
        maxBounces,
        raysPerPixel,
      };
      raytracer.updateRenderSettings(renderSettings);
      resetTemporalAccumulation();
    }
  }

  function updatePerformanceHistory(
    fps: number,
    timePerFrame: number,
    memoryUsed: number,
  ) {
    // Shift arrays and add new values
    fpsHistory.shift();
    fpsHistory.push(fps);

    timeHistory.shift();
    timeHistory.push(timePerFrame);

    memoryHistory.shift();
    memoryHistory.push(memoryUsed);
  }

  function updateCamera() {
    if (!camera) return;

    const moveSpeed = 0.05; // Reduced from 0.1 for less sensitive movement
    const rotateSpeed = 0.005; // Increased from 0.001 for more sensitive rotation
    const shiftMultiplier = 4; // Increased from 3 for stronger shift effect

    // Check if Shift is held
    const isShiftHeld = keys.has("shift");

    // Handle keyboard movement
    if (keys.has("w")) {
      const forward = camera.getForward();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().add(forward.mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("s")) {
      const forward = camera.getForward();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(forward.mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("a")) {
      const right = camera.getRight();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(right.mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("d")) {
      const right = camera.getRight();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().add(right.mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("q")) {
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().add(Vector3.up().mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("e")) {
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(Vector3.up().mul(speed)));
      cameraMoved = true;
    }
    if (keys.has("r")) {
      camera.resetRotation();
    }

    // Handle arrow key rotation
    if (keys.has("arrowup")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateX(-speed);
      cameraMoved = true;
    }
    if (keys.has("arrowdown")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateX(speed);
      cameraMoved = true;
    }
    if (keys.has("arrowleft")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateY(speed);
      cameraMoved = true;
    }
    if (keys.has("arrowright")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateY(-speed);
      cameraMoved = true;
    }

    // Update reactive variables for real-time display
    const pos = camera.getPosition();
    currentPosition = {
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100,
      z: Math.round(pos.z * 100) / 100,
    };

    // Handle mouse rotation
    if (isMouseDown && (mouseX !== 0 || mouseY !== 0)) {
      camera.rotateY(mouseX * rotateSpeed * 0.5); // Reduced mouse sensitivity
      camera.rotateX(-mouseY * rotateSpeed * 0.5); // Reduced mouse sensitivity

      mouseX = 0;
      mouseY = 0;
      cameraMoved = true;
    }

    // Reset temporal accumulation if camera moved
    if (cameraMoved) {
      resetTemporalAccumulation();
      cameraMoved = false;
    }

    // Always update rotation display variables (for both mouse and arrow key changes)
    currentPitch = camera.getPitch();
    currentYaw = camera.getYaw();
  }

  function setupInputHandlers() {
    // Keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    // Mouse events
    const handleMouseMove = (e: MouseEvent) => {
      if (isMouseDown) {
        mouseX = e.movementX;
        mouseY = e.movementY;
      }
    };

    const handleMouseDown = () => {
      isMouseDown = true;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);

    // Store cleanup function
    cleanupInputHandlers = () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
    };
  }

  function setupResizeHandler() {
    const handleResize = () => {
      if (!canvas || !camera || !raytracer) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const newAspect = canvas.width / canvas.height;
      camera.setAspect(newAspect);
      camera.setCanvasDimensions(canvas.width, canvas.height);

      // Update display dimensions
      displayWidth = canvas.width;
      displayHeight = canvas.height;

      // Update render dimensions based on current scale while maintaining aspect ratio
      const targetPixels = Math.floor(
        displayWidth * displayHeight * renderScale,
      );
      const aspectRatio = displayWidth / displayHeight;

      renderHeight = Math.floor(Math.sqrt(targetPixels / aspectRatio));
      renderWidth = Math.floor(renderHeight * aspectRatio);

      // Update raytracer with new dimensions
      const renderSettings: RenderSettings = {
        renderWidth,
        renderHeight,
        displayWidth,
        displayHeight,
        maxBounces,
        raysPerPixel,
      };

      raytracer.updateRenderSettings(renderSettings);
      raytracer.updateCamera(camera);
      resetTemporalAccumulation();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    cleanupResizeHandler = () => {
      window.removeEventListener("resize", handleResize);
    };
  }
</script>

<canvas
  bind:this={canvas}
  style="width: 100vw; height: 100vh; display: block; cursor: grab;"
></canvas>

<!-- Debug buffer viewer -->
<canvas
  bind:this={bufferViewerCanvas}
  class="buffer-viewer"
  style="width: 200px; height: 150px; display: block;"
></canvas>

<div class="controls">
  <div class="controls-grid">
    <label for="fov-input">FOV</label>
    <input
      id="fov-input"
      type="range"
      min="10"
      max="120"
      step="1"
      bind:value={fovDegrees}
      on:input={updateFOV}
      on:input={updateSliderProgress}
    />
    <span class="value-display">{fovDegrees}°</span>

    <label for="scale-input">Scale</label>
    <input
      id="scale-input"
      type="range"
      min="0.01"
      max="1.0"
      step="0.01"
      bind:value={renderScale}
      on:input={updateRenderScale}
      on:input={updateSliderProgress}
    />
    <span class="value-display">{Math.round(renderScale * 100)}%</span>

    <label for="bounces-input">Bounces</label>
    <input
      id="bounces-input"
      type="range"
      min="1"
      max="25"
      step="1"
      bind:value={maxBounces}
      on:input={updateSliderProgress}
      on:input={updateMaxBounces}
    />
    <span class="value-display">{maxBounces}</span>

    <label for="rays-input">Rays</label>
    <input
      id="rays-input"
      type="range"
      min="1"
      max="16"
      step="1"
      bind:value={raysPerPixel}
      on:input={updateSliderProgress}
      on:input={updateRaysPerPixel}
    />
    <span class="value-display">{raysPerPixel}</span>
  </div>

  <div class="position-rotation-grid">
    <span class="position-label">P:</span>
    <span class="position-value x">{currentPosition.x}</span>
    <span class="position-value y">{currentPosition.y}</span>
    <span class="position-value z">{currentPosition.z}</span>

    <span class="rotation-label">R:</span>
    <span class="rotation-value x"
      >{((currentPitch * 180) / Math.PI).toFixed(1)}°</span
    >
    <span class="rotation-value y"
      >{((currentYaw * 180) / Math.PI).toFixed(1)}°</span
    >
    <span class="rotation-value z">0.0°</span>
  </div>

  <div class="stats-grid">
    <span class="stat-item" style="color: #4caf50;">{fps}</span>
    <span class="stat-item" style="color: #2196f3;"
      >{fps > 0 ? Math.round(1000 / fps) : 0}ms</span
    >
    <span class="stat-item" style="color: #e040fb;">{memoryInfo.used}MB</span>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: Arial, sans-serif;
  }

  :global(canvas) {
    display: block;
  }

  .controls {
    position: fixed;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.7);

    color: white;
    padding: 12px;
    border-radius: 10px;
    font-size: 12px;
    z-index: 1000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
      "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
    width: 180px;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: auto 90px auto;
    grid-template-rows: auto auto auto auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .position-rotation-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: auto auto;
    gap: 4px;
    align-items: center;
    margin-bottom: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: auto;
    gap: 6px;
    align-items: center;
  }

  .setting-row {
    display: contents;
  }

  .setting-row label {
    font-weight: 600;
    color: white;
    font-size: 11px;
    min-width: 60px;
  }

  .setting-row input {
    width: 80px;
    padding: 5px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
      "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }

  .setting-row input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.15);
  }

  .value-display {
    min-width: 35px;
    text-align: center;
    color: white;
    font-weight: 600;
    font-size: 11px;
  }

  .resolution-info {
    margin: 15px 0;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .resolution-info p {
    margin: 8px 0;
    font-size: 13px;
  }

  .combined-graph {
    grid-column: 1 / -1;
    margin-top: 10px;
  }

  .graph-stats {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 500;
  }

  .stat-item {
    flex: 1;
    text-align: center;
  }

  .performance-graph {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
  }

  .position-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    grid-column: 1 / -1;
    margin-top: 10px;
  }

  .position-label,
  .rotation-label {
    font-weight: 600;
    color: white;
    font-size: 10px;
    text-align: left;
  }

  .position-value,
  .rotation-value {
    font-size: 10px;
    font-weight: 500;
    text-align: left;
    padding: 2px 1px;
  }

  .position-value.x {
    color: #ff4444;
  }

  .position-value.y {
    color: #44ff44;
  }

  .position-value.z {
    color: #4444ff;
  }

  .rotation-value.x {
    color: #ff4444;
  }

  .rotation-value.y {
    color: #44ff44;
  }

  .rotation-value.z {
    color: #4444ff;
  }

  .stat-item {
    font-size: 10px;
    font-weight: 500;
    text-align: center;
  }

  .performance-graph {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    grid-column: 1 / -1;
  }

  .buffer-viewer {
    position: fixed;
    bottom: 20px;
    right: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
  }
</style>
