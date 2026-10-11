<script lang="ts">
  import { scale } from 'svelte/transition';
  import { backOut, elasticOut } from 'svelte/easing';
  import { catSvg } from '../../art/cats';
  import type { GameSession } from '../../app/session.svelte';
  import { app } from '../../app/store.svelte';
  import { turnsWord } from '../../app/text';
  import { nextLevel } from '../../levels';
  import Icon from '../Icon.svelte';
  import Modal from '../Modal.svelte';

  let { session, onnext, onshelter }: { session: GameSession; onnext: () => void; onshelter: () => void } = $props();
  const r = $derived(session.result!);
  const rules = $derived(session.def.stars);
  const next = $derived(nextLevel(session.def.id));
  const titles = ['', 'Спасено!', 'Отлично!', 'Великолепно!'];
</script>

<div class="confetti" aria-hidden="true">
  {#each Array(22) as _, i}
    <span
      class="bit {['heart', 'star', 'paw'][i % 3]}"
      style:left="{(i * 37) % 100}%"
      style:animation-delay="{(i % 7) * 0.12}s"
      style:animation-duration="{2.2 + (i % 5) * 0.25}s"
      style:--drift="{((i * 53) % 80) - 40}px"
      style:color={['#f29aa3', '#ffcf5a', '#f2a65a', '#8fd0b4', '#c4b5ef'][i % 5]}
    >
      <Icon name={(['heart', 'star', 'paw'] as const)[i % 3]} size={14 + (i % 4) * 5} />
    </span>
  {/each}
</div>

<Modal label="Уровень пройден" width={460} dismissable={false}>
  <div class="win">
    <div class="ribbon">{titles[r.stars]}</div>
    <div class="stars">
      {#each [1, 2, 3] as k, i}
        <span class="star" class:on={r.stars >= k} class:mid={k === 2} in:scale={{ delay: 250 + i * 260, duration: 700, start: 0.2, easing: elasticOut }}>
          <Icon name="star" size={k === 2 ? 64 : 50} />
        </span>
      {/each}
    </div>

    <div class="cats">
      {#each session.def.cats as c, i (c.id)}
        <div class="cat" in:scale={{ delay: 500 + i * 140, duration: 420, easing: backOut }}>
          {@html catSvg(c.look, 'sit', { size: 92, uid: `win${c.id}` })}
          <span class="name">{c.name}</span>
        </div>
      {/each}
    </div>

    <ul class="stats">
      <li class:ok={r.checks.rescue}>
        <Icon name="heart" size={18} /> <span>Спасено котиков</span><b>{r.rescued}/{r.total}</b>
      </li>
      <li class:ok={r.checks.turns}>
        <Icon name="star" size={18} /> <span>Ходов: {r.turns} <small>(2 звезды — до {rules.twoStarTurns})</small></span><b>{#if r.checks.turns}<Icon name="check" size={18} />{/if}</b>
      </li>
      <li class:ok={r.checks.efficiency}>
        <Icon name="star" size={18} />
        <span>Предметов: {r.itemsUsed} <small>(3 звезды — до {turnsWord(rules.threeStarTurns)} и {rules.threeStarItems} предм.)</small></span>
        <b>{#if r.checks.efficiency}<Icon name="check" size={18} />{/if}</b>
      </li>
    </ul>
    <p class="note">Котики отправятся в приют — там их уже ждут тёплые лежанки.</p>

    <div class="btns">
      {#if next}
        <button class="btn primary" onclick={onnext} disabled={!app.isUnlocked(next.id)}><Icon name="next" /> Дальше</button>
      {:else}
        <button class="btn primary" onclick={onshelter}><Icon name="shelter" /> В приют</button>
      {/if}
      <div class="row">
        <button class="btn small" onclick={() => session.restart()}><Icon name="restart" size={20} /> Ещё раз</button>
        <button class="btn small" onclick={() => session.startReplay()}><Icon name="film" size={20} /> Повтор</button>
        {#if next}<button class="btn small" onclick={onshelter}><Icon name="shelter" size={20} /> Приют</button>{/if}
      </div>
    </div>
  </div>
</Modal>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    z-index: 60;
    pointer-events: none;
    overflow: hidden;
  }
  .bit {
    position: absolute;
    top: -40px;
    opacity: 0;
    animation: fall linear forwards;
  }
  @keyframes fall {
    0% {
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      transform: translate(var(--drift), 105vh) rotate(320deg);
      opacity: 0;
    }
  }
  .win {
    display: grid;
    justify-items: center;
    gap: 14px;
    text-align: center;
  }
  .ribbon {
    font-size: 30px;
    font-weight: 900;
    color: #fff;
    background: linear-gradient(180deg, #f8b671, var(--orange));
    padding: 6px 30px;
    border-radius: 16px;
    box-shadow: 0 4px 0 var(--orange-dark);
    text-shadow: 0 2px 0 rgba(150, 80, 20, 0.35);
    transform: rotate(-2deg);
  }
  .stars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    color: #eadfce;
  }
  .star.on {
    color: var(--gold);
    filter: drop-shadow(0 3px 0 var(--gold-dark));
  }
  .star.mid {
    transform: translateY(-8px);
  }
  .cats {
    display: flex;
    gap: 4px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .cat {
    display: grid;
    justify-items: center;
  }
  .name {
    font-weight: 900;
    font-size: 14px;
    margin-top: -6px;
  }
  .stats {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: grid;
    gap: 6px;
  }
  .stats li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 14px;
    background: #f6ede1;
    font-weight: 700;
    text-align: left;
    color: var(--ink-faint);
  }
  .stats li span {
    flex: 1;
  }
  .stats li.ok {
    background: var(--mint-soft);
    color: var(--ink);
  }
  .stats li.ok :global(svg) {
    color: var(--gold-dark);
  }
  .stats b {
    display: grid;
    place-items: center;
    min-width: 24px;
    color: var(--mint-dark);
  }
  .stats li.ok b :global(svg) {
    color: var(--mint-dark);
  }
  .stats small {
    font-weight: 600;
    color: var(--ink-soft);
  }
  .note {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .btns {
    display: grid;
    gap: 10px;
    width: 100%;
  }
  .btns > .btn {
    width: 100%;
    min-height: 54px;
    font-size: 19px;
  }
  .row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
</style>
