<script lang="ts">
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
<input {id} type="range" {min} {max} {step} {disabled} bind:value />

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
  input {
    width: 100%;
    height: 20px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--accent);
  }
  input:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
