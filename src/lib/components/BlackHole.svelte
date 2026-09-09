<script lang="ts">
  import { onMount } from "svelte";
  import { DEFAULT_SETTINGS, type ViewPreset } from "$lib/black-hole/model";
  import type {
    BlackHoleSimulation,
    SimulationStats,
  } from "$lib/black-hole/simulation";
  import ShaderControls from "./ShaderControls.svelte";
  import PerformanceStats from "./PerformanceStats.svelte";
  import SimulationControls from "./SimulationControls.svelte";

  let canvas: HTMLCanvasElement;
  let simulation: BlackHoleSimulation | undefined;
  let settings = { ...DEFAULT_SETTINGS };
  let stats: SimulationStats | undefined;
  let openPanel: "stats" | "controls" | "shaders" | null = null;
  let shadersButton: HTMLButtonElement;
  let statsButton: HTMLButtonElement;
  let controlsButton: HTMLButtonElement;
  let error = "";
  let ready = false;
  let selectedView: ViewPreset | null = "cinematic";
  $: simulation?.update(settings);

  onMount(() => {
    let cancelled = false;
    async function start() {
      try {
        // Keep Three.js out of the server route and allow the shell to paint first.
        const { BlackHoleSimulation } = await import(
          "$lib/black-hole/simulation"
        );
        if (cancelled) return;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches)
          settings.paused = true;
        simulation = new BlackHoleSimulation(
          canvas,
          settings,
          (value) => {
            stats = value;
            ready = true;
          },
          (message) => {
            error = message;
          },
          () => {
            settings.autoOrbit = false;
            selectedView = null;
          },
        );
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
      simulation?.dispose();
    };
  });

  function setView(view: ViewPreset) {
    selectedView = view;
    settings.autoOrbit = false;
    simulation?.setView(view);
  }
  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape" && openPanel) {
      (openPanel === "stats"
        ? statsButton
        : openPanel === "shaders"
          ? shadersButton
          : controlsButton
      )?.focus();
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

<svelte:window on:keydown={handleKey} />
<main>
  <canvas
    bind:this={canvas}
    tabindex="0"
    aria-label="Black hole simulation. Drag to orbit, scroll or pinch to zoom. Arrow keys orbit, plus and minus zoom, Space pauses, R resets."
  />
  {#if error}
    <div class="status" role="alert">
      <p>{error}</p>
      <button on:click={() => location.reload()}>Restart simulation</button>
    </div>
  {:else if !ready}
    <p class="status" role="status">Starting simulation…</p>
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
  <div class="corner center">
    {#if openPanel === "shaders"}
      <section id="shaders-panel" class="panel" aria-label="Final shaders">
        <ShaderControls bind:settings />
      </section>
    {/if}
    <button
      bind:this={shadersButton}
      class="toggle"
      aria-label="Final shaders"
      title="Final shaders"
      aria-expanded={openPanel === "shaders"}
      aria-controls="shaders-panel"
      on:click={() => (openPanel = openPanel === "shaders" ? null : "shaders")}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"
        ><path
          d="M10 2L18 6L10 10L2 6Z M2 10L10 14L18 10 M2 14L10 18L18 14"
        /></svg
      >
    </button>
  </div>
  <div class="corner right">
    {#if openPanel === "controls"}
      <section id="controls-panel" class="panel" aria-label="Controls">
        <SimulationControls bind:settings {selectedView} onView={setView} />
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
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
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
  .center {
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
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
    background: #141518e8;
    border: 1px solid #ffffff26;
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
    backdrop-filter: blur(16px);
  }
  .toggle:hover,
  .toggle[aria-expanded="true"] {
    background: #28282ce8;
    border-color: #ffffff45;
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
    background: #111216f2;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px;
    backdrop-filter: blur(20px);
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
