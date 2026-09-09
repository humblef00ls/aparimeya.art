<script lang="ts">
  import type { SimulationSettings, PostEffect } from "$lib/black-hole/model";
  import RangeControl from "./RangeControl.svelte";
  export let settings: SimulationSettings;
  const effects: { value: PostEffect; label: string; description: string }[] = [
    { value: "none", label: "Original", description: "No final effect" },
    {
      value: "ascii",
      label: "ASCII",
      description: "Render the scene as colored characters",
    },
    {
      value: "dither",
      label: "Dither",
      description: "Ordered pixels with a limited palette",
    },
  ];
</script>

<fieldset>
  <legend>Final shader</legend>
  {#each effects as effect}
    <label class:active={settings.postEffect === effect.value}>
      <input
        type="radio"
        name="effect"
        value={effect.value}
        bind:group={settings.postEffect}
      />
      <span>{effect.label}<small>{effect.description}</small></span>
    </label>
  {/each}
</fieldset>
{#if settings.postEffect !== "none"}
  <RangeControl
    id="effect-size"
    label={settings.postEffect === "ascii" ? "Character size" : "Pattern scale"}
    min={4}
    max={16}
    step={1}
    bind:value={settings.effectSize}
    format={(value) => `${value.toFixed(0)}`}
  />
{/if}

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    font-size: 13px;
    margin-bottom: 16px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    margin-top: 6px;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
  }
  label:hover,
  .active {
    background: #ffffff08;
    border-color: var(--border);
  }
  input {
    accent-color: var(--accent);
  }
  small {
    display: block;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
    margin-top: 4px;
  }
</style>
