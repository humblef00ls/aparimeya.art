<script lang="ts">
  import { onMount } from "svelte";

  const title = "Hello World";
  const name = "I am Aparimeya";
  const characterInterval = 67.5;
  let titleText: HTMLSpanElement;
  let nameText: HTMLSpanElement;
  let nameScale = 1;
  let titleCharacters = 0;
  let nameCharacters = 0;

  onMount(() => {
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    function typeLine(
      text: string,
      delay: number,
      reveal: (count: number) => void,
    ) {
      if (reducedMotion) {
        timers.push(setTimeout(() => reveal(text.length), 1000));
        return;
      }
      for (let i = 0; i < text.length; i++) {
        timers.push(
          setTimeout(() => reveal(i + 1), delay + i * characterInterval),
        );
      }
    }
    // Revealed letters stay visible independently of layout and animation repainting.
    typeLine(title, 2800, (count) => (titleCharacters = count));
    typeLine(name, 3950, (count) => (nameCharacters = count));
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
      timers.forEach(clearTimeout);
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
          class:visible={i < titleCharacters}>{character}</span
        >{/each}
    </span>
  </h1>
  <p aria-label={name}>
    <span bind:this={nameText} aria-hidden="true">
      {#each [...name] as character, i}<span
          class="character"
          class:visible={i < nameCharacters}>{character}</span
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
      400 min(clamp(42px, 6vw, 60px), calc((100vw - 40px) / 8)) / 1.3 Yigdresil,
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
    visibility: hidden;
  }
  .character.visible {
    visibility: visible;
  }
</style>
