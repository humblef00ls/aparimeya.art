<script lang="ts">
  import { onMount } from "svelte";

  const title = "Hello World";
  const name = "I am Aparimeya";
  const characterInterval = 67.5;
  let titleCharacters = 0;
  let nameCharacters = 0;

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function typeLine(text: string, delay: number, reveal: (count: number) => void) {
      if (reducedMotion) {
        timers.push(setTimeout(() => reveal(text.length), 1000));
        return;
      }
      for (let i = 0; i < text.length; i++) {
        timers.push(setTimeout(() => reveal(i + 1), delay + i * characterInterval));
      }
    }
    // Mounted on the first frame: 1.8 s entrance, then a 1 s pause.
    typeLine(title, 2800, (count) => (titleCharacters = count));
    typeLine(name, 3950, (count) => (nameCharacters = count));
    return () => timers.forEach(clearTimeout);
  });
</script>

<svelte:head>
  <link rel="preload" href="/fonts/yigdresil.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<header class="greeting">
  <h1 class="accessible">{title}</h1>
  <p class="accessible">{name}</p>
  <svg viewBox="0 0 600 600" aria-hidden="true">
    <defs>
      <!-- Opposite sweeps keep both lines upright around the same center. -->
      <path id="greeting-top" d="M 100 300 A 200 200 0 0 1 500 300" />
      <path id="greeting-bottom" d="M 100 300 A 200 200 0 0 0 500 300" />
    </defs>
    <text class="title" text-anchor="middle">
      <textPath href="#greeting-top" startOffset="50%" textLength="320" lengthAdjust="spacingAndGlyphs">{#each [...title] as character, i}<tspan class="character" class:visible={i < titleCharacters}>{character}</tspan>{/each}</textPath>
    </text>
    <text class="name" text-anchor="middle">
      <textPath href="#greeting-bottom" startOffset="50%" textLength="320" lengthAdjust="spacingAndGlyphs">{#each [...name] as character, i}<tspan class="character" class:visible={i < nameCharacters}>{character}</tspan>{/each}</textPath>
    </text>
  </svg>
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
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: #fff;
    font: 400 48px / 1.3 Yigdresil, Georgia, "Times New Roman", serif;
  }
  svg {
    width: min(94vw, 94dvh, 800px);
    height: auto;
    overflow: visible;
    fill: currentColor;
  }
  .title { opacity: 0.8; }
  .name { opacity: 0.4; }
  .accessible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Hidden glyphs retain their advance, so typing never recenters the line. */
  .character { visibility: hidden; }
  .character.visible { visibility: visible; }
</style>
