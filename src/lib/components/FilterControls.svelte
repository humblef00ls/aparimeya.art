<script lang="ts">
  import GradientEditor from "./GradientEditor.svelte";
  import { FILTERS } from "$lib/black-hole/filters";
  import type { SimulationSettings } from "$lib/black-hole/model";
  export let settings: SimulationSettings;
  const presets = Object.keys(FILTERS) as (keyof typeof FILTERS)[];
  $: preview = `linear-gradient(90deg, ${settings.customGradient.map((stop) => `${stop.color} ${stop.position * 100}%`).join(", ")})`;
</script>

<fieldset>
  <legend>Gradient maps</legend>
  {#each presets as preset}
    {@const filter = FILTERS[preset]}
    <label class:active={settings.filter === preset}>
      <input
        type="radio"
        name="filter"
        value={preset}
        bind:group={settings.filter}
      />
      <span>{filter.label}<small>{filter.description}</small></span>
      {#if preset !== "none"}
        <span
          class="swatch"
          aria-hidden="true"
          style:background={`linear-gradient(90deg, ${filter.colors.join(", ")})`}
        ></span>
      {/if}
    </label>
  {/each}
  <label class:active={settings.filter === "custom"}>
    <input
      type="radio"
      name="filter"
      value="custom"
      bind:group={settings.filter}
    />
    <span>Custom<small>Your own color stops</small></span>
    <span class="swatch" aria-hidden="true" style:background={preview}></span>
  </label>
</fieldset>
{#if settings.filter === "custom"}
  <GradientEditor bind:stops={settings.customGradient} />
{/if}
<p>
  Maps brightness to a color gradient after shaders. Pixels and characters keep
  their shape.
</p>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    font-size: 13px;
    margin: 16px 0;
  }
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    margin-top: 6px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
  }
  label:hover,
  .active {
    background: #ffffff08;
    color: var(--accent);
  }
  input {
    accent-color: var(--accent);
  }
  small,
  p {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
  }
  small {
    display: block;
    margin-top: 4px;
  }
  .swatch {
    width: 44px;
    height: 12px;
    border-radius: 6px;
    flex-shrink: 0;
    margin-left: auto;
  }
</style>
