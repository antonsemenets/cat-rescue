<script lang="ts" module>
  // only the top-most modal reacts to Escape
  const stack: symbol[] = [];
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  let {
    onclose,
    children,
    width = 420,
    label = 'Окно',
    dismissable = true,
  }: { onclose?: () => void; children: Snippet; width?: number; label?: string; dismissable?: boolean } = $props();

  const me = Symbol('modal');
  stack.push(me);
  onDestroy(() => {
    const i = stack.indexOf(me);
    if (i >= 0) stack.splice(i, 1);
  });

  function onkey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || stack[stack.length - 1] !== me) return;
    e.stopPropagation();
    if (dismissable) onclose?.();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="backdrop" transition:fade={{ duration: 160 }} onclick={() => dismissable && onclose?.()} role="presentation">
  <div
    class="sheet card"
    style:max-width="{width}px"
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
    transition:scale={{ duration: 260, start: 0.9, easing: backOut }}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(76, 59, 58, 0.32);
    backdrop-filter: blur(3px);
  }
  .sheet {
    width: 100%;
    max-height: calc(100dvh - 32px);
    overflow: auto;
    padding: 24px;
    border-radius: 28px;
    background: var(--paper);
    outline: none;
  }
</style>
