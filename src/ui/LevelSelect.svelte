<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { app } from '../app/store.svelte';
  import { LOCATION_NAMES } from '../app/text';
  import { audio } from '../audio/audio';
  import { totalStars } from '../persistence/save';
  import { CHAPTERS, LEVELS } from '../levels';
  import CatPortrait from './CatPortrait.svelte';
  import Icon from './Icon.svelte';

  const stars = $derived(totalStars(app.save));
  const chapters = CHAPTERS.map((c) => ({ ...c, levels: LEVELS.filter((l) => l.order >= c.from && l.order <= c.to) })).filter((c) => c.levels.length > 0);
  const chapterStars = (ids: string[]) => ids.reduce((n, id) => n + (app.save.levels[id]?.stars ?? 0), 0);

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

  {#each chapters as ch, ci (ch.from)}
    {@const chOpen = app.isUnlocked(ch.levels[0].id)}
    <section class="chapter" class:closed={!chOpen}>
      <div class="ch-head">
        <span class="ch-num">Глава {ci + 1}</span>
        <div class="ch-ttl">
          <h2>{ch.title}</h2>
          <p>{ch.subtitle}</p>
        </div>
        <span class="ch-stars"><Icon name="star" size={16} /> {chapterStars(ch.levels.map((l) => l.id))}/{ch.levels.length * 3}</span>
      </div>
      <div class="grid">
        {#each ch.levels as l, i (l.id)}
          {@const prog = app.save.levels[l.id]}
          {@const unlocked = app.isUnlocked(l.id)}
          <button
            class="lvl card"
            class:locked={!unlocked}
            class:done={prog?.completed}
            onclick={() => open(l.id)}
            in:fly={{ y: 24, delay: Math.min(i, 9) * 40 + (ci === 0 ? 0 : 120), duration: 380, easing: backOut }}
            aria-label="Уровень {l.order}: {l.title}{unlocked ? '' : ' (закрыт)'}"
          >
            <div class="top">
              <span class="num">{l.order}</span>
              <span class="loc {l.location}">{LOCATION_NAMES[l.location]}</span>
            </div>
            <h3>{l.title}</h3>
            <p>{l.subtitle}</p>
            <div class="cats">
              {#each l.cats as c (c.id)}
                <CatPortrait look={c.look} size={c.look.kitten ? 32 : 40} uid="ls{c.id}" dim={!app.save.rescued[c.id]} />
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
    </section>
  {/each}
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
    padding: calc(16px + var(--safe-top)) calc(16px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(16px + var(--safe-left));
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
  .chapter {
    max-width: 980px;
    margin: 0 auto 26px;
  }
  .ch-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 2px 12px;
  }
  .ch-num {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fff;
    padding: 5px 11px;
    border-radius: 99px;
    background: linear-gradient(160deg, #9fd6bf, var(--mint-dark));
    box-shadow: 0 2px 0 #3c8a6d;
  }
  .chapter.closed .ch-num {
    background: #cdbfae;
    box-shadow: 0 2px 0 #b3a494;
  }
  .ch-ttl {
    flex: 1;
    min-width: 0;
    line-height: 1.15;
  }
  .ch-ttl h2 {
    font-size: 21px;
    font-weight: 900;
  }
  .ch-ttl p {
    font-size: 13px;
  }
  .ch-stars {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 900;
    font-size: 14px;
    color: var(--ink-soft);
  }
  .ch-stars :global(svg) {
    color: var(--gold-dark);
  }
  .grid {
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
  .loc.market {
    background: #fbefd2;
    color: #b07d22;
  }
  .loc.dacha {
    background: #efe6f7;
    color: #8a6aae;
  }
  .loc.quay {
    background: #def0f6;
    color: #3f8aa6;
  }
  h3 {
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
    h3 {
      font-size: 16px;
    }
    p {
      font-size: 12.5px;
    }
    .ch-ttl h2 {
      font-size: 18px;
    }
    .ch-ttl p {
      font-size: 12px;
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
  @media (max-height: 500px) and (orientation: landscape) {
    .screen {
      padding-top: calc(10px + var(--safe-top));
    }
    header {
      margin-bottom: 10px;
    }
    h1 {
      font-size: 22px;
    }
    .grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .lvl {
      padding: 10px 12px;
      min-height: 0;
      gap: 5px;
    }
    h3 {
      font-size: 15.5px;
    }
    p {
      font-size: 12px;
    }
    .chapter {
      margin-bottom: 16px;
    }
    .ch-head {
      margin-bottom: 8px;
    }
    .ch-ttl h2 {
      font-size: 17px;
    }
    .num {
      width: 30px;
      height: 30px;
      font-size: 15px;
      border-radius: 11px;
    }
    .cats :global(.portrait) {
      width: 32px !important;
      height: 32px !important;
    }
  }
</style>
