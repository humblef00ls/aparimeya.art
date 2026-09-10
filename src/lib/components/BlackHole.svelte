<script lang="ts">
  import { GRADIENT_STORAGE_KEY, parseGradient } from "$lib/black-hole/filters";
  import { onMount } from "svelte";
  import { DEFAULT_SETTINGS, type ViewPreset } from "$lib/black-hole/model";
  import type {
    BlackHoleSimulation,
    SimulationStats,
  } from "$lib/black-hole/simulation";
  import IntroGreeting from "./IntroGreeting.svelte";
  import MotionPrompt from "./MotionPrompt.svelte";
  import PerformanceStats from "./PerformanceStats.svelte";
  import SimulationControls from "./SimulationControls.svelte";

  import type {
    DeviceOrientationControls,
    MotionStatus,
  } from "$lib/black-hole/device-orientation";
  let motion: DeviceOrientationControls | undefined;
  let motionStatus: MotionStatus = "off";
  let motionSupported = false;

  let canvas: HTMLCanvasElement;
  let keyboardNavigation = false;
  let simulation: BlackHoleSimulation | undefined;
  let settings = { ...DEFAULT_SETTINGS };
  let stats: SimulationStats | undefined;
  let openPanel: "stats" | "controls" | null = null;
  let statsButton: HTMLButtonElement;
  let controlsButton: HTMLButtonElement;
  let error = "";
  let ready = false;
  let storageReady = false;
  let savedGradient = "";
  // Persist only custom stops, independently of the currently selected preset.
  $: if (storageReady) {
    const serialized = JSON.stringify(settings.customGradient);
    if (serialized !== savedGradient) {
      try {
        localStorage.setItem(GRADIENT_STORAGE_KEY, serialized);
      } catch {
        /* Storage may be disabled. Editing still works. */
      }
      savedGradient = serialized;
    }
  }
  let selectedView: ViewPreset | null = "cinematic";
  $: simulation?.update(settings);

  onMount(() => {
    try {
      const gradient = parseGradient(
        localStorage.getItem(GRADIENT_STORAGE_KEY),
      );
      if (gradient) settings.customGradient = gradient;
    } catch {
      /* Private or restricted storage falls back to defaults. */
    }
    savedGradient = JSON.stringify(settings.customGradient);
    storageReady = true;
    let cancelled = false;
    async function start() {
      try {
        // Keep GPU initialization out of the server route and allow the shell to paint first.
        const { BlackHoleSimulation } = await import(
          "$lib/black-hole/simulation"
        );
        if (cancelled) return;
        const reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reducedMotion) settings.paused = true;
        simulation = await BlackHoleSimulation.create(
          canvas,
          settings,
          (value) => {
            stats = value;
          },
          (message) => {
            error = message;
          },
          () => {
            selectedView = null;
          },
          () => {
            ready = true;
          },
          !reducedMotion,
        );
        if (cancelled) {
          simulation.dispose();
          return;
        }
        simulation.update(settings);
        const { DeviceOrientationControls } = await import(
          "$lib/black-hole/device-orientation"
        );
        if (cancelled) return;
        motion = new DeviceOrientationControls(
          (pose) => simulation?.setMotion(pose),
          (status) => {
            motionStatus = status;
          },
        );
        motionSupported = motion.supported;
      } catch (cause) {
        error =
          cause instanceof Error
            ? cause.message
            : "Your browser could not start the simulation.";
      }
    }
    void start();
    return () => {
      cancelled = true;
      motion?.dispose();
      simulation?.dispose();
    };
  });

  function setView(view: ViewPreset) {
    selectedView = view;
    simulation?.setView(view);
  }
  function handleKey(event: KeyboardEvent) {
    if (
      event.key === "Tab" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    )
      keyboardNavigation = true;
    if (event.key === "Escape" && openPanel) {
      (openPanel === "stats" ? statsButton : controlsButton)?.focus();
      openPanel = null;
    }
    if (event.target !== canvas) return;
    if (event.code === "Space") {
      event.preventDefault();
      settings.paused = !settings.paused;
    }
    if (event.key.toLowerCase() === "r") selectedView = "cinematic";
  }
</script>

<svelte:window
  on:keydown={handleKey}
  on:pointerdown={() => (keyboardNavigation = false)}
/>
<main class:ready style:--accent={settings.diskColor}>
  <canvas
    bind:this={canvas}
    class:keyboard-focus={keyboardNavigation}
    tabindex="0"
    aria-label="Black hole simulation. Drag to orbit, scroll or pinch to zoom. Arrow keys orbit, plus and minus zoom, Space pauses, R resets."
  />
  {#if error}
    <div class="status" role="alert">
      <p>{error}</p>
      <button on:click={() => location.reload()}>Restart simulation</button>
    </div>
  {/if}
  {#if ready && !error}
    <IntroGreeting />
  {/if}
  {#if ready && motionSupported && !error}
    <MotionPrompt
      status={motionStatus}
      visible={openPanel === null}
      onEnable={() => {
        void motion?.enable();
      }}
    />
  {/if}
  <div class="corner left">
    {#if openPanel === "stats"}
      <section
        id="stats-panel"
        class="panel"
        aria-label="Performance statistics"
      >
        <PerformanceStats {stats} />
      </section>
    {/if}
    <button
      bind:this={statsButton}
      class="toggle"
      aria-expanded={openPanel === "stats"}
      aria-label="Performance statistics"
      title="Performance statistics"
      aria-controls="stats-panel"
      on:click={() => (openPanel = openPanel === "stats" ? null : "stats")}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M3 16V10M10 16V4M17 16V7" /></svg
      >
    </button>
  </div>
  <div class="corner right">
    {#if openPanel === "controls"}
      <section id="controls-panel" class="panel" aria-label="Controls">
        <SimulationControls
          bind:settings
          {selectedView}
          onView={setView}
          {motionStatus}
          {motionSupported}
          onMotionToggle={() => {
            if (motionStatus === "active" || motionStatus === "waiting")
              motion?.disable();
            else void motion?.enable();
          }}
          onMotionRecenter={() => motion?.recenter()}
        />
      </section>
    {/if}
    <button
      bind:this={controlsButton}
      class="toggle"
      aria-expanded={openPanel === "controls"}
      aria-label="Appearance settings"
      title="Appearance settings"
      aria-controls="controls-panel"
      on:click={() =>
        (openPanel = openPanel === "controls" ? null : "controls")}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path d="M2 5H8M12 5H18M2 15H12M16 15H18" /><circle
          cx="10"
          cy="5"
          r="2"
        /><circle cx="14" cy="15" r="2" /></svg
      >
    </button>
  </div>
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    background: #030305;
  }
  canvas,
  .corner {
    opacity: 0;
    transition: opacity 1.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ready canvas,
  .ready .corner {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    canvas,
    .corner {
      transition: none;
    }
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    outline: none;
  }
  canvas.keyboard-focus:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }
  .corner {
    position: absolute;
    bottom: max(20px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  }
  .left {
    left: max(20px, env(safe-area-inset-left));
    align-items: flex-start;
  }
  .right {
    right: max(20px, env(safe-area-inset-right));
    align-items: flex-end;
  }
  button,
  .panel {
    pointer-events: auto;
  }
  button {
    color: var(--text);
    background: #18192170;
    border: 0;
    border-radius: 9px;
    padding: 12px 16px;
  }
  .toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    width: 46px;
    height: 46px;
    min-height: 44px;
    font-size: 13px;
    backdrop-filter: blur(22px) saturate(150%);
    -webkit-backdrop-filter: blur(22px) saturate(150%);
  }
  .toggle:hover,
  .toggle[aria-expanded="true"] {
    background: #ffffff20;
    color: var(--accent);
  }
  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .panel {
    width: min(310px, calc(100vw - 40px));
    max-height: calc(100dvh - 104px);
    overflow: auto;
    background: #11121b80;
    border: 0;
    border-radius: 12px;
    padding: 22px;
    backdrop-filter: blur(28px) saturate(150%);
    -webkit-backdrop-filter: blur(28px) saturate(150%);
    box-shadow: 0 12px 40px #0006;
  }
  .status {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    max-width: 420px;
    width: calc(100% - 48px);
    text-align: center;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.6;
  }
</style>
