<script lang="ts">
  import { catPortraitSvg } from '../art/cats';
  import type { CatLook } from '../core/types';

  let { look, size = 56, ring = '#fff', dim = false, uid }: { look: CatLook; size?: number; ring?: string; dim?: boolean; uid: string } = $props();
  const html = $derived(catPortraitSvg(look, size, `p${uid}`));
</script>

<span class="portrait" class:dim style:width="{size}px" style:height="{size}px" style:--ring={ring}>
  {@html html}
</span>

<style>
  .portrait {
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 35%, #fffdf8, #f5e7d4);
    box-shadow:
      0 0 0 3px var(--ring),
      0 3px 8px rgba(76, 59, 58, 0.18);
    overflow: hidden;
    flex-shrink: 0;
  }
  .portrait :global(svg) {
    width: 100%;
    height: 100%;
    transform: translateY(6%);
  }
  .dim :global(svg) {
    filter: grayscale(1) brightness(0.55) opacity(0.5);
  }
</style>
