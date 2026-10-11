<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { catSvg, type CatPose } from '../art/cats';
  import { app } from '../app/store.svelte';
  import { TRAITS } from '../app/text';
  import { audio } from '../audio/audio';
  import type { CatDef } from '../core/level';
  import { LEVELS } from '../levels';
  import Icon from './Icon.svelte';
  import { ROOMS, roomsOpen, spotFor, type Slot } from './shelterRooms';

  /** kittens curl up smaller than grown cats */
  const KITTEN = 0.84;

  const allCats: (CatDef & { levelTitle: string })[] = LEVELS.flatMap((l) => l.cats.map((c) => ({ ...c, levelTitle: l.title })));
  // dev only: ?shelterdemo=60 fills the house with that many cats to check the rooms
  const demo = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('shelterdemo') ?? 0) : 0;
  const demoCats = Array.from({ length: demo }, (_, i) => {
    const c = allCats[i % allCats.length];
    return { ...c, id: `${c.id}~${i}`, look: { ...c.look, kitten: i % 5 === 3 || c.look.kitten } };
  });
  const rescued = $derived(
    demo
      ? demoCats
      : allCats
          .filter((c) => app.save.rescued[c.id])
          .sort((a, b) => app.save.rescued[a.id].rescuedAt - app.save.rescued[b.id].rescuedAt || allCats.indexOf(a) - allCats.indexOf(b)),
  );
  const rooms = $derived(ROOMS.slice(0, roomsOpen(rescued.length)));
  const placed = $derived(rescued.map((cat, i) => ({ cat, i, ...spotFor(i) })));
  const fresh = new Set(app.freshCats);

  let selected = $state<string | null>(null);
  let happy = $state<Record<string, number>>({});
  let hearts = $state<{ id: number; room: number; x: string; y: number }[]>([]);
  let heartId = 0;
  const sel = $derived(selected ? rescued.find((c) => c.id === selected) : undefined);

  let wrapEl: HTMLDivElement;
  let roomEls: HTMLDivElement[] = $state([]);
  let current = $state(0);

  function scrollToRoom(r: number, smooth = true) {
    const el = roomEls[r];
    if (!wrapEl || !el) return;
    // centre the room (a room wider than the screen opens at its middle, where most cats are)
    const left = el.offsetLeft + (el.offsetWidth - wrapEl.clientWidth) / 2;
    wrapEl.scrollTo({ left, behavior: smooth && !app.settings.reducedMotion ? 'smooth' : 'auto' });
  }

  function onScroll() {
    if (!wrapEl) return;
    const mid = wrapEl.scrollLeft + wrapEl.clientWidth / 2;
    const r = roomEls.findIndex((el) => el && mid >= el.offsetLeft && mid < el.offsetLeft + el.offsetWidth);
    if (r >= 0) current = r;
  }

  onMount(() => {
    // newcomers first: open the room where the freshest cat settled
    const newest = placed.filter((p) => fresh.has(p.cat.id)).at(-1);
    current = newest ? newest.room : 0;
    if (demo) current = Math.min(rooms.length - 1, Number(new URLSearchParams(location.search).get('room') ?? 0));
    // the observer fires once right away, and again whenever the screen turns or resizes
    const ro = new ResizeObserver(() => scrollToRoom(current, false));
    ro.observe(wrapEl);
    return () => ro.disconnect();
  });

  onDestroy(() => {
    app.freshCats = [];
  });

  function pet(id: string, room: number, slot: Slot) {
    audio.unlock();
    audio.play('purr');
    if (selected !== id) {
      selected = id;
      audio.play('meow');
    }
    app.pet(id);
    happy = { ...happy, [id]: Date.now() };
    setTimeout(() => {
      if (Date.now() - (happy[id] ?? 0) >= 1100) {
        const { [id]: _, ...rest } = happy;
        happy = rest;
      }
    }, 1200);
    for (let i = 0; i < 4; i++) {
      const h = { id: ++heartId, room, x: `calc(${slot.x} + ${((i - 1.5) * 3.4).toFixed(1)}cqh)`, y: slot.y - slot.size * 0.9 };
      hearts = [...hearts, h];
      setTimeout(() => (hearts = hearts.filter((q) => q.id !== h.id)), 1300);
    }
  }

  function poseOf(id: string, slot: Slot): CatPose {
    if (happy[id]) return slot.pose === 'sleep' ? 'sleep' : 'groom';
    return slot.pose;
  }
</script>

<div class="shelter">
  <header>
    <button class="icon-btn" onclick={() => app.go('menu')} aria-label="Назад в меню"><Icon name="back" /></button>
    <div class="ttl">
      <h1>Приют «Тёплый дом»</h1>
      <p>Спасено {rescued.length} из {allCats.length}</p>
    </div>
    <button class="btn small primary" onclick={() => app.go('levels')}><Icon name="paw" size={18} /> Спасать</button>
  </header>

  <div class="rooms">
    {#if rooms.length > 1}
      <nav class="tabs" aria-label="Комнаты приюта">
        {#each rooms as r, ri (r.id)}
          {@const count = placed.filter((p) => p.room === ri).length}
          <button class:on={current === ri} onclick={() => scrollToRoom(ri)} aria-current={current === ri}>
            {r.name}<span>{count}</span>
          </button>
        {/each}
      </nav>
    {/if}

  <div class="room-wrap" bind:this={wrapEl} onscroll={onScroll}>
    <div class="house">
      {#each rooms as room, ri (room.id)}
        <div class="stage" bind:this={roomEls[ri]} style:--wall={room.wall} style:--floor={room.floor} style:--board={room.baseboard ?? '#fff4e4'}>
          <div class="wall"></div>
          <div class="floor"></div>
          <div class="baseboard"></div>
          {#if ri > 0}<div class="doorway" aria-hidden="true"></div>{/if}

          {#each room.decor as d}
            <div class="decor" style:left={d.x} style:top="{d.y}%" style:height="{d.h}cqh" style:width={d.w} style:aspect-ratio={d.w ? null : d.ar}>{@html d.svg}</div>
          {/each}

          {#each placed.filter((p) => p.room === ri) as { cat, i, slot } (cat.id)}
            {@const pose = poseOf(cat.id, slot)}
            <button
              class="cat pose-{pose}"
              class:sel={selected === cat.id}
              class:flip={slot.flip}
              style:left={slot.x}
              style:top="{slot.y}%"
              style:--size="{slot.size * (cat.look.kitten ? KITTEN : 1)}cqh"
              style:--delay="{-i * 0.7}s"
              onclick={() => pet(cat.id, ri, slot)}
              aria-label="{cat.name} — погладить"
              in:scale={{ delay: 120 + (i % 12) * 90, duration: 420, easing: backOut, start: 0.6 }}
            >
              {@html catSvg(cat.look, pose, { size: 128, uid: `sh${cat.id}${pose}`, hooks: true })}
              {#if fresh.has(cat.id)}<span class="new">{cat.look.kitten ? 'Малыш!' : 'Новенький!'}</span>{/if}
              {#if selected === cat.id}<span class="tag">{cat.name}</span>{/if}
            </button>
          {/each}

          {#each hearts.filter((h) => h.room === ri) as h (h.id)}
            <span class="heart" style:left={h.x} style:top="{h.y}%"><Icon name="heart" size={26} /></span>
          {/each}

          {#if rescued.length === 0}
            <div class="empty card" in:fly={{ y: 20 }}>
              <h2>Здесь пока тихо…</h2>
              <p>Лежанки уже взбиты, миски наполнены. Спасите первого котика — и он появится здесь.</p>
              <button class="btn primary" onclick={() => app.play(app.nextToPlay())}><Icon name="play" /> К спасению</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
  </div>

  {#if sel}
    {#key sel.id}
      {@const spot = placed.find((p) => p.cat.id === sel.id)}
      <aside class="card-sheet card" in:fly={{ y: 30, duration: 260, easing: backOut }}>
        <button class="close" onclick={() => (selected = null)} aria-label="Закрыть"><Icon name="close" size={18} /></button>
        <div class="row">
          <div class="mini">{@html catSvg(sel.look, 'sit', { size: 96, uid: `card${sel.id}` })}</div>
          <div>
            <h2>{sel.name}</h2>
            <p class="persona">{sel.personality}</p>
            <p class="from">История спасения: «{sel.levelTitle}»</p>
          </div>
        </div>
        <p class="bio">{sel.bio}</p>
        <div class="traits">
          {#each TRAITS as t}
            <div class="trait"><span>{t.name}</span><span class="pips">{#each [1, 2, 3] as k}<i class:on={sel.traits[t.key] >= k} class={t.key}></i>{/each}</span></div>
          {/each}
        </div>
        <div class="pet-row">
          <span class="pets"><Icon name="heart" size={18} /> Поглажено: {app.save.rescued[sel.id]?.pets ?? 0}</span>
          {#if spot}
            <button class="btn small rose" onclick={() => pet(sel.id, spot.room, spot.slot)}>
              <Icon name="paw" size={18} /> Погладить
            </button>
          {/if}
        </div>
      </aside>
    {/key}
  {/if}
</div>

<style>
  .shelter {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #f3dfc6;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(12px + var(--safe-top)) calc(14px + var(--safe-right)) 12px calc(14px + var(--safe-left));
    background: var(--cream-2);
    box-shadow: 0 2px 0 var(--line);
    z-index: 3;
  }
  .ttl {
    flex: 1;
    line-height: 1.15;
  }
  h1 {
    font-size: 22px;
    font-weight: 900;
  }
  .ttl p {
    font-weight: 700;
    color: var(--ink-soft);
    font-size: 14px;
  }
  .rooms {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .room-wrap {
    flex: 1;
    min-height: 0;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    scrollbar-width: thin;
    overscroll-behavior-x: contain;
    container-type: size;
  }
  .house {
    display: flex;
    height: 100%;
    width: max-content;
  }
  /* each room always fills the width; narrow screens get a wider-than-screen
     room that scrolls sideways instead of empty margins */
  .stage {
    position: relative;
    flex-shrink: 0;
    height: 100%;
    width: max(100cqw, 158cqh);
    container-type: size;
    overflow: hidden;
  }
  .wall {
    position: absolute;
    inset: 0 0 38% 0;
    background: var(--wall);
  }
  .floor {
    position: absolute;
    inset: 62% 0 0 0;
    background: var(--floor);
  }
  .baseboard {
    position: absolute;
    left: 0;
    right: 0;
    top: 60.5%;
    height: 2.4%;
    background: var(--board);
    border-top: 3px solid #e8cfae;
    border-bottom: 3px solid #b98a62;
  }
  /* a soft door frame where one room flows into the next */
  .doorway {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2.2cqh;
    background: linear-gradient(90deg, #b98a62, #d9b48c 40%, #f3dfc6);
    box-shadow: 4px 0 10px rgba(90, 60, 40, 0.18);
    z-index: 1;
  }
  .decor {
    position: absolute;
    translate: -50% 0;
  }
  .decor :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .tabs {
    position: absolute;
    left: 50%;
    top: 10px;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 99px;
    background: rgba(255, 250, 243, 0.9);
    box-shadow: var(--shadow-sm);
    max-width: calc(100% - 20px);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tabs button {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 99px;
    font-weight: 800;
    font-size: 14px;
    color: var(--ink-soft);
    transition: background 0.15s;
  }
  .tabs button span {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 99px;
    font-size: 12px;
    background: #f3e4d0;
    color: var(--ink-faint);
  }
  .tabs button.on {
    color: #fff;
    background: var(--orange);
    box-shadow: 0 2px 0 var(--orange-dark);
  }
  .tabs button.on span {
    background: rgba(255, 255, 255, 0.3);
    color: #fff;
  }
  .cat {
    position: absolute;
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -89%);
    z-index: 2;
    border-radius: 30%;
    transition: filter 0.2s;
  }
  .cat :global(svg) {
    position: static;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .cat.flip :global(svg) {
    transform: scaleX(-1);
  }
  .cat:hover {
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  }
  .cat.sel {
    filter: drop-shadow(0 0 0 #fff) drop-shadow(0 0 8px rgba(242, 166, 90, 0.9));
  }
  .cat :global(.cat-body) {
    transform-origin: 50% 92%;
    animation: breathe 3.2s ease-in-out infinite var(--delay);
  }
  .cat.pose-sleep :global(.cat-body) {
    animation-duration: 4.6s;
  }
  .cat :global(.cat-tail) {
    transform-origin: 32% 84%;
    animation: tail 2.8s ease-in-out infinite var(--delay);
  }
  .cat.pose-play {
    animation: hop 1.4s ease-in-out infinite var(--delay);
  }
  .cat.pose-groom :global(.cat-head) {
    transform-origin: 55% 60%;
    animation: groom 1.1s ease-in-out infinite;
  }
  .cat.pose-curious :global(.cat-head) {
    transform-origin: 56% 60%;
    animation: tilt 4.5s ease-in-out infinite var(--delay);
  }
  .cat.pose-sit :global(.cat-eyes) {
    transform-origin: 56% 47%;
    animation: blink 5s ease-in-out infinite var(--delay);
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(1.03);
    }
  }
  @keyframes tail {
    0%,
    100% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-7deg);
    }
  }
  @keyframes hop {
    0%,
    70%,
    100% {
      transform: translate(-50%, -89%);
    }
    82% {
      transform: translate(-50%, -100%);
    }
  }
  @keyframes groom {
    0%,
    100% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-5deg) translateY(1px);
    }
  }
  @keyframes tilt {
    0%,
    55%,
    100% {
      transform: rotate(0deg);
    }
    65%,
    85% {
      transform: rotate(9deg);
    }
  }
  @keyframes blink {
    0%,
    94%,
    100% {
      transform: scaleY(1);
    }
    97% {
      transform: scaleY(0.1);
    }
  }
  .new,
  .tag {
    position: absolute;
    left: 50%;
    top: -6%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-weight: 900;
    font-size: 13px;
    padding: 3px 10px;
    border-radius: 99px;
    color: #fff;
    background: var(--rose);
    box-shadow: 0 2px 0 var(--rose-dark);
  }
  .tag {
    background: var(--orange);
    box-shadow: 0 2px 0 var(--orange-dark);
    top: auto;
    bottom: -4%;
  }
  .heart {
    position: absolute;
    z-index: 4;
    color: var(--rose);
    pointer-events: none;
    animation: float 1.3s ease-out forwards;
    filter: drop-shadow(0 2px 0 rgba(216, 111, 122, 0.6));
  }
  @keyframes float {
    from {
      transform: translate(-50%, 0) scale(0.4);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -90px) scale(1.1);
      opacity: 0;
    }
  }
  .empty {
    position: absolute;
    left: 50%;
    top: 34%;
    transform: translate(-50%, -50%);
    width: min(380px, 90%);
    padding: 22px;
    display: grid;
    gap: 10px;
    text-align: center;
    justify-items: center;
    z-index: 3;
  }
  .empty h2 {
    font-size: 22px;
    font-weight: 900;
  }
  .empty p {
    font-weight: 600;
    color: var(--ink-soft);
  }
  .card-sheet {
    position: absolute;
    right: 14px;
    bottom: calc(14px + var(--safe-bottom));
    width: min(360px, calc(100vw - 28px));
    padding: 16px;
    z-index: 5;
    display: grid;
    gap: 10px;
    border-radius: 24px;
  }
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--ink-soft);
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .mini {
    width: 84px;
    height: 84px;
    flex-shrink: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 40%, #fffdf8, #f5e7d4);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .mini :global(svg) {
    width: 100px;
    height: 100px;
    transform: translateY(8px);
  }
  .card-sheet h2 {
    font-size: 24px;
    font-weight: 900;
  }
  .persona {
    font-weight: 800;
    color: var(--orange-dark);
    font-size: 14px;
  }
  .from {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-faint);
  }
  .bio {
    font-weight: 600;
    line-height: 1.4;
    font-size: 14.5px;
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
    font-size: 13px;
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
  .pet-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .pets {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 800;
    color: var(--rose-dark);
  }
  @media (max-width: 640px) {
    h1 {
      font-size: 18px;
    }
    .card-sheet {
      left: 10px;
      right: 10px;
      width: auto;
    }
  }
  /* phone held sideways: the header floats over the room so the room gets the full height */
  @media (max-height: 500px) and (orientation: landscape) {
    .tabs {
      top: auto;
      bottom: calc(8px + var(--safe-bottom));
    }
    .tabs {
      left: auto;
      right: calc(10px + var(--safe-right));
      translate: none;
      gap: 2px;
      padding: 3px;
    }
    .tabs button {
      padding: 4px 9px;
      font-size: 12.5px;
    }
    .tabs button span {
      display: none;
    }
    header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: none;
      box-shadow: none;
      padding-top: calc(8px + var(--safe-top));
      padding-bottom: 0;
      pointer-events: none;
    }
    header > * {
      pointer-events: auto;
    }
    .ttl {
      flex: 0 1 auto;
      background: rgba(255, 250, 243, 0.9);
      padding: 4px 12px;
      border-radius: 14px;
      box-shadow: var(--shadow-sm);
      margin-right: auto;
    }
    h1 {
      font-size: 15px;
    }
    .ttl p {
      font-size: 12px;
    }
    header :global(.icon-btn) {
      width: 40px;
      height: 40px;
    }
    .card-sheet {
      left: auto;
      right: calc(10px + var(--safe-right));
      bottom: 10px;
      top: calc(56px + var(--safe-top));
      width: min(340px, 46vw);
      overflow-y: auto;
      padding: 12px 14px;
      gap: 8px;
    }
    .card-sheet h2 {
      font-size: 19px;
    }
    .mini {
      width: 64px;
      height: 64px;
    }
    .mini :global(svg) {
      width: 78px;
      height: 78px;
    }
    .bio {
      font-size: 13px;
      line-height: 1.35;
    }
  }
</style>
