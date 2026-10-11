<script lang="ts">
  import { TOOL_ART } from '../../art/toolIcons';
  import type { GameSession, Tool } from '../../app/session.svelte';
  import { ITEM_NAMES } from '../../app/text';
  import Icon from '../Icon.svelte';

  let { session, height = $bindable(0), width = $bindable(0) }: { session: GameSession; height?: number; width?: number } = $props();

  const LABELS: Record<Tool, string> = {
    trap: 'Ловушка',
    rotate: 'Повернуть',
    kibble: ITEM_NAMES.kibble,
    tuna: ITEM_NAMES.tuna,
    box: ITEM_NAMES.box,
    toy: ITEM_NAMES.toy,
    hand: 'Лапка',
  };
  const tools = $derived(session.availableTools());
  let toolsEl: HTMLDivElement;
  let fadeR = $state(false);
  let fadeL = $state(false);
  let fadeT = $state(false);
  let fadeB = $state(false);
  // hint at more tools beyond the edge: the row scrolls sideways at the bottom,
  // the side column (phone held sideways) scrolls vertically
  function updateFade() {
    if (!toolsEl) return;
    const e = toolsEl;
    fadeL = e.scrollLeft > 4;
    fadeR = e.scrollLeft + e.clientWidth < e.scrollWidth - 4;
    fadeT = e.scrollTop > 4;
    fadeB = e.scrollTop + e.clientHeight < e.scrollHeight - 4;
  }
  $effect(() => {
    void tools.length;
    updateFade();
    const ro = new ResizeObserver(updateFade);
    ro.observe(toolsEl);
    return () => ro.disconnect();
  });
</script>

<div class="toolbar" class:raised={session.briefing} bind:clientHeight={height} bind:clientWidth={width}>
  <div
    class="tools"
    role="toolbar"
    aria-label="Инструменты"
    bind:this={toolsEl}
    onscroll={updateFade}
    class:fade-r={fadeR}
    class:fade-l={fadeL}
    class:fade-t={fadeT}
    class:fade-b={fadeB}
  >
    {#each tools as t, i (t)}
      {@const count = session.toolCount(t)}
      {@const off = !!session.toolDisabledReason(t)}
      <button
        class="tool"
        class:active={session.tool === t}
        class:focus={session.focusTool === t}
        class:off
        onclick={() => session.selectTool(t)}
        aria-pressed={session.tool === t}
        aria-label="{LABELS[t]}{count !== null ? `, осталось ${count}` : ''}"
        title="{LABELS[t]} ({i + 1})"
      >
        <span class="art">{@html TOOL_ART[t]}</span>
        <span class="lbl">{LABELS[t]}</span>
        {#if count !== null}<span class="count" class:zero={count === 0}>{count}</span>{/if}
      </button>
    {/each}
  </div>
  <button class="skip" onclick={() => session.skip()} disabled={session.state.status !== 'playing' || session.replaying} title="Пропустить ход (пробел)">
    <Icon name="skip" size={26} />
    <span>Ждать</span>
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    left: 50%;
    bottom: calc(10px + var(--safe-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 8px;
    border-radius: 26px;
    background: rgba(255, 250, 243, 0.92);
    backdrop-filter: blur(6px);
    box-shadow: var(--shadow);
    max-width: calc(100vw - 16px);
    z-index: 10;
  }
  .tools {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    /* a scroll container clips everything that sticks out: leave room for the
       count badges, the lifted active tool and Sasha's focus ring */
    padding: 18px 12px 10px;
    margin: -18px -12px -10px;
  }
  .tools::-webkit-scrollbar {
    display: none;
  }
  .tools.fade-r {
    mask-image: linear-gradient(90deg, #000 85%, transparent);
  }
  .tools.fade-l {
    mask-image: linear-gradient(90deg, transparent, #000 15%);
  }
  .tools.fade-l.fade-r {
    mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent);
  }
  .tool {
    position: relative;
    width: 76px;
    min-width: 76px;
    height: 84px;
    border-radius: 18px;
    display: grid;
    grid-template-rows: 1fr auto;
    justify-items: center;
    align-items: center;
    padding: 6px 4px 7px;
    background: #fff;
    box-shadow: 0 3px 0 #ead6bd;
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease,
      background 0.12s;
  }
  .tool:hover:not(.off) {
    transform: translateY(-2px);
  }
  .tool:active:not(.off) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 #ead6bd;
  }
  .tool.active {
    background: var(--orange-soft);
    box-shadow:
      0 0 0 3px var(--orange),
      0 4px 0 var(--orange-dark);
    transform: translateY(-4px);
  }
  .tool.off {
    opacity: 0.42;
    filter: grayscale(0.7);
  }
  /* while Sasha talks the toolbar floats above her dialog, without taking input */
  .toolbar.raised {
    z-index: 46;
    pointer-events: none;
  }
  .tool.focus {
    opacity: 1;
    filter: none;
    animation: focusPulse 1.1s ease-in-out infinite;
  }
  /* box-shadow only: it never creates extra scroll area, unlike a scaled ring */
  @keyframes focusPulse {
    0%,
    100% {
      transform: translateY(-3px);
      box-shadow:
        0 0 0 3px var(--orange),
        0 0 0 3px rgba(242, 166, 90, 0.6),
        0 3px 0 #ead6bd;
    }
    50% {
      transform: translateY(-6px);
      box-shadow:
        0 0 0 3px var(--orange),
        0 0 0 10px rgba(242, 166, 90, 0),
        0 8px 16px rgba(242, 166, 90, 0.45);
    }
  }
  .art {
    display: grid;
    place-items: center;
    height: 46px;
  }
  .art :global(svg) {
    width: 52px;
    height: 44px;
  }
  .lbl {
    font-size: 12px;
    font-weight: 800;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .count {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 26px;
    height: 26px;
    border-radius: 13px;
    padding: 0 7px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 14px;
    color: #fff;
    background: var(--mint-dark);
    box-shadow: 0 2px 0 #3c8a6d;
  }
  .count.zero {
    background: #c9b9a8;
    box-shadow: none;
  }
  .skip {
    min-width: 88px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    font-weight: 900;
    font-size: 14px;
    color: #fff;
    background: linear-gradient(180deg, #a4dcc3, var(--mint));
    box-shadow: 0 4px 0 var(--mint-dark);
    text-shadow: 0 1px 0 rgba(40, 110, 80, 0.35);
    transition: transform 0.12s ease;
  }
  .skip:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .skip:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--mint-dark);
  }
  .skip:disabled {
    opacity: 0.5;
  }
  @media (max-width: 640px) {
    .toolbar {
      left: 8px;
      right: 8px;
      transform: none;
      gap: 6px;
      padding: 6px;
      border-radius: 22px;
    }
    .tools {
      flex: 1;
    }
    .tool {
      width: 62px;
      min-width: 62px;
      height: 72px;
      border-radius: 16px;
    }
    .art {
      height: 38px;
    }
    .art :global(svg) {
      width: 44px;
      height: 36px;
    }
    .lbl {
      font-size: 10.5px;
    }
    .skip {
      min-width: 66px;
    }
  }

  /* ---- phone held sideways: a slim two-column panel on the right ---- */
  @media (max-height: 500px) and (orientation: landscape) {
    .toolbar {
      left: auto;
      right: calc(8px + var(--safe-right));
      top: calc(var(--top) + 4px);
      bottom: auto;
      transform: none;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
      border-radius: 20px;
      max-width: none;
      max-height: calc(100% - var(--top) - 12px);
    }
    .tools {
      display: grid;
      grid-template-columns: repeat(2, 58px);
      grid-auto-rows: 56px;
      gap: 6px;
      overflow-x: hidden;
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 0;
      padding: 16px 12px 8px;
      margin: -16px -12px -8px;
    }
    .tools.fade-r,
    .tools.fade-l,
    .tools.fade-l.fade-r {
      mask-image: none;
    }
    .tools.fade-b {
      mask-image: linear-gradient(180deg, #000 82%, transparent);
    }
    .tools.fade-t {
      mask-image: linear-gradient(180deg, transparent, #000 18%);
    }
    .tools.fade-t.fade-b {
      mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent);
    }
    .tool {
      width: 58px;
      min-width: 58px;
      height: 56px;
      border-radius: 14px;
      padding: 4px 2px 5px;
    }
    .art {
      height: 30px;
    }
    .art :global(svg) {
      width: 38px;
      height: 30px;
    }
    .lbl {
      font-size: 9.5px;
    }
    .count {
      min-width: 21px;
      height: 21px;
      font-size: 12px;
      padding: 0 5px;
    }
    .skip {
      min-width: 0;
      width: 100%;
      min-height: 46px;
      flex-shrink: 0;
      grid-auto-flow: column;
      gap: 6px;
      font-size: 14px;
      border-radius: 14px;
    }
    .skip :global(svg) {
      width: 20px;
      height: 20px;
    }
  }
</style>
