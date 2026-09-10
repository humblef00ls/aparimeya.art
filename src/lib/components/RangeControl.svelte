<script lang="ts">
  import Slider from "./Slider.svelte";
  export let id: string;
  export let label: string;
  export let value: number;
  export let min: number;
  export let max: number;
  export let step = 0.05;
  export let disabled = false;
  export let format: (value: number) => string = (value) => value.toFixed(2);
</script>

<label for={id}>{label}<output>{format(value)}</output></label>
<Slider {id} {min} {max} {step} {disabled} bind:value />

<style>
  label {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    margin: 18px 0 10px;
  }
  output {
    font: 11px var(--mono);
    color: var(--accent);
  }
</style>
