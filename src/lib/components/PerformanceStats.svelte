<script lang="ts">
  import type { SimulationStats } from "$lib/black-hole/simulation";
  export let stats: SimulationStats | undefined;
  const mib = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MiB`;
</script>

<h2>Performance</h2>
{#if stats}
  <dl>
    <div>
      <dt>Frame rate</dt>
      <dd>{stats.fps} FPS</dd>
    </div>
    <div>
      <dt>Average frame</dt>
      <dd>{stats.frameMs.toFixed(1)} ms</dd>
    </div>
    <div>
      <dt>Longest frame</dt>
      <dd>{stats.longestFrameMs.toFixed(1)} ms</dd>
    </div>
    <div>
      <dt>CPU render submission</dt>
      <dd>{stats.cpuMs.toFixed(2)} ms</dd>
    </div>
    <div>
      <dt>JS heap used</dt>
      <dd>{stats.heapBytes === null ? "Unavailable" : mib(stats.heapBytes)}</dd>
    </div>
    <div>
      <dt>Render targets (est.)</dt>
      <dd>{mib(stats.renderer.targetBytes)}</dd>
    </div>
    <div>
      <dt>Trace resolution</dt>
      <dd>{stats.renderer.renderWidth} × {stats.renderer.renderHeight}</dd>
    </div>
    <div>
      <dt>Display resolution</dt>
      <dd>{stats.renderer.displayWidth} × {stats.renderer.displayHeight}</dd>
    </div>
    <div>
      <dt>Rays per pixel</dt>
      <dd>
        {stats.renderer
          .samples}{#if stats.renderer.maxSamples > stats.renderer.samples}–{stats
            .renderer.maxSamples}{/if}
      </dd>
    </div>
    <div>
      <dt>Draw calls / frame</dt>
      <dd>{stats.renderer.drawCalls}</dd>
    </div>
    <div>
      <dt>GPU textures</dt>
      <dd>{stats.renderer.textures}</dd>
    </div>
  </dl>
  <p>
    Updates every 0.75 s. CPU submission excludes GPU execution. Render-target
    memory excludes driver and display buffers; JS heap is browser-reported and
    may include other pages.
  </p>
{:else}
  <p>Waiting for the first frames…</p>
{/if}

<style>
  h2 {
    margin: 0 0 20px;
    font-size: 14px;
    font-weight: 500;
  }
  dl {
    margin: 0;
  }
  dl div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 8px 0;
  }
  dt {
    color: #aaa7af;
    font-size: 12px;
  }
  dd {
    margin: 0;
    font: 11px var(--mono);
    white-space: nowrap;
  }
  p {
    margin: 16px 0 0;
    border-top: 1px solid var(--border);
    padding-top: 14px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.6;
  }
</style>
