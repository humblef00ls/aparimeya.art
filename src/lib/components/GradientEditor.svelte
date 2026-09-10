<script lang="ts">
  import {
    MAX_GRADIENT_STOPS,
    moveGradientStop,
    type GradientStop,
  } from "$lib/black-hole/filters";
  export let stops: readonly GradientStop[];
  let selected = 0;
  let track: HTMLButtonElement;
  let picker: HTMLInputElement;
  let drag: { index: number; x: number; moved: boolean } | null = null;
  let suppressClick = false;
  $: selected = Math.min(selected, stops.length - 1);
  $: current = stops[selected];
  $: gradient = `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`;

  function update(patch: Partial<GradientStop>) {
    stops = stops.map((stop, i) =>
      i === selected ? { ...stop, ...patch } : stop,
    );
  }
  function move(position: number) {
    const result = moveGradientStop(stops, selected, position);
    stops = result.stops;
    selected = result.selected;
    if (drag) drag.index = selected;
  }
  function positionAt(x: number) {
    const bounds = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - bounds.left) / bounds.width));
  }
  function add(position?: number) {
    if (stops.length >= MAX_GRADIENT_STOPS) return;
    if (position === undefined) {
      let gap = 0;
      for (let i = 1; i < stops.length - 1; i++)
        if (
          stops[i + 1].position - stops[i].position >
          stops[gap + 1].position - stops[gap].position
        )
          gap = i;
      position = (stops[gap].position + stops[gap + 1].position) / 2;
    }
    const near = stops.findIndex(
      (s) => Math.abs(s.position - position!) < 0.001,
    );
    if (near >= 0) {
      selected = near;
      return;
    }
    const right = stops.findIndex((s) => s.position > position!);
    const index = right < 0 ? stops.length : right;
    const a = stops[Math.max(0, index - 1)],
      b = stops[Math.min(stops.length - 1, index)];
    const t = a === b ? 0 : (position - a.position) / (b.position - a.position);
    // Interpolate in the same display color space as the rendering pass.
    const color =
      "#" +
      [1, 3, 5]
        .map((offset) => {
          const low = parseInt(a.color.slice(offset, offset + 2), 16);
          const high = parseInt(b.color.slice(offset, offset + 2), 16);
          return Math.round(low + (high - low) * t)
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
    stops = [
      ...stops.slice(0, index),
      { position, color },
      ...stops.slice(index),
    ];
    selected = index;
  }
  function remove() {
    if (stops.length <= 2) return;
    stops = stops.filter((_, i) => i !== selected);
  }
  function start(event: PointerEvent, index: number) {
    if (event.button !== 0) return;
    selected = index;
    suppressClick = false;
    drag = { index, x: event.clientX, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function dragging(event: PointerEvent) {
    if (!drag) return;
    drag.moved ||= Math.abs(event.clientX - drag.x) > 3;
    if (drag.moved) {
      selected = drag.index;
      move(positionAt(event.clientX));
    }
  }
  function finish() {
    suppressClick = drag?.moved ?? false;
    drag = null;
  }
  function openColor(index = selected) {
    selected = index;
    // Set synchronously so a just-selected handle opens its own color.
    picker.value = stops[index].color;
    picker.click();
  }
  function key(event: KeyboardEvent, index: number) {
    selected = index;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(
        stops[index].position +
          (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 0.1 : 0.01),
      );
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove();
    }
  }
</script>

<div class="editor">
  <div class="ends"><span>Shadows</span><span>Highlights</span></div>
  <div class="ramp">
    <button
      bind:this={track}
      class="track"
      style:background={gradient}
      aria-label="Add color stop on gradient"
      title="Click to add a color stop"
      on:click={(event) =>
        add(event.detail === 0 ? undefined : positionAt(event.clientX))}
    ></button>
    {#each stops as stop, index}
      <button
        class="handle"
        class:selected={selected === index}
        style:left={`${stop.position * 100}%`}
        style:--stop-color={stop.color}
        aria-label={`Stop ${index + 1}: ${Math.round(stop.position * 100)}%, ${stop.color}. Drag to move, click to edit color.`}
        aria-pressed={selected === index}
        on:pointerdown={(event) => start(event, index)}
        on:pointermove={dragging}
        on:pointerup={finish}
        on:pointercancel={() => {
          drag = null;
          suppressClick = true;
        }}
        on:click={() => {
          if (!suppressClick) openColor(index);
          suppressClick = false;
        }}
        on:keydown={(event) => key(event, index)}><span></span></button
      >
    {/each}
  </div>
  <div class="inspector">
    <label class="color" title="Selected stop color">
      <input
        bind:this={picker}
        type="color"
        aria-label="Selected stop color"
        value={current.color}
        on:input={(event) => update({ color: event.currentTarget.value })}
      />
      <span>{current.color.toUpperCase()}</span>
    </label>
    <label class="location"
      ><span class="sr-only">Stop position</span>
      <input
        type="number"
        aria-label="Stop position"
        min="0"
        max="100"
        step="1"
        value={+(current.position * 100).toFixed(1)}
        on:change={(event) => move(event.currentTarget.valueAsNumber / 100)}
      /><span>%</span>
    </label>
    <button
      class="icon"
      aria-label="Add color stop"
      title="Add color stop"
      disabled={stops.length >= MAX_GRADIENT_STOPS}
      on:click={() => add()}>+</button
    >
    <button
      class="icon"
      aria-label="Remove selected stop"
      title="Remove selected stop"
      disabled={stops.length <= 2}
      on:click={remove}>−</button
    >
  </div>
  <p>
    Click the gradient to add. Drag stops to move; click to edit color. Saved in
    this browser.
  </p>
</div>

<style>
  .editor {
    margin-top: 20px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 9px;
  }
  button {
    border: 0;
    color: var(--text);
    cursor: pointer;
  }
  .ramp {
    position: relative;
    margin: 0 10px 20px;
    padding-bottom: 20px;
  }
  .track {
    display: block;
    width: 100%;
    height: 32px;
    border-radius: 5px;
    padding: 0;
    cursor: crosshair;
  }
  .handle {
    position: absolute;
    top: 24px;
    width: 28px;
    height: 36px;
    transform: translateX(-50%);
    background: transparent;
    padding: 7px;
    touch-action: none;
    cursor: ew-resize;
    z-index: 1;
  }
  .handle span {
    display: block;
    width: 14px;
    height: 19px;
    background: var(--stop-color);
    clip-path: polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%);
  }
  .handle {
    filter: drop-shadow(0 0 1px #fff) drop-shadow(0 2px 2px #000);
  }
  .handle.selected {
    z-index: 2;
    filter: drop-shadow(0 0 2px var(--accent)) drop-shadow(0 0 1px #fff);
  }
  .handle.selected::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 11px;
    width: 6px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .inspector {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .color,
  .location,
  .icon {
    display: flex;
    align-items: center;
    background: #ffffff0b;
    border-radius: 6px;
    height: 34px;
    font-size: 11px;
  }
  .color {
    flex: 1;
    gap: 6px;
    padding: 0 7px;
    cursor: pointer;
    min-width: 0;
  }
  .color input {
    width: 22px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  .location {
    padding: 0 6px;
    color: var(--muted);
  }
  .location input {
    width: 36px;
    background: none;
    border: 0;
    color: var(--text);
    font: inherit;
    appearance: textfield;
    text-align: right;
  }
  .location input::-webkit-inner-spin-button {
    appearance: none;
  }
  .icon {
    justify-content: center;
    width: 28px;
    flex-shrink: 0;
    font-size: 19px;
    color: var(--accent);
  }
  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  p {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
    margin-top: 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
