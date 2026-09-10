<script lang="ts">
  export let id: string;
  export let label: string | undefined = undefined;
  export let value: number;
  export let min: number;
  export let max: number;
  export let step = 0.05;
  export let disabled = false;
  export let onChange: ((value: number) => void) | undefined = undefined;
  $: progress =
    max > min
      ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
      : 0;
</script>

<input
  {id}
  type="range"
  aria-label={label}
  {min}
  {max}
  {step}
  {disabled}
  style:--progress={`${progress}%`}
  bind:value
  on:input={(event) => onChange?.(+event.currentTarget.value)}
/>

<style>
  /* Native accent-color is not applied consistently to range controls in WebKit. */
  input {
    appearance: none;
    -webkit-appearance: none;
    display: block;
    width: 100%;
    height: 28px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    --track: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--progress),
      #ffffff20 var(--progress),
      #ffffff20 100%
    );
  }
  input::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 4px;
    background: var(--track);
  }
  input::-moz-range-track {
    height: 4px;
    border-radius: 4px;
    background: var(--track);
  }
  input::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
  }
  input::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 4px;
  }
  input:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
