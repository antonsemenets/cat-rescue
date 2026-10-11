<script lang="ts">
  import type { GameSession } from '../../app/session.svelte';
  import { app } from '../../app/store.svelte';
  import CatPortrait from '../CatPortrait.svelte';
  import Icon from '../Icon.svelte';
  import { SPRITES } from '../../art/sprites';

  let { session, onpause, height = $bindable(0) }: { session: GameSession; onpause: () => void; height?: number } = $props();

  const st = $derived(session.state);
  const rules = $derived(session.def.stars);
  const tier = $derived(st.turn <= rules.threeStarTurns ? 3 : st.turn <= rules.twoStarTurns ? 2 : 1);
  const nextLimit = $derived(tier === 3 ? rules.threeStarTurns : tier === 2 ? rules.twoStarTurns : null);

  function cycleSpeed() {
    const v = (app.settings.animSpeed % 3) + 1;
    app.updateSettings({ animSpeed: v as 1 | 2 | 3 });
  }
</script>

<header class="top" bind:clientHeight={height}>
  <div class="left">
    <button class="icon-btn" onclick={onpause} aria-label="Пауза" title="Пауза (Esc)"><Icon name="pause" /></button>
    <div class="title">
      <span class="lvl">Уровень {session.def.order}</span>
      <span class="name">{session.def.title}</span>
    </div>
  </div>

  <div class="center card" aria-live="polite">
    <span class="turn"><small>Ход</small>{st.turn}</span>
    <span class="tiers" title="Ограничение ходов для звёзд">
      {#each [1, 2, 3] as k}
        <span class="s" class:on={tier >= k}><Icon name="star" size={15} /></span>
      {/each}
      {#if nextLimit !== null}<small>≤ {nextLimit}</small>{/if}
    </span>
    <span class="mini" aria-hidden="true"><Icon name="heart" size={14} /> {st.rescued.length}/{st.cats.length}</span>
  </div>

  <div class="right">
    <div class="rescued" aria-label="Спасено {st.rescued.length} из {st.cats.length}">
      {#each session.def.cats as c (c.id)}
        {@const saved = st.rescued.includes(c.id)}
        <span class="p" class:saved>
          <CatPortrait look={c.look} size={34} uid="hud{c.id}" ring={saved ? '#8fd0b4' : '#fff'} />
          {#if saved}<span class="tick"><Icon name="heart" size={11} /></span>{/if}
        </span>
      {/each}
    </div>
    {#if session.def.intro?.length}
      <button class="icon-btn sasha" onclick={() => session.openBriefing()} disabled={session.replaying || session.briefing || session.state.status !== 'playing'} aria-label="Саша подскажет" title="Саша подскажет">
        <img src={SPRITES['sasha-face']} alt="" />
      </button>
    {/if}
    <button class="icon-btn speed" onclick={cycleSpeed} aria-label="Скорость анимаций" title="Скорость анимаций">{app.settings.animSpeed}×</button>
    <button class="icon-btn" onclick={() => session.undo()} disabled={!session.canUndo || session.replaying} aria-label="Отменить ход" title="Отменить ход (Z)"><Icon name="undo" /></button>
    <button class="icon-btn" onclick={() => session.restart()} disabled={session.state.turn === 0 && !session.replaying} aria-label="Начать заново" title="Заново (Shift+R)"><Icon name="restart" /></button>
  </div>
</header>

<style>
  .top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: calc(10px + var(--safe-top)) calc(12px + var(--safe-right)) 10px calc(12px + var(--safe-left));
    z-index: 10;
    pointer-events: none;
  }
  .top > * {
    pointer-events: auto;
  }
  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .right {
    justify-content: flex-end;
  }
  .title {
    display: grid;
    line-height: 1.1;
    background: rgba(255, 250, 243, 0.85);
    padding: 6px 12px;
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
  }
  .lvl {
    font-size: 12px;
    font-weight: 800;
    color: var(--orange-dark);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .name {
    font-weight: 900;
    font-size: 17px;
    white-space: nowrap;
  }
  .center {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    border-radius: 18px;
  }
  .turn {
    display: grid;
    justify-items: center;
    font-weight: 900;
    font-size: 26px;
    line-height: 1;
    min-width: 34px;
  }
  .turn small {
    font-size: 11px;
    font-weight: 800;
    color: var(--ink-faint);
    text-transform: uppercase;
  }
  .tiers {
    display: flex;
    align-items: center;
    gap: 1px;
    color: #e5d8c6;
  }
  .tiers .on {
    color: var(--gold);
    filter: drop-shadow(0 1px 0 var(--gold-dark));
  }
  .tiers small {
    white-space: nowrap;
    margin-left: 6px;
    font-weight: 800;
    color: var(--ink-soft);
    font-size: 13px;
  }
  .rescued {
    display: flex;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 99px;
    background: rgba(255, 250, 243, 0.85);
    box-shadow: var(--shadow-sm);
  }
  .p {
    position: relative;
    display: inline-grid;
  }
  .p:not(.saved) :global(.portrait) {
    opacity: 0.75;
  }
  .tick {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--rose);
    box-shadow: 0 0 0 2px #fff;
  }
  .speed {
    font-weight: 900;
    font-size: 15px;
  }
  .sasha {
    padding: 0;
    overflow: hidden;
  }
  .sasha img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 16px;
  }
  .mini {
    white-space: nowrap;
    display: none;
    align-items: center;
    gap: 3px;
    font-weight: 900;
    font-size: 14px;
    color: var(--rose-dark);
  }
  @media (max-width: 760px) {
    .title {
      display: none;
    }
    .speed {
      display: none;
    }
  }
  @media (max-width: 480px) {
    .top {
      gap: 6px;
      padding-left: 8px;
      padding-right: 8px;
    }
    .rescued {
      display: none;
    }
    .mini {
      display: inline-flex;
    }
    .center {
      padding: 4px 10px;
      gap: 8px;
    }
    .icon-btn {
      width: 40px;
      height: 40px;
      border-radius: 14px;
    }
    .turn {
      font-size: 22px;
      min-width: 26px;
    }
    .tiers small {
      margin-left: 3px;
      font-size: 12px;
    }
    .left,
    .right {
      gap: 6px;
    }
  }
  /* phone held sideways: one slim row */
  @media (max-height: 500px) and (orientation: landscape) {
    .top {
      padding-top: calc(6px + var(--safe-top));
      padding-bottom: 4px;
      gap: 8px;
    }
    .left,
    .right {
      gap: 6px;
    }
    .icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 13px;
    }
    .title {
      padding: 4px 10px;
      border-radius: 12px;
    }
    .lvl {
      font-size: 10px;
    }
    .name {
      font-size: 14px;
    }
    .center {
      padding: 3px 12px;
      gap: 10px;
      border-radius: 14px;
    }
    .turn {
      font-size: 20px;
      grid-auto-flow: column;
      align-items: baseline;
      gap: 4px;
    }
    .turn small {
      font-size: 10px;
    }
    .rescued {
      padding: 2px 6px;
    }
    .rescued :global(.portrait) {
      width: 28px !important;
      height: 28px !important;
    }
  }
</style>
