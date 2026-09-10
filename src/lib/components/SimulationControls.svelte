<script lang="ts">
  import ShaderControls from "./ShaderControls.svelte";
  import RangeControl from "./RangeControl.svelte";
  import type { SimulationSettings, ViewPreset } from "$lib/black-hole/model";
  import type { MotionStatus } from "$lib/black-hole/device-orientation";
  export let motionStatus: MotionStatus;
  export let motionSupported: boolean;
  export let onMotionToggle: () => void;
  export let onMotionRecenter: () => void;
  $: motionEnabled = motionStatus === "active" || motionStatus === "waiting";
  export let settings: SimulationSettings;
  export let selectedView: ViewPreset | null;
  export let onView: (view: ViewPreset) => void;
  function changeView(event: Event) {
    onView((event.currentTarget as HTMLSelectElement).value as ViewPreset);
  }
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const multiple = (value: number) => `${value.toFixed(1)}×`;
</script>

<section aria-label="Simulation controls">
  <details open>
    <summary>Accretion disk</summary>
    <label class="row" for="disk-color"
      >Color<input
        id="disk-color"
        type="color"
        bind:value={settings.diskColor}
      /></label
    >
    <RangeControl
      id="disk-texture"
      label="Texture strength"
      min={0}
      max={1.5}
      bind:value={settings.diskTexture}
      format={percent}
    />
    <RangeControl
      id="disk-scale"
      label="Texture scale"
      min={0.3}
      max={2}
      bind:value={settings.diskScale}
      format={multiple}
      disabled={settings.diskTexture === 0}
    />
    <RangeControl
      id="disk-brightness"
      label="Disk brightness"
      min={0.2}
      max={2}
      bind:value={settings.diskBrightness}
      format={multiple}
    />
    <RangeControl
      id="bloom"
      label="Disk glow"
      min={0}
      max={1.5}
      bind:value={settings.bloom}
      format={percent}
    />
    <p>Set texture strength to zero for a smooth disk.</p>
  </details>
  <details>
    <summary>Stars &amp; gravity</summary>
    <label class="row"
      >Background stars<input
        type="checkbox"
        role="switch"
        bind:checked={settings.stars}
      /></label
    >
    <RangeControl
      id="star-size"
      label="Star size"
      step={0.01}
      min={0.5}
      max={3}
      bind:value={settings.starSize}
      format={multiple}
      disabled={!settings.stars}
    />
    <RangeControl
      id="star-variation"
      label="Star variation"
      step={0.005}
      min={0}
      max={1}
      bind:value={settings.starVariation}
      format={percent}
      disabled={!settings.stars}
    />
    <RangeControl
      id="star-density"
      label="Star density"
      min={0.25}
      max={2}
      bind:value={settings.starDensity}
      format={multiple}
      disabled={!settings.stars}
    />
    <label class="row"
      >Gravity grid<input
        type="checkbox"
        role="switch"
        bind:checked={settings.gravityGrid}
      /></label
    >
    <p>The grid is an illustrative gravity well below the disk.</p>
  </details>
  <details>
    <summary>Camera &amp; rendering</summary>
    <div class="row">
      <label for="view">View</label><select
        id="view"
        value={selectedView ?? "custom"}
        on:change={changeView}
      >
        <option value="custom" disabled>Custom</option><option value="cinematic"
          >Cinematic</option
        ><option value="edge">Edge-on</option><option value="overhead"
          >Overhead</option
        >
      </select>
    </div>
    <div class="actions">
      <button on:click={() => (settings.paused = !settings.paused)}
        >{settings.paused ? "Resume" : "Pause"}</button
      ><button on:click={() => onView("cinematic")}>Reset view</button>
    </div>
    <label class="row"
      >Auto orbit<input
        type="checkbox"
        role="switch"
        bind:checked={settings.autoOrbit}
      /></label
    >
    {#if motionSupported}
      <div class="actions">
        <button
          on:click={onMotionToggle}
          disabled={motionStatus === "requesting"}
          aria-pressed={motionEnabled}
          >{motionEnabled
            ? "Disable phone motion"
            : "Enable phone motion"}</button
        >
        {#if motionEnabled}<button on:click={onMotionRecenter}
            >Recenter tilt</button
          >{/if}
      </div>
      <p role="status">
        {motionStatus === "denied"
          ? "Motion access was denied. Allow it in your browser's site settings to try again."
          : motionStatus === "unavailable"
            ? "No orientation data received. Your browser or device may not support motion input."
            : motionStatus === "waiting"
              ? "Move your phone gently to start."
              : "Tilt for parallax; roll your phone to keep the scene level. Readings stay on your device."}
      </p>
    {/if}
    <RangeControl
      id="exposure"
      label="Exposure"
      min={0.3}
      max={2.5}
      bind:value={settings.exposure}
    />
    <RangeControl
      id="speed"
      label="Time scale"
      min={0}
      max={3}
      step={0.1}
      bind:value={settings.speed}
      format={multiple}
    />
    <RangeControl
      id="resolution"
      label="Resolution"
      min={0.25}
      max={1.75}
      step={0.01}
      bind:value={settings.resolution}
      format={(value) => `${value.toFixed(2)}×`}
    />
    <div class="scale-labels">
      <span>Fewer pixels</span><span>More pixels</span>
    </div>
    <p>
      Changes pixel resolution only. Lower values use crisp pixel blocks; ray
      sampling and appearance settings stay fixed.
    </p>
    <label class="row"
      >Gravitational lensing<input
        type="checkbox"
        role="switch"
        bind:checked={settings.lensing}
      /></label
    >
    <label class="row"
      >Doppler beaming<input
        type="checkbox"
        role="switch"
        bind:checked={settings.doppler}
      /></label
    >
  </details>
  <details>
    <summary>Shaders</summary>
    <ShaderControls bind:settings />
  </details>
  <p>Drag to orbit · Scroll or pinch to zoom</p>
</section>

<style>
  .scale-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--muted);
    margin-top: 5px;
  }
  details {
    border: 0;
    padding: 16px 0;
  }
  details:first-child {
    padding-top: 0;
  }
  summary {
    cursor: pointer;
    font-size: 13px;
    padding: 4px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    margin: 18px 0;
  }
  input[type="color"] {
    width: 46px;
    height: 30px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
    padding: 2px;
  }
  input[type="checkbox"] {
    width: 30px;
    height: 18px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  select,
  button {
    color: var(--text);
    background: #ffffff10;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0;
    border-radius: 5px;
    padding: 8px;
    font-size: 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  button {
    flex: 1;
  }
  p {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.6;
    margin: 16px 0 0;
  }
</style>
