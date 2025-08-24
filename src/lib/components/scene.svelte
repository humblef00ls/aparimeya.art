<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    RayTracer,
    PerspectiveCamera,
    Vector3,
    type RenderSettings,
  } from "$lib/engine";

  let canvas: HTMLCanvasElement;
  let raytracer: RayTracer;
  let camera: PerspectiveCamera;
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
      position: new Vector3(0, 0, -5),
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
    };

    // Create and use our ray tracer with camera data and render settings
    raytracer = new RayTracer(device, context, format, camera, renderSettings);

    // Start render loop
    startRenderLoop();

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
      if (fovSlider) {
        updateSliderProgress({ target: fovSlider } as unknown as Event);
      }
      if (scaleSlider) {
        updateSliderProgress({ target: scaleSlider } as unknown as Event);
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
      raytracer.render();
      animationFrame = requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  function updateFOV() {
    if (camera) {
      const fovRadians = (fovDegrees * Math.PI) / 180;
      camera.setFOV(fovRadians);
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
    };

    raytracer.updateRenderSettings(renderSettings);
  }

  function updateSliderProgress(event: Event) {
    const slider = event.target as HTMLInputElement;
    const value = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.setProperty("--range-progress", percentage + "%");
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
    }
    if (keys.has("s")) {
      const forward = camera.getForward();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(forward.mul(speed)));
    }
    if (keys.has("a")) {
      const right = camera.getRight();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(right.mul(speed)));
    }
    if (keys.has("d")) {
      const right = camera.getRight();
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().add(right.mul(speed)));
    }
    if (keys.has("q")) {
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().add(Vector3.up().mul(speed)));
    }
    if (keys.has("e")) {
      const speed = isShiftHeld ? moveSpeed * shiftMultiplier : moveSpeed;
      camera.moveTo(camera.getPosition().sub(Vector3.up().mul(speed)));
    }
    if (keys.has("r")) {
      camera.resetRotation();
    }

    // Handle arrow key rotation
    if (keys.has("arrowup")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateX(-speed);
    }
    if (keys.has("arrowdown")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateX(speed);
    }
    if (keys.has("arrowleft")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateY(speed);
    }
    if (keys.has("arrowright")) {
      const speed = isShiftHeld ? rotateSpeed * shiftMultiplier : rotateSpeed;
      camera.rotateY(-speed);
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
      };

      raytracer.updateRenderSettings(renderSettings);
      raytracer.updateCamera(camera);
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
    grid-template-rows: auto auto;
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
</style>
