<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SPRITES } from '../art/sprites';
  import { app } from '../app/store.svelte';
  import { audio } from '../audio/audio';
  import { totalStars } from '../persistence/save';
  import { LEVELS } from '../levels';
  import Icon from './Icon.svelte';

  // the meadow illustration is 1672×941; decorations anchored to it use its scale
  const BG_W = 1672;
  const BG_H = 941;

  const allCats = LEVELS.flatMap((l) => l.cats);
  const stars = $derived(totalStars(app.save));
  const rescued = $derived(Object.keys(app.save.rescued).length);
  const started = $derived(Object.keys(app.save.levels).length > 0);

  let w = $state(0);
  let h = $state(0);
  let px = $state(0);
  let py = $state(0);
  let orangeLooks = $state(false);
  let sashaJoy = $state(0);
  let greyHop = $state(0);
  let orangeHop = $state(0);
  let hearts = $state<{ id: number; x: number; y: number; big: boolean }[]>([]);
  let heartId = 0;

  const portrait = $derived(h > w * 1.02);
  // `cover`, anchored to the bottom so the meadow and fence stay in view
  const bg = $derived.by(() => {
    const s = Math.max(w / BG_W, h / BG_H) || 1;
    return { s, ox: (w - BG_W * s) / 2, oy: h - BG_H * s };
  });

  const timers: number[] = [];
  onMount(() => {
    const reduced = () => app.settings.reducedMotion;
    timers.push(window.setInterval(() => (orangeLooks = !orangeLooks), 3600));
    timers.push(
      window.setInterval(() => {
        if (!reduced()) spawnHeart(false);
      }, 2600),
    );
  });
  onDestroy(() => timers.forEach((t) => clearInterval(t)));

  function spawnHeart(big: boolean, n = 1) {
    for (let i = 0; i < n; i++) {
      const id = ++heartId;
      // around Sasha's and the cat's cheeks (percent of the Sasha sprite box)
      const x = 48 + ((id * 37) % 22) - 11 + (big ? (i - n / 2) * 7 : 0);
      const y = 30 + ((id * 17) % 10);
      hearts = [...hearts, { id, x, y, big }];
      setTimeout(() => (hearts = hearts.filter((q) => q.id !== id)), 2600);
    }
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || app.settings.reducedMotion || !w) return;
    px = (e.clientX / w) * 2 - 1;
    py = (e.clientY / h) * 2 - 1;
  }

  function petSasha() {
    audio.unlock();
    audio.play('purr');
    sashaJoy++;
    spawnHeart(true, 5);
  }
  function poke(which: 'grey' | 'orange') {
    audio.unlock();
    audio.play('meow');
    if (which === 'grey') greyHop++;
    else orangeHop++;
  }
  function play() {
    audio.unlock();
    audio.play('click');
    app.play(app.nextToPlay());
  }
  function go(s: 'levels' | 'shelter') {
    audio.unlock();
    audio.play('click');
    app.go(s);
  }
</script>

{#snippet statsRow()}
  <div class="stats">
    <span class="stat"><Icon name="star" size={20} /> {stars} / {LEVELS.length * 3}</span>
    <span class="stat"><Icon name="heart" size={20} /> {rescued} / {allCats.length} спасено</span>
  </div>
{/snippet}

<div
  class="menu"
  role="presentation"
  class:portrait
  bind:clientWidth={w}
  bind:clientHeight={h}
  onpointermove={onMove}
  style:--px={px}
  style:--py={py}
  style:--s={bg.s}
  style:--ox="{bg.ox}px"
  style:--oy="{bg.oy}px"
>
  <!-- scenery -->
  <img class="bg" src={SPRITES.meadow} alt="" draggable="false" />
  <span class="sun-glow" aria-hidden="true"></span>
  <img class="cloud c1" src={SPRITES['cloud-big']} alt="" draggable="false" />
  <img class="cloud c2" src={SPRITES['cloud-small']} alt="" draggable="false" />
  <img class="cloud c3" src={SPRITES['cloud-big']} alt="" draggable="false" />

  {#if portrait}
    <img class="deco tree" src={SPRITES.tree} alt="" draggable="false" />
    <img class="deco house" src={SPRITES.house} alt="" draggable="false" />
    <img class="deco fence-l" src={SPRITES['fence-long']} alt="" draggable="false" />
    <img class="deco fence-r" src={SPRITES['fence-short']} alt="" draggable="false" />
  {/if}

  <button class="black-cat" onclick={() => (audio.unlock(), audio.play('purr'))} aria-label="Спящая кошка на заборе">
    <img src={SPRITES['black-fence']} alt="" draggable="false" />
    <span class="zz z1"><svg viewBox="0 0 20 20"><path d="M4 4 H15 L4 16 H15" /></svg></span>
    <span class="zz z2"><svg viewBox="0 0 20 20"><path d="M4 4 H15 L4 16 H15" /></svg></span>
  </button>

  <!-- butterflies and petals -->
  {#each [0, 1] as b}
    <span class="butterfly b{b}" aria-hidden="true">
      <svg viewBox="0 0 40 30">
        <g class="wing l"><ellipse cx="14" cy="11" rx="10" ry="8" fill={b ? '#c4b5ef' : '#f7b2c0'} /><ellipse cx="15" cy="21" rx="7" ry="6" fill={b ? '#a99be0' : '#f29aa3'} /></g>
        <g class="wing r"><ellipse cx="26" cy="11" rx="10" ry="8" fill={b ? '#c4b5ef' : '#f7b2c0'} /><ellipse cx="25" cy="21" rx="7" ry="6" fill={b ? '#a99be0' : '#f29aa3'} /></g>
        <rect x="19" y="7" width="2.4" height="18" rx="1.2" fill="#4c3b3a" />
      </svg>
    </span>
  {/each}
  {#each Array(7) as _, i}
    <span class="petal" style:--i={i} aria-hidden="true"></span>
  {/each}

  <!-- characters -->
  <button class="sasha" onclick={petSasha} aria-label="Саша с котом — погладить">
    <span class="enter">
      {#key sashaJoy}
        <img class:joy={sashaJoy > 0} src={SPRITES['sasha-hug']} alt="" draggable="false" />
      {/key}
      {#each hearts as hh (hh.id)}
        <span class="heart" class:big={hh.big} style:left="{hh.x}%" style:top="{hh.y}%"><Icon name="heart" size={hh.big ? 30 : 20} /></span>
      {/each}
    </span>
  </button>

  <button class="kitten grey" onclick={() => poke('grey')} aria-label="Серый котёнок">
    <span class="enter">
      {#key greyHop}
        <img class:hop={greyHop > 0} src={SPRITES['grey-walk']} alt="" draggable="false" />
      {/key}
    </span>
  </button>

  <button class="kitten orange" onclick={() => poke('orange')} aria-label="Рыжий котёнок">
    <span class="enter">
      {#key orangeHop}
        <span class="swap" class:hop={orangeHop > 0}>
          <img class:show={!orangeLooks} src={SPRITES['orange-happy']} alt="" draggable="false" />
          <img class:show={orangeLooks} src={SPRITES['orange-look']} alt="" draggable="false" />
        </span>
      {/key}
    </span>
  </button>

  <img class="front flowers-l" src={SPRITES.flowers} alt="" draggable="false" />
  <img class="front flowers-r" src={SPRITES.flowers} alt="" draggable="false" />

  <!-- menu -->
  <main class="panel">
    <div class="logo">
      <div class="paw"><Icon name="paw" size={36} /></div>
      <h1><span class="cat">Cat</span> <span class="rescue">Rescue</span></h1>
      <p class="tag">Уютные головоломки о спасении уличных котиков</p>
    </div>

    <div class="buttons">
      <button class="btn primary big" onclick={play} style:--d="0">
        <Icon name="play" />
        {started ? 'Продолжить' : 'Играть'}
      </button>
      <button class="btn" onclick={() => go('levels')} style:--d="1"><Icon name="levels" /> Уровни</button>
      <button class="btn" onclick={() => go('shelter')} style:--d="2">
        <Icon name="shelter" /> Приют
        {#if app.freshCats.length}<span class="badge">{app.freshCats.length}</span>{/if}
      </button>
      <button class="btn" onclick={() => ((app.settingsOpen = true), audio.play('click'))} style:--d="3"><Icon name="settings" /> Настройки</button>
    </div>

    {#if !portrait}{@render statsRow()}{/if}
  </main>
  {#if portrait}{@render statsRow()}{/if}
</div>

<style>
  .menu {
    position: absolute;
    inset: 0;
    overflow: hidden;
    overflow: clip;
    background: #8fd0f5;
    --ease-back: cubic-bezier(0.2, 0.9, 0.3, 1.25);
  }
  img {
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }
  button {
    -webkit-tap-highlight-color: transparent;
  }

  /* ---------------------------------------------------------------- scenery */
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 100%;
    translate: calc(var(--px) * -6px) calc(var(--py) * -4px);
    scale: 1.02;
    animation: bgIn 1.6s ease-out both;
  }
  @keyframes bgIn {
    from {
      scale: 1.1;
      filter: saturate(0.6) brightness(1.1);
    }
  }
  .sun-glow {
    position: absolute;
    left: calc(var(--ox) + 1310px * var(--s));
    top: calc(var(--oy) + 112px * var(--s));
    width: calc(360px * var(--s));
    height: calc(360px * var(--s));
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 246, 190, 0.75) 0%, rgba(255, 240, 170, 0.25) 40%, rgba(255, 240, 170, 0) 70%);
    animation: glow 5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes glow {
    50% {
      scale: 1.18;
      opacity: 0.75;
    }
  }
  .cloud {
    position: absolute;
    width: clamp(110px, 16vw, 260px);
    opacity: 0.95;
    animation: drift 110s linear infinite;
    filter: drop-shadow(0 6px 10px rgba(80, 140, 190, 0.18));
  }
  .c1 {
    top: 7%;
    animation-delay: -20s;
  }
  .c2 {
    top: 18%;
    width: clamp(80px, 10vw, 170px);
    animation-duration: 150s;
    animation-delay: -95s;
  }
  .c3 {
    top: 30%;
    width: clamp(90px, 12vw, 200px);
    animation-duration: 180s;
    animation-delay: -40s;
    opacity: 0.85;
  }
  @keyframes drift {
    from {
      left: -20%;
    }
    to {
      left: 110%;
    }
  }

  .deco,
  .front {
    position: absolute;
  }
  .black-cat {
    position: absolute;
    left: calc(var(--ox) + 1462px * var(--s));
    top: calc(var(--oy) + 470px * var(--s));
    width: calc(190px * var(--s));
    z-index: 2;
    translate: calc(var(--px) * 6px) 0;
    animation: fadeIn 0.8s ease-out 1.1s both;
  }
  .black-cat img {
    width: 100%;
    display: block;
    transform-origin: 50% 80%;
    animation: breathe 4.4s ease-in-out infinite;
  }
  .zz {
    position: absolute;
    width: 16px;
    height: 16px;
    left: 70%;
    top: 4%;
    opacity: 0;
    animation: zz 3.2s ease-out infinite;
  }
  .zz svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: #7d8bc9;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .z2 {
    animation-delay: 1.6s;
  }
  @keyframes zz {
    0% {
      opacity: 0;
      transform: translate(0, 0) scale(0.6);
    }
    20% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      transform: translate(18px, -40px) scale(1.2);
    }
  }

  /* -------------------------------------------------------------- characters */
  .sasha,
  .kitten {
    position: absolute;
    padding: 0;
    cursor: pointer;
  }
  .sasha img,
  .kitten img {
    display: block;
    width: 100%;
  }
  .enter {
    display: block;
    position: relative;
  }
  .sasha {
    left: 33vw;
    bottom: -1vh;
    width: min(82vh * 1.04, 47vw);
    translate: calc(var(--px) * 12px) calc(var(--py) * 5px);
    z-index: 3;
  }
  .sasha .enter {
    animation: rise 1.1s var(--ease-back) 0.25s both;
  }
  .sasha img {
    transform-origin: 50% 100%;
    animation: sway 5.5s ease-in-out infinite;
    filter: drop-shadow(0 10px 18px rgba(60, 60, 30, 0.18));
  }
  .sasha img.joy {
    animation:
      joy 0.6s var(--ease-back),
      sway 5.5s ease-in-out 0.6s infinite;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18%) scale(0.94);
    }
  }
  @keyframes sway {
    0%,
    100% {
      transform: rotate(-0.6deg) translateY(0);
    }
    50% {
      transform: rotate(0.7deg) translateY(-1%);
    }
  }
  @keyframes joy {
    35% {
      transform: scale(1.04, 0.97) translateY(1%);
    }
    65% {
      transform: scale(0.98, 1.03) translateY(-2%);
    }
  }
  .heart {
    position: absolute;
    color: #f2777e;
    translate: -50% 0;
    filter: drop-shadow(0 2px 0 rgba(216, 111, 122, 0.5));
    animation: heart 2.6s ease-out forwards;
    pointer-events: none;
  }
  .heart.big {
    animation-duration: 1.8s;
  }
  @keyframes heart {
    0% {
      opacity: 0;
      transform: translateY(0) scale(0.3);
    }
    15% {
      opacity: 1;
      transform: translateY(-12px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-120px) scale(1.1) rotate(12deg);
    }
  }

  .kitten {
    z-index: 4;
  }
  .kitten.grey {
    left: 30vw;
    bottom: 1vh;
    height: 33vh;
    aspect-ratio: 317 / 391;
    translate: calc(var(--px) * 18px) calc(var(--py) * 6px);
  }
  .kitten.grey .enter {
    animation: walkIn 1.8s ease-out 0.7s both;
  }
  .kitten.grey img {
    transform-origin: 50% 100%;
    animation: hopIdle 3.4s ease-in-out 2.6s infinite;
  }
  @keyframes walkIn {
    0% {
      opacity: 0;
      transform: translateX(-30vw);
    }
    15% {
      opacity: 1;
    }
    30% {
      transform: translate(-21vw, -6px);
    }
    45% {
      transform: translate(-15vw, 0);
    }
    60% {
      transform: translate(-9vw, -6px);
    }
    75% {
      transform: translate(-4vw, 0);
    }
    90% {
      transform: translate(-1vw, -4px);
    }
    100% {
      transform: none;
    }
  }
  @keyframes hopIdle {
    0%,
    70%,
    100% {
      transform: none;
    }
    80% {
      transform: translateY(-9%) scale(0.98, 1.03);
    }
    90% {
      transform: scale(1.03, 0.96);
    }
  }
  .kitten img.hop,
  .kitten .swap.hop {
    animation: pokeHop 0.55s var(--ease-back);
  }
  @keyframes pokeHop {
    40% {
      transform: translateY(-16%) rotate(-4deg);
    }
    70% {
      transform: scale(1.04, 0.95);
    }
  }
  .kitten.orange {
    right: 5vw;
    bottom: 5vh;
    height: 31vh;
    aspect-ratio: 287 / 376;
    translate: calc(var(--px) * 16px) calc(var(--py) * 6px);
  }
  .kitten.orange .enter {
    animation: pop 0.8s var(--ease-back) 1s both;
    height: 100%;
  }
  .swap {
    position: relative;
    display: block;
    height: 100%;
    transform-origin: 50% 100%;
  }
  .swap img {
    position: absolute;
    inset: auto 0 0 0;
    opacity: 0;
    transition: opacity 0.35s ease;
    transform-origin: 50% 100%;
    animation: breathe 3.6s ease-in-out infinite;
  }
  .swap img.show {
    opacity: 1;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(14%) scale(0.6);
    }
  }
  @keyframes breathe {
    50% {
      transform: scaleY(1.025);
    }
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .front {
    z-index: 5;
    filter: drop-shadow(0 6px 8px rgba(40, 60, 20, 0.15));
  }
  .flowers-l {
    left: -3vw;
    bottom: -4vh;
    height: 20vh;
  }
  .flowers-r {
    right: -4vw;
    bottom: -5vh;
    height: 17vh;
    transform: scaleX(-1);
  }

  /* butterflies & petals */
  .butterfly {
    position: absolute;
    width: 30px;
    height: 24px;
    z-index: 4;
    pointer-events: none;
    animation: flyA 22s ease-in-out infinite;
  }
  .butterfly.b1 {
    width: 24px;
    animation: flyB 27s ease-in-out -9s infinite;
  }
  .butterfly svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .wing {
    transform-box: fill-box;
    animation: flap 0.28s ease-in-out infinite alternate;
  }
  .wing.l {
    transform-origin: 100% 50%;
  }
  .wing.r {
    transform-origin: 0% 50%;
  }
  @keyframes flap {
    to {
      transform: scaleX(0.25);
    }
  }
  @keyframes flyA {
    0% {
      left: -5%;
      top: 62%;
    }
    25% {
      left: 22%;
      top: 54%;
    }
    50% {
      left: 48%;
      top: 66%;
    }
    75% {
      left: 76%;
      top: 52%;
    }
    100% {
      left: 105%;
      top: 60%;
    }
  }
  @keyframes flyB {
    0% {
      left: 105%;
      top: 70%;
    }
    30% {
      left: 70%;
      top: 58%;
    }
    60% {
      left: 40%;
      top: 72%;
    }
    100% {
      left: -6%;
      top: 56%;
    }
  }
  .petal {
    position: absolute;
    top: -4%;
    left: calc(8% + var(--i) * 13%);
    width: 10px;
    height: 7px;
    border-radius: 60% 40% 60% 40%;
    background: #f7b2c0;
    opacity: 0.85;
    z-index: 4;
    pointer-events: none;
    animation: petal calc(11s + var(--i) * 1.3s) linear calc(var(--i) * -2.1s) infinite;
  }
  .petal:nth-child(even) {
    background: #fff1d6;
  }
  @keyframes petal {
    0% {
      transform: translate(0, 0) rotate(0deg);
    }
    50% {
      transform: translate(6vw, 55vh) rotate(260deg);
    }
    100% {
      transform: translate(-2vw, 110vh) rotate(540deg);
    }
  }

  /* ------------------------------------------------------------------- panel */
  .panel {
    position: absolute;
    z-index: 6;
    left: 6vw;
    top: 50%;
    transform: translateY(-50%);
    width: min(440px, 33vw);
    display: grid;
    gap: 16px;
    justify-items: stretch;
  }
  .logo {
    display: grid;
    justify-items: center;
    gap: 8px;
    animation: dropIn 0.9s var(--ease-back) both;
  }
  @keyframes dropIn {
    from {
      opacity: 0;
      transform: translateY(-40px) scale(0.9);
    }
  }
  .paw {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(160deg, #f8b671, var(--orange));
    box-shadow:
      0 5px 0 var(--orange-dark),
      0 12px 24px rgba(216, 132, 59, 0.35);
    transform: rotate(-7deg);
    animation: pawWiggle 4s ease-in-out 1.4s infinite;
  }
  @keyframes pawWiggle {
    0%,
    80%,
    100% {
      transform: rotate(-7deg);
    }
    85% {
      transform: rotate(6deg) scale(1.06);
    }
    92% {
      transform: rotate(-11deg);
    }
  }
  h1 {
    font-size: clamp(52px, 6.4vw, 92px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.02em;
    white-space: nowrap;
    /* thick white sticker outline */
    text-shadow:
      0 4px 0 #fff,
      4px 0 0 #fff,
      -4px 0 0 #fff,
      0 -4px 0 #fff,
      3px 3px 0 #fff,
      -3px 3px 0 #fff,
      3px -3px 0 #fff,
      -3px -3px 0 #fff,
      0 10px 18px rgba(76, 59, 58, 0.22);
  }
  .cat {
    color: #4a3530;
  }
  .rescue {
    color: #e48a3c;
  }
  .tag {
    font-weight: 700;
    font-size: 17px;
    color: var(--ink-soft);
    text-align: center;
    background: rgba(255, 252, 245, 0.82);
    backdrop-filter: blur(4px);
    padding: 10px 18px;
    border-radius: 18px;
    box-shadow: 0 4px 14px rgba(60, 90, 120, 0.12);
    width: 100%;
  }
  .buttons {
    display: grid;
    gap: 12px;
  }
  .buttons .btn {
    width: 100%;
    position: relative;
    min-height: 58px;
    font-size: 19px;
    animation: btnIn 0.6s var(--ease-back) calc(0.35s + var(--d) * 0.09s) both;
  }
  .buttons .big {
    min-height: 68px;
    font-size: 23px;
  }
  @keyframes btnIn {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.96);
    }
  }
  .badge {
    position: absolute;
    right: 16px;
    min-width: 26px;
    height: 26px;
    border-radius: 13px;
    background: var(--rose);
    color: #fff;
    font-size: 14px;
    display: grid;
    place-items: center;
    padding: 0 6px;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      transform: scale(1.12);
    }
  }
  .stats {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    animation: btnIn 0.6s var(--ease-back) 0.8s both;
  }
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 252, 245, 0.92);
    padding: 8px 16px;
    border-radius: 99px;
    font-weight: 900;
    font-size: 17px;
    color: var(--ink-soft);
    box-shadow: var(--shadow-sm);
  }
  .stat :global(svg) {
    color: var(--gold-dark);
  }
  .stat:last-child :global(svg) {
    color: var(--rose);
  }

  /* --------------------------------------------------------------- portrait */
  .portrait .panel {
    left: 50%;
    top: calc(var(--safe-top) + 3.5vh);
    transform: translateX(-50%);
    width: min(400px, 88vw);
    gap: 12px;
  }
  .portrait h1 {
    font-size: clamp(48px, 14vw, 76px);
  }
  .portrait .paw {
    width: 60px;
    height: 60px;
    border-radius: 20px;
  }
  .portrait .tag {
    font-size: 15px;
    padding: 8px 14px;
  }
  .portrait .buttons {
    gap: 9px;
    padding: 0 4%;
  }
  .portrait .buttons .btn {
    min-height: 50px;
    font-size: 18px;
  }
  .portrait .buttons .big {
    min-height: 58px;
    font-size: 21px;
  }
  .portrait .stats {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--safe-bottom) + 2vh);
    z-index: 7;
  }
  .portrait .stat {
    font-size: 15px;
    padding: 7px 14px;
  }
  .portrait .sasha {
    left: 50%;
    width: min(96vw, 47vh * 1.04);
    transform: translateX(-50%);
    bottom: 7vh;
  }
  .portrait .kitten.grey {
    left: -1vw;
    bottom: 8vh;
    height: 17vh;
  }
  .portrait .kitten.orange {
    right: 0;
    bottom: 8vh;
    height: 18vh;
  }
  .portrait .black-cat {
    left: auto;
    right: 3vw;
    top: auto;
    bottom: 37vh;
    right: 1vw;
    width: 25vw;
    max-width: 130px;
  }
  .portrait .deco {
    z-index: 1;
    animation: fadeIn 1s ease-out 0.3s both;
  }
  .portrait .tree {
    left: -18vw;
    bottom: 33vh;
    height: 34vh;
  }
  .portrait .house {
    right: -14vw;
    bottom: 35vh;
    height: 17vh;
  }
  .portrait .fence-l {
    left: -10vw;
    bottom: 29vh;
    width: 58vw;
  }
  .portrait .fence-r {
    right: -4vw;
    bottom: 29.5vh;
    width: 40vw;
  }
  .portrait .flowers-l {
    height: 14vh;
    bottom: -3vh;
  }
  .portrait .flowers-r {
    height: 12vh;
    bottom: -3vh;
  }

  /* phone held sideways: compact menu — big "play", then three small buttons in a row */
  @media (max-height: 500px) and (orientation: landscape) {
    .panel {
      left: calc(4vw + var(--safe-left));
      width: min(380px, 42vw);
      gap: 10px;
    }
    .paw,
    .tag {
      display: none;
    }
    h1 {
      font-size: clamp(36px, 11vh, 52px);
    }
    .buttons {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .buttons .btn {
      min-height: 54px;
      padding: 4px 6px;
      font-size: 13.5px;
      flex-direction: column;
      gap: 2px;
      border-radius: 18px;
    }
    .buttons .big {
      grid-column: 1 / -1;
      min-height: 50px;
      font-size: 19px;
      flex-direction: row;
      gap: 8px;
      border-radius: 999px;
    }
    .badge {
      top: -6px;
      right: -4px;
      min-width: 22px;
      height: 22px;
      font-size: 12px;
    }
    .stats {
      flex-wrap: nowrap;
      gap: 6px;
    }
    .stat {
      font-size: 13.5px;
      padding: 6px 12px;
      white-space: nowrap;
    }
    .sasha {
      left: 40vw;
      width: min(92vh * 1.04, 44vw);
    }
    .kitten.grey {
      left: 37vw;
      height: 34vh;
    }
    .kitten.orange {
      right: calc(3vw + var(--safe-right));
      height: 36vh;
    }
  }
</style>
