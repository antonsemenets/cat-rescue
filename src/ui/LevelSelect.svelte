<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { app } from '../app/store.svelte';
  import { LOCATION_NAMES } from '../app/text';
  import { audio } from '../audio/audio';
  import { totalStars } from '../persistence/save';
  import { LEVELS } from '../levels';
  import CatPortrait from './CatPortrait.svelte';
  import Icon from './Icon.svelte';

  const stars = $derived(totalStars(app.save));

  function open(id: string) {
    if (!app.isUnlocked(id)) {
      audio.play('error');
      return;
    }
    audio.play('click');
    app.play(id);
  }
</script>

<div class="screen">
  <header>
    <button class="icon-btn" onclick={() => app.go('menu')} aria-label="Назад в меню"><Icon name="back" /></button>
    <h1>Уровни</h1>
    <span class="total"><Icon name="star" size={20} /> {stars}/{LEVELS.length * 3}</span>
  </header>

  <div class="grid">
    {#each LEVELS as l, i (l.id)}
      {@const prog = app.save.levels[l.id]}
      {@const unlocked = app.isUnlocked(l.id)}
      <button
        class="lvl card"
        class:locked={!unlocked}
        class:done={prog?.completed}
        onclick={() => open(l.id)}
        in:fly={{ y: 24, delay: i * 45, duration: 380, easing: backOut }}
        aria-label="Уровень {l.order}: {l.title}{unlocked ? '' : ' (закрыт)'}"
      >
        <div class="top">
          <span class="num">{l.order}</span>
          <span class="loc {l.location}">{LOCATION_NAMES[l.location]}</span>
        </div>
        <h2>{l.title}</h2>
        <p>{l.subtitle}</p>
        <div class="cats">
          {#each l.cats as c (c.id)}
            <CatPortrait look={c.look} size={40} uid="ls{c.id}" dim={!app.save.rescued[c.id]} />
          {/each}
        </div>
        <div class="stars" aria-label="{prog?.stars ?? 0} из 3 звёзд">
          {#each [1, 2, 3] as k}
            <span class:on={(prog?.stars ?? 0) >= k}><Icon name="star" size={22} /></span>
          {/each}
          {#if prog?.bestTurns}<span class="best">{prog.bestTurns} х.</span>{/if}
        </div>
        {#if !unlocked}
          <div class="lock"><Icon name="lock" size={30} /></div>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .screen {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    background:
      radial-gradient(circle at 15% 0%, #e2f0dc 0, transparent 40%),
      radial-gradient(circle at 90% 10%, #fde3c6 0, transparent 40%),
      var(--cream);
    padding: calc(16px + var(--safe-top)) 16px calc(24px + var(--safe-bottom));
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 980px;
    margin: 0 auto 18px;
  }
  h1 {
    font-size: 30px;
    font-weight: 900;
    flex: 1;
  }
  .total {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 900;
    background: var(--paper);
    padding: 8px 14px;
    border-radius: 99px;
    box-shadow: var(--shadow-sm);
  }
  .total :global(svg) {
    color: var(--gold-dark);
  }
  .grid {
    max-width: 980px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 16px;
  }
  .lvl {
    position: relative;
    text-align: left;
    padding: 16px;
    display: grid;
    gap: 8px;
    align-content: start;
    min-height: 200px;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
    overflow: hidden;
  }
  .lvl:hover:not(.locked) {
    transform: translateY(-3px) rotate(-0.4deg);
  }
  .lvl:active:not(.locked) {
    transform: translateY(1px);
  }
  .lvl.done {
    background: linear-gradient(180deg, #fffaf3, #f3faef);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .num {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 19px;
    color: #fff;
    background: linear-gradient(160deg, #f8b671, var(--orange));
    box-shadow: 0 3px 0 var(--orange-dark);
  }
  .loc {
    font-size: 12px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 99px;
    background: var(--mint-soft);
    color: var(--mint-dark);
  }
  .loc.park {
    background: #e7f2d8;
    color: #6a9a45;
  }
  .loc.garages {
    background: #e6eef5;
    color: #5f7f99;
  }
  .loc.garden {
    background: var(--rose-soft);
    color: var(--rose-dark);
  }
  h2 {
    font-size: 20px;
    font-weight: 900;
    line-height: 1.15;
  }
  p {
    color: var(--ink-soft);
    font-weight: 600;
    font-size: 14px;
  }
  .cats {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  .stars {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #e8dccb;
  }
  .stars .on {
    color: var(--gold);
    filter: drop-shadow(0 1px 0 var(--gold-dark));
  }
  .best {
    margin-left: auto;
    font-size: 13px;
    font-weight: 800;
    color: var(--ink-faint);
  }
  .locked {
    cursor: not-allowed;
  }
  .locked > :not(.lock) {
    opacity: 0.38;
    filter: grayscale(0.6);
  }
  .lock {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--ink-faint);
  }
  @media (max-width: 520px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .lvl {
      padding: 12px;
      min-height: 0;
      gap: 6px;
    }
    h2 {
      font-size: 16px;
    }
    p {
      font-size: 12.5px;
    }
    .num {
      width: 32px;
      height: 32px;
      font-size: 16px;
    }
    .loc {
      font-size: 11px;
      padding: 3px 8px;
    }
  }
</style>
