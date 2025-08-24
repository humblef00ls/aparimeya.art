<script lang="ts">
  import { onMount } from "svelte";
  import { Scene } from "$lib";

  import "../global.css";

  onMount(async () => {
    try {
      // Call the greeting endpoint to test the backend
      const response = await fetch("/api/greeting");
      const data = await response.json();

      console.log("Backend greeting response:", data);
      console.log("Environment:", data.environment);
      console.log("Platform:", data.platform);
      console.log("Cloudflare info:", data.cf);
    } catch (error) {
      console.error("Failed to fetch greeting:", error);
    }
  });
</script>

<Scene />
