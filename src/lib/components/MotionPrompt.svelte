<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import type { MotionStatus } from "$lib/black-hole/device-orientation";

  export let status: MotionStatus;
  export let visible = true;
  export let onEnable: () => void;

  const dismissalKey = "aparimeya.motion-prompt.dismissed";
  let mobile = false;
  let dismissed = false;
  let reducedMotion = false;
  // Enabling elsewhere, or later switching motion off, should not trigger another prompt.
  $: if (status === "active") dismissed = true;
  $: busy = status === "requesting" || status === "waiting";
  $: failed = status === "denied" || status === "unavailable";

  onMount(() => {
    mobile =
      navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      dismissed = dismissed || sessionStorage.getItem(dismissalKey) === "1";
    } catch {
      /* The prompt also works without browser storage. */
    }
  });

  function dismiss() {
    dismissed = true;
    try {
      sessionStorage.setItem(dismissalKey, "1");
    } catch {
      /* Optional storage. */
    }
  }
</script>

{#if mobile && visible && !dismissed}
  <aside
    class="motion-prompt"
    aria-label="Phone motion"
    in:fly={{
      y: reducedMotion ? 0 : 20,
      duration: reducedMotion ? 0 : 350,
      delay: reducedMotion ? 0 : 500,
    }}
    out:fly={{ y: reducedMotion ? 0 : 10, duration: reducedMotion ? 0 : 150 }}
  >
    <h2>Move with your phone</h2>
    <p role="status">
      {status === "denied"
        ? "Motion access is blocked. You can allow it in your browser’s site settings."
        : status === "unavailable"
          ? "Motion isn’t available on this device. You can still drag to orbit."
          : status === "waiting"
            ? "Move your phone gently to start."
            : "Tilt and rotate your phone to explore. Motion data stays on your device."}
    </p>
    <div class="actions">
      {#if !failed}
        <button class="enable" on:click={onEnable} disabled={busy}>
          {status === "requesting"
            ? "Requesting…"
            : status === "waiting"
              ? "Connecting…"
              : "Enable motion"}
        </button>
      {/if}
      <button class="dismiss" on:click={dismiss}
        >{failed ? "Got it" : "Not now"}</button
      >
    </div>
  </aside>
{/if}

<style>
  .motion-prompt {
    position: fixed;
    bottom: calc(84px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    width: min(360px, calc(100vw - 32px));
    padding: 20px;
    border: 0;
    border-radius: 14px;
    background: #11121bcc;
    backdrop-filter: blur(28px) saturate(150%);
    -webkit-backdrop-filter: blur(28px) saturate(150%);
    box-shadow: 0 12px 40px #0005;
    z-index: 2;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 500;
  }
  p {
    margin: 0;
    color: #aaa7af;
    font-size: 13px;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  button {
    border: 0;
    border-radius: 8px;
    min-height: 44px;
    padding: 10px 14px;
    font-size: 13px;
  }
  .enable {
    background: var(--accent);
    color: #fff;
  }
  .enable:disabled {
    opacity: 0.65;
  }
  .dismiss {
    background: #ffffff0d;
    color: var(--text);
  }
</style>
