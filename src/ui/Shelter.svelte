<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { catSvg, type CatPose } from '../art/cats';
  import { app } from '../app/store.svelte';
  import { TRAITS } from '../app/text';
  import { audio } from '../audio/audio';
  import type { CatDef } from '../core/level';
  import { LEVELS } from '../levels';
  import Icon from './Icon.svelte';

  interface Slot {
    x: number; // % of stage width (cat centre)
    y: number; // % of stage height (cat feet)
    size: number; // in cqh
    pose: CatPose;
    flip?: boolean;
    spot: 'bed' | 'rug' | 'cushion' | 'tree' | 'sill' | 'basket' | 'floor';
  }

  // where rescued cats settle, in order of arrival
  const SLOTS: Slot[] = [
    { x: 23, y: 84, size: 20, pose: 'sleep', spot: 'bed' },
    { x: 50, y: 80, size: 21, pose: 'play', spot: 'rug' },
    { x: 82, y: 34.8, size: 17, pose: 'sit', spot: 'tree', flip: true },
    { x: 14, y: 39.6, size: 16, pose: 'groom', spot: 'sill' },
    { x: 64, y: 88, size: 20, pose: 'sleep', spot: 'basket', flip: true },
    { x: 37, y: 66, size: 18, pose: 'sit', spot: 'cushion' },
    { x: 82, y: 65.4, size: 17, pose: 'curious', spot: 'tree' },
    { x: 92, y: 86, size: 19, pose: 'sit', spot: 'floor', flip: true },
    { x: 7, y: 90, size: 19, pose: 'curious', spot: 'floor' },
    { x: 44, y: 95, size: 19, pose: 'groom', spot: 'floor', flip: true },
    { x: 26, y: 39.6, size: 15, pose: 'sleep', spot: 'sill', flip: true },
  ];

  const allCats: (CatDef & { levelTitle: string })[] = LEVELS.flatMap((l) => l.cats.map((c) => ({ ...c, levelTitle: l.title })));
  const rescued = $derived(
    allCats
      .filter((c) => app.save.rescued[c.id])
      .sort((a, b) => app.save.rescued[a.id].rescuedAt - app.save.rescued[b.id].rescuedAt || allCats.indexOf(a) - allCats.indexOf(b)),
  );
  const fresh = new Set(app.freshCats);

  let selected = $state<string | null>(null);
  let happy = $state<Record<string, number>>({});
  let hearts = $state<{ id: number; x: number; y: number }[]>([]);
  let heartId = 0;
  const sel = $derived(selected ? rescued.find((c) => c.id === selected) : undefined);

  onDestroy(() => {
    app.freshCats = [];
  });

  function pet(id: string, slot: Slot) {
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
      const h = { id: ++heartId, x: slot.x + (i - 1.5) * 2.2, y: slot.y - slot.size * 0.9 };
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

  <div class="room-wrap">
    <div class="stage">
      <!-- wall & floor -->
      <div class="wall"></div>
      <div class="floor"></div>
      <div class="baseboard"></div>

      <!-- window -->
      <svg class="window" viewBox="0 0 300 260" aria-hidden="true">
        <rect x="10" y="10" width="280" height="220" rx="16" fill="#cfe9f1" stroke="#a7795a" stroke-width="12" />
        <circle cx="220" cy="70" r="28" fill="#fff3c4" />
        <path d="M22 170 C80 130 140 150 200 140 C240 132 270 150 288 146 V222 H22 Z" fill="#b8d79a" />
        <path d="M150 16 V226 M16 120 H286" stroke="#a7795a" stroke-width="8" />
        <path d="M0 0 C40 60 30 160 60 250 L0 250 Z" fill="#f4b9a6" opacity="0.95" />
        <path d="M300 0 C260 60 270 160 240 250 L300 250 Z" fill="#f4b9a6" opacity="0.95" />
        <rect x="-6" y="226" width="312" height="22" rx="8" fill="#c9966b" stroke="#8a5f3e" stroke-width="5" />
      </svg>
      <!-- picture frame -->
      <svg class="frame" viewBox="0 0 120 100" aria-hidden="true">
        <rect x="5" y="5" width="110" height="90" rx="8" fill="#fff6e6" stroke="#c9966b" stroke-width="8" />
        <path d="M30 70 C30 52 46 44 60 44 C74 44 90 52 90 70 Z" fill="#f2a65a" />
        <path d="M40 48 L44 30 L54 42 Z M66 42 L76 30 L80 48 Z" fill="#f2a65a" />
        <circle cx="52" cy="56" r="3" fill="#4c3b3a" /><circle cx="68" cy="56" r="3" fill="#4c3b3a" />
      </svg>
      <!-- shelf with plants -->
      <svg class="shelf" viewBox="0 0 260 120" aria-hidden="true">
        <rect x="0" y="86" width="260" height="14" rx="6" fill="#c9966b" stroke="#8a5f3e" stroke-width="4" />
        <path d="M40 86 L46 56 L74 56 L80 86 Z" fill="#e8907a" stroke="#8a5f3e" stroke-width="4" stroke-linejoin="round" />
        <path d="M60 56 C40 30 46 12 58 6 C60 24 62 36 60 56 M60 56 C76 34 90 32 96 38 C82 42 72 48 60 56" fill="#8cbc69" stroke="#4e7a45" stroke-width="3" />
        <rect x="120" y="50" width="34" height="36" rx="4" fill="#8fd0b4" stroke="#8a5f3e" stroke-width="4" />
        <rect x="158" y="40" width="26" height="46" rx="4" fill="#f2c46d" stroke="#8a5f3e" stroke-width="4" />
        <path d="M206 86 L210 64 L234 64 L238 86 Z" fill="#a9d6e8" stroke="#8a5f3e" stroke-width="4" stroke-linejoin="round" />
        <circle cx="222" cy="54" r="14" fill="#f7b2c0" stroke="#d86f7a" stroke-width="3" />
      </svg>
      <!-- cat tree -->
      <svg class="tree" viewBox="0 0 200 520" aria-hidden="true">
        <rect x="88" y="90" width="26" height="420" rx="10" fill="#e9d3a6" stroke="#8a5f3e" stroke-width="5" />
        {#each [150, 230, 310, 390, 470] as y}<path d="M88 {y} H114" stroke="#c9b083" stroke-width="3" />{/each}
        <ellipse cx="100" cy="96" rx="80" ry="22" fill="#c4b5ef" stroke="#8a5f3e" stroke-width="5" />
        <ellipse cx="100" cy="338" rx="72" ry="20" fill="#c4b5ef" stroke="#8a5f3e" stroke-width="5" />
        <rect x="20" y="490" width="160" height="26" rx="12" fill="#c4b5ef" stroke="#8a5f3e" stroke-width="5" />
        <circle cx="40" cy="380" r="9" fill="#f48fb1" stroke="#8a5f3e" stroke-width="3" /><path d="M40 338 V371" stroke="#8a5f3e" stroke-width="2" />
      </svg>
      <!-- rug -->
      <svg class="rug" viewBox="0 0 400 120" aria-hidden="true">
        <ellipse cx="200" cy="60" rx="196" ry="56" fill="#f6c7a4" stroke="#d9946b" stroke-width="6" />
        <ellipse cx="200" cy="60" rx="150" ry="40" fill="none" stroke="#fde3c6" stroke-width="10" />
        <ellipse cx="200" cy="60" rx="96" ry="24" fill="none" stroke="#f2a65a" stroke-width="6" stroke-dasharray="14 10" />
      </svg>
      <!-- beds -->
      <svg class="bed b1" viewBox="0 0 240 110" aria-hidden="true">
        <ellipse cx="120" cy="70" rx="116" ry="38" fill="#8fd0b4" stroke="#4fa786" stroke-width="6" />
        <ellipse cx="120" cy="62" rx="88" ry="24" fill="#dcf3e8" />
      </svg>
      <svg class="bed basket" viewBox="0 0 240 120" aria-hidden="true">
        <path d="M14 50 C20 110 220 110 226 50 Z" fill="#d9a46b" stroke="#8a5f3e" stroke-width="6" stroke-linejoin="round" />
        {#each [40, 70, 100, 130, 160, 190] as x}<path d="M{x} 56 L{x + 6} 96" stroke="#b9844f" stroke-width="4" />{/each}
        <ellipse cx="120" cy="50" rx="108" ry="22" fill="#f6e7d3" stroke="#8a5f3e" stroke-width="6" />
      </svg>
      <svg class="bed cushion" viewBox="0 0 200 80" aria-hidden="true">
        <ellipse cx="100" cy="46" rx="94" ry="28" fill="#f29aa3" stroke="#d86f7a" stroke-width="6" />
        <ellipse cx="100" cy="40" rx="66" ry="14" fill="#fde5e7" />
      </svg>
      <!-- bowls & toys -->
      <svg class="bowls" viewBox="0 0 180 60" aria-hidden="true">
        <ellipse cx="45" cy="38" rx="38" ry="14" fill="#6fa3c9" stroke="#4c3b3a" stroke-width="4" />
        <ellipse cx="45" cy="32" rx="30" ry="9" fill="#b9845a" />
        <ellipse cx="135" cy="38" rx="38" ry="14" fill="#f2a65a" stroke="#4c3b3a" stroke-width="4" />
        <ellipse cx="135" cy="32" rx="30" ry="9" fill="#bfe3ee" />
      </svg>
      <svg class="yarn" viewBox="0 0 80 60" aria-hidden="true">
        <circle cx="30" cy="30" r="22" fill="#f48fb1" stroke="#4c3b3a" stroke-width="4" />
        <path d="M14 24 q16 -12 32 4 M12 34 q18 -8 34 6" stroke="#fbc6d8" stroke-width="3" fill="none" />
        <path d="M50 42 q20 10 26 -6" stroke="#4c3b3a" stroke-width="3" fill="none" />
      </svg>

      <!-- cats -->
      {#each rescued as cat, i (cat.id)}
        {@const slot = SLOTS[i % SLOTS.length]}
        {@const pose = poseOf(cat.id, slot)}
        <button
          class="cat pose-{pose}"
          class:sel={selected === cat.id}
          class:flip={slot.flip}
          style:left="{slot.x}%"
          style:top="{slot.y}%"
          style:--size="{slot.size}cqh"
          style:--delay="{-i * 0.7}s"
          onclick={() => pet(cat.id, slot)}
          aria-label="{cat.name} — погладить"
          in:scale={{ delay: 120 + i * 90, duration: 420, easing: backOut, start: 0.6 }}
        >
          {@html catSvg(cat.look, pose, { size: 128, uid: `sh${cat.id}${pose}`, hooks: true })}
          {#if fresh.has(cat.id)}<span class="new">Новенький!</span>{/if}
          {#if selected === cat.id}<span class="tag">{cat.name}</span>{/if}
        </button>
      {/each}

      {#each hearts as h (h.id)}
        <span class="heart" style:left="{h.x}%" style:top="{h.y}%"><Icon name="heart" size={26} /></span>
      {/each}

      {#if rescued.length === 0}
        <div class="empty card" in:fly={{ y: 20 }}>
          <h2>Здесь пока тихо…</h2>
          <p>Лежанки уже взбиты, миски наполнены. Спасите первого котика — и он появится здесь.</p>
          <button class="btn primary" onclick={() => app.play(app.nextToPlay())}><Icon name="play" /> К спасению</button>
        </div>
      {/if}
    </div>
  </div>

  {#if sel}
    {#key sel.id}
      <aside class="card-sheet card" in:fly={{ y: 30, duration: 260, easing: backOut }}>
        <button class="close" onclick={() => (selected = null)} aria-label="Закрыть"><Icon name="close" size={18} /></button>
        <div class="row">
          <div class="mini">{@html catSvg(sel.look, 'sit', { size: 96, uid: `card${sel.id}` })}</div>
          <div>
            <h2>{sel.name}</h2>
            <p class="persona">{sel.personality}</p>
            <p class="from">Спасён(а): «{sel.levelTitle}»</p>
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
          <button class="btn small rose" onclick={() => pet(sel.id, SLOTS[rescued.findIndex((c) => c.id === sel.id) % SLOTS.length])}>
            <Icon name="paw" size={18} /> Погладить
          </button>
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
    padding: calc(12px + var(--safe-top)) 14px 12px;
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
  .room-wrap {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    scrollbar-width: thin;
    /* wall and floor continue beyond the fixed-ratio stage on wide screens */
    background: linear-gradient(180deg, #f8e2c6 0, #f6dcbd 61%, #fff4e4 61%, #fff4e4 62.5%, #d9a979 62.5%, #c99366 100%);
  }
  .stage {
    position: relative;
    height: 100%;
    aspect-ratio: 1200 / 760;
    margin: 0 auto;
    container-type: size;
    overflow: hidden;
  }
  .wall {
    position: absolute;
    inset: 0 0 38% 0;
    background:
      repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0 22px, transparent 22px 60px),
      radial-gradient(circle at 30px 30px, rgba(242, 166, 90, 0.18) 3px, transparent 4px) 0 0 / 60px 60px,
      linear-gradient(180deg, #fbe9d3, #f6dcbd);
  }
  .floor {
    position: absolute;
    inset: 62% 0 0 0;
    background:
      repeating-linear-gradient(0deg, rgba(120, 80, 50, 0.16) 0 3px, transparent 3px 46px),
      repeating-linear-gradient(90deg, transparent 0 160px, rgba(120, 80, 50, 0.12) 160px 163px),
      linear-gradient(180deg, #d9a979, #c99366);
  }
  .baseboard {
    position: absolute;
    left: 0;
    right: 0;
    top: 60.5%;
    height: 2.4%;
    background: #fff4e4;
    border-top: 3px solid #e8cfae;
    border-bottom: 3px solid #b98a62;
  }
  svg {
    position: absolute;
  }
  .window {
    left: 7%;
    top: 9%;
    width: 25%;
  }
  .frame {
    left: 40%;
    top: 14%;
    width: 9%;
  }
  .shelf {
    left: 52%;
    top: 22%;
    width: 20%;
  }
  .tree {
    left: 74%;
    top: 22%;
    height: 66%;
  }
  .rug {
    left: 32%;
    top: 70%;
    width: 36%;
  }
  .bed.b1 {
    left: 12%;
    top: 75%;
    width: 22%;
  }
  .bed.basket {
    left: 53.5%;
    top: 79%;
    width: 21%;
  }
  .bed.cushion {
    left: 29%;
    top: 61%;
    width: 16%;
  }
  .bowls {
    left: 86%;
    top: 92%;
    width: 13%;
  }
  .yarn {
    left: 60%;
    top: 70%;
    width: 5%;
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
</style>
