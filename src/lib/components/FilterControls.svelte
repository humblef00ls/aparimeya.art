<script lang="ts">
  import { FILTERS, MAX_GRADIENT_STOPS } from "$lib/black-hole/filters";
  import type { SimulationSettings } from "$lib/black-hole/model";
  export let settings: SimulationSettings;
  const presets = Object.keys(FILTERS) as (keyof typeof FILTERS)[];
  $: preview = `linear-gradient(90deg, ${settings.customGradient.map((stop) => `${stop.color} ${stop.position * 100}%`).join(", ")})`;

  function updateStop(
    index: number,
    patch: { color?: string; position?: number },
  ) {
    settings.customGradient = settings.customGradient.map((stop, i) =>
      i === index ? { ...stop, ...patch } : stop,
    );
  }
  function addStop() {
    const stops = [...settings.customGradient];
    if (stops.length >= MAX_GRADIENT_STOPS) return;
    let gap = 0;
    for (let i = 1; i < stops.length - 1; i++) {
      if (
        stops[i + 1].position - stops[i].position >
        stops[gap + 1].position - stops[gap].position
      )
        gap = i;
    }
    const a = stops[gap],
      b = stops[gap + 1];
    // A new point initially preserves the existing gradient.
    const color =
      "#" +
      [1, 3, 5]
        .map((offset) =>
          Math.round(
            (parseInt(a.color.slice(offset, offset + 2), 16) +
              parseInt(b.color.slice(offset, offset + 2), 16)) /
              2,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    stops.splice(gap + 1, 0, {
      position: (a.position + b.position) / 2,
      color,
    });
    settings.customGradient = stops;
  }
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
  <div class="editor">
    <div
      class="gradient-preview"
      style:background={preview}
      aria-hidden="true"
    ></div>
    <div class="ends"><span>Shadows</span><span>Highlights</span></div>
    {#each settings.customGradient as stop, index}
      <div class="stop">
        <input
          type="color"
          aria-label={`Stop ${index + 1} color`}
          value={stop.color}
          on:input={(event) =>
            updateStop(index, { color: event.currentTarget.value })}
        />
        <div class="position">
          <label for={`stop-${index}`}
            >Stop {index + 1}<span>{Math.round(stop.position * 100)}%</span
            ></label
          >
          <input
            id={`stop-${index}`}
            type="range"
            aria-label={`Stop ${index + 1} position`}
            min={index === 0
              ? 0
              : settings.customGradient[index - 1].position + 0.001}
            max={index === settings.customGradient.length - 1
              ? 1
              : settings.customGradient[index + 1].position - 0.001}
            step="0.001"
            value={stop.position}
            on:input={(event) =>
              updateStop(index, { position: +event.currentTarget.value })}
          />
        </div>
        <button
          class="remove"
          aria-label={`Remove stop ${index + 1}`}
          disabled={settings.customGradient.length <= 2}
          on:click={() =>
            (settings.customGradient = settings.customGradient.filter(
              (_, i) => i !== index,
            ))}>×</button
        >
      </div>
    {/each}
    <button
      class="add"
      on:click={addStop}
      disabled={settings.customGradient.length >= MAX_GRADIENT_STOPS}
      >Add color stop</button
    >
    <p>
      Up to {MAX_GRADIENT_STOPS} stops. Your gradient is saved in this browser.
    </p>
  </div>
{/if}
<p>
  Maps brightness to a color gradient after shaders. Pixels and characters keep
  their shape.
</p>

<style>
  .editor {
    margin-top: 16px;
  }
  .gradient-preview {
    height: 24px;
    border-radius: 6px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
    margin: 6px 0 12px;
  }
  .stop {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
  }
  .stop input[type="color"] {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .position {
    flex: 1;
    min-width: 0;
  }
  .position label {
    padding: 0;
    margin: 0;
    justify-content: space-between;
    font-size: 11px;
  }
  .position input {
    width: 100%;
    min-height: 28px;
    margin: 0;
  }
  button {
    border: 0;
    border-radius: 6px;
    background: #ffffff0d;
    color: var(--accent);
    cursor: pointer;
    min-height: 36px;
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .remove {
    width: 32px;
    font-size: 20px;
  }
  .add {
    width: 100%;
    margin-top: 8px;
  }
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
