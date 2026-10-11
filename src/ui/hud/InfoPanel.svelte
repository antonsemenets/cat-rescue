<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { GameSession } from '../../app/session.svelte';
  import { catSenses, catStatus, FOOD_NAMES, gateWords, NOISE_ACTION, TRAITS, turnsWord } from '../../app/text';
  import { validRotateDirs } from '../../core/trapSystem';
  import { turnsUntilNoise } from '../../core/world';
  import CatPortrait from '../CatPortrait.svelte';
  import Icon from '../Icon.svelte';

  let { session }: { session: GameSession } = $props();
  const sel = $derived(session.selection);
  const s = $derived(session.state);
  const DIR_NAMES = { N: 'вверх-вправо', E: 'вниз-вправо', S: 'вниз-влево', W: 'вверх-влево' } as const;
  const NOISE_NAMES = { mower: 'Газонокосилка', radio: 'Радио', chimes: 'Колокольчики' } as const;
</script>

{#if sel}
  {#key sel.kind + sel.id}
    <aside class="panel card" in:fly={{ y: 16, duration: 220 }}>
      <button class="close" onclick={() => (session.selection = null, session.refresh())} aria-label="Закрыть"><Icon name="close" size={18} /></button>
      {#if sel.kind === 'cat'}
        {@const cat = s.cats.find((c) => c.id === sel.id)}
        {@const def = session.def.cats.find((c) => c.id === sel.id)}
        {#if cat && def}
          <div class="head">
            <CatPortrait look={def.look} size={58} uid="info{cat.id}" ring="#{session.catColor(cat.id).toString(16).padStart(6, '0')}" />
            <div>
              <h3>{cat.name}</h3>
              <p class="persona">{def.personality}</p>
            </div>
          </div>
          <p class="status">{catStatus(cat, s)}</p>
          <div class="traits">
            {#each TRAITS as t}
              <div class="trait" title={t.tip}>
                <span>{t.name}</span>
                <span class="pips">
                  {#each [1, 2, 3] as k}<i class:on={cat[t.key] >= k} class={t.key}></i>{/each}
                </span>
              </div>
            {/each}
          </div>
          <ul class="senses">
            {#each catSenses(cat, s) as line}<li>{line}</li>{/each}
            {#if cat.preferredFood && !cat.picky}<li>Любимое угощение — {FOOD_NAMES[cat.preferredFood]}</li>{/if}
          </ul>
        {/if}
      {:else if sel.kind === 'trap'}
        {@const t = s.traps.find((x) => x.id === sel.id)}
        {#if t}
          <h3>Котоловушка</h3>
          <p class="status">
            {#if t.occupiedBy}Внутри сидит {s.cats.find((c) => c.id === t.occupiedBy)?.name} — в безопасности!
            {:else if t.bait}Приманка: {FOOD_NAMES[t.bait]}. Вход смотрит {DIR_NAMES[t.dir]}.
            {:else}Пустая. Вход смотрит {DIR_NAMES[t.dir]}.{/if}
          </p>
          <ul class="senses">
            <li>Кошка заходит только через дверцу и закрывается, наступив на дальнюю половину.</li>
            {#if !t.rotatable}<li>Эта ловушка закреплена.</li>{/if}
          </ul>
          {#if t.rotatable && !t.occupiedBy && validRotateDirs(s, t.id).length}
            <button class="btn small" onclick={() => session.startRotate(t.id)}>Повернуть вход</button>
          {/if}
        {/if}
      {:else if sel.kind === 'gate'}
        {@const g = s.gates.find((x) => x.id === sel.id)}
        {#if g}
          {@const w = gateWords(session.def.location)}
          <h3>{w.title}</h3>
          <p class="status">{g.open ? (g.autoClose ? `${w.open}, ${w.slams} через ${turnsWord(Math.max(1, g.openTimer))}` : w.open) : `${w.closed} — кошки не пройдут`}</p>
          {#if g.autoClose}<ul class="senses"><li>{w.spring(g.autoClose)}</li></ul>{/if}
          <button class="btn small primary" disabled={s.status !== 'playing'} onclick={() => session.quickAction({ type: 'interact', objectId: g.id })}>
            {g.open ? 'Закрыть' : 'Открыть'} · 1 ход
          </button>
        {/if}
      {:else if sel.kind === 'noise'}
        {@const n = s.noises.find((x) => x.id === sel.id)}
        {#if n}
          {@const until = turnsUntilNoise(n, s.turn)}
          <h3>{NOISE_NAMES[n.kind]}</h3>
          <p class="status">
            {#if n.active}Шумит прямо сейчас!
            {:else if until === 1}Зашумит на следующем ходу
            {:else if until !== null}Зашумит через {turnsWord(until)}
            {:else}Сейчас молчит{/if}
          </p>
          <ul class="senses">
            <li>Пугает кошек в радиусе {n.radius} клеток — они убегают в ближайшее укрытие.</li>
            {#if n.schedule}<li>Шумит {turnsWord(n.schedule.duration)}{n.schedule.every ? `, повторяется каждые ${n.schedule.every}` : ''}.</li>{/if}
          </ul>
          {#if n.interactive}
            <button class="btn small primary" onclick={() => session.quickAction({ type: 'interact', objectId: n.id })}>{NOISE_ACTION[n.kind] ?? 'Включить'} · 1 ход</button>
          {/if}
        {/if}
      {:else if sel.kind === 'food'}
        {@const f = s.foods.find((x) => x.id === sel.id)}
        {#if f}
          {#if f.ttl > 50}
            <h3>Миска соседки</h3>
            <p class="status">{f.kind === 'tuna' ? 'Тунец' : 'Корм'} — стоит тут давно и не испортится. Кто съест, станет доверчивее, но и сытее.</p>
          {:else}
            <h3>{f.kind === 'tuna' ? 'Тунец' : 'Корм'}</h3>
            <p class="status">Испортится через {turnsWord(f.ttl)}</p>
          {/if}
        {/if}
      {:else if sel.kind === 'toy'}
        {@const t = s.toys.find((x) => x.id === sel.id)}
        {#if t}
          <h3>Игрушка</h3>
          <p class="status">Будет крутиться ещё {turnsWord(t.ttl)}</p>
        {/if}
      {/if}
    </aside>
  {/key}
{/if}

<style>
  .panel {
    position: absolute;
    left: 12px;
    bottom: calc(118px + var(--safe-bottom));
    width: 310px;
    padding: 14px 16px 16px;
    z-index: 11;
    display: grid;
    gap: 8px;
    border-radius: 22px;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink-soft);
  }
  .close:hover {
    background: #f6eadb;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h3 {
    font-size: 20px;
    font-weight: 900;
  }
  .persona {
    font-size: 13px;
    font-weight: 700;
    color: var(--orange-dark);
  }
  .status {
    font-weight: 800;
    font-size: 14.5px;
    background: #f8efe3;
    border-radius: 12px;
    padding: 8px 10px;
  }
  .traits {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  .trait {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-soft);
  }
  .pips {
    display: flex;
    gap: 3px;
  }
  .pips i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #eadfce;
  }
  .pips i.on.hunger {
    background: var(--orange);
  }
  .pips i.on.fear {
    background: var(--lilac);
  }
  .pips i.on.curiosity {
    background: var(--rose);
  }
  .pips i.on.trust {
    background: var(--mint);
  }
  .senses {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-soft);
    display: grid;
    gap: 2px;
  }
  @media (max-width: 640px) {
    .panel {
      left: 8px;
      right: 8px;
      width: auto;
      bottom: calc(96px + var(--safe-bottom));
      padding: 12px 14px;
    }
    .traits {
      gap: 2px 10px;
    }
  }
  /* phone held sideways: bottom-left, next to the zoom buttons, scrolls if tall */
  @media (max-height: 500px) and (orientation: landscape) {
    .panel {
      left: calc(56px + var(--safe-left));
      right: auto;
      bottom: 8px;
      width: 260px;
      max-height: calc(100% - var(--top) - 16px);
      overflow-y: auto;
      padding: 10px 12px;
      gap: 6px;
      border-radius: 18px;
    }
    h3 {
      font-size: 16px;
    }
    .head {
      gap: 8px;
    }
    .head :global(.portrait) {
      width: 42px !important;
      height: 42px !important;
    }
    .persona {
      font-size: 12px;
    }
    .status {
      font-size: 12.5px;
      padding: 5px 8px;
    }
    .trait {
      font-size: 11.5px;
    }
    .senses {
      font-size: 11.5px;
    }
  }
</style>
