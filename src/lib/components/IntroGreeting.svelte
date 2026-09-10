<script lang="ts">
  import { onMount } from "svelte";

  const title = "Hello World";
  const name = "I am Aparimeya";
  let titleText: HTMLSpanElement;
  let nameText: HTMLSpanElement;
  let nameScale = 1;

  onMount(() => {
    let mounted = true;
    function matchWidths() {
      if (!mounted) return;
      // Preserve matching widths after the downloaded font replaces the fallback.
      nameScale *=
        titleText.getBoundingClientRect().width /
        nameText.getBoundingClientRect().width;
    }
    matchWidths();
    void document.fonts.load("40px Yigdresil").then(matchWidths, () => {});
    return () => {
      mounted = false;
    };
  });
</script>

<svelte:head>
  <link
    rel="preload"
    href="/fonts/yigdresil.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />
</svelte:head>

<!-- Mounted with the first rendered frame: 1.8 s entrance + 1 s pause. -->
<header class="greeting" style:--name-scale={nameScale}>
  <h1 aria-label={title}>
    <span bind:this={titleText} aria-hidden="true">
      {#each [...title] as character, i}<span
          class="character"
          style:--delay={`${2800 + i * 90}ms`}>{character}</span
        >{/each}
    </span>
  </h1>
  <p aria-label={name}>
    <span bind:this={nameText} aria-hidden="true">
      {#each [...name] as character, i}<span
          class="character"
          style:--delay={`${3950 + i * 45}ms`}>{character}</span
        >{/each}
    </span>
  </p>
</header>

<style>
  @font-face {
    font-family: Yigdresil;
    src: url("/fonts/yigdresil.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  .greeting {
    position: absolute;
    top: max(36px, calc(6vh + env(safe-area-inset-top)));
    left: 20px;
    right: 20px;
    text-align: center;
    pointer-events: none;
    color: var(--text);
    text-shadow: 0 2px 16px #000b;
    font:
      400 clamp(28px, 4vw, 40px) / 1.3 Yigdresil,
      Georgia,
      "Times New Roman",
      serif;
  }
  h1,
  p {
    margin: 0;
    font: inherit;
  }
  h1 > span,
  p > span {
    display: inline-block;
    white-space: pre;
  }
  p {
    margin-top: 10px;
    font-size: calc(1em * var(--name-scale));
    color: #b9b5c2;
  }
  .character {
    animation: type-character 1ms step-end var(--delay) both;
  }
  @keyframes type-character {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .character {
      animation-delay: 1s;
    }
  }
</style>
