<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { catSvg } from '../art/cats';
  import { app } from '../app/store.svelte';
  import { audio } from '../audio/audio';
  import { totalStars } from '../persistence/save';
  import { LEVELS } from '../levels';
  import Icon from './Icon.svelte';
  import Scenery from './Scenery.svelte';

  const allCats = LEVELS.flatMap((l) => l.cats);
  const stars = $derived(totalStars(app.save));
  const rescued = $derived(Object.keys(app.save.rescued).length);
  const started = $derived(Object.keys(app.save.levels).length > 0);
  const ryzhik = allCats[0].look;
  const plush = allCats.find((c) => c.id === 'plyushka')!.look;
  const ten = allCats.find((c) => c.id === 'ten')!.look;

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

<div class="menu">
  <Scenery />
  <div class="fence-cats" aria-hidden="true">
    <div class="cat sleeping">{@html catSvg(ten, 'sleep', { size: 120, uid: 'm1', hooks: true })}</div>
  </div>
  <div class="ground-cats" aria-hidden="true">
    <div class="cat sitting">{@html catSvg(ryzhik, 'sit', { size: 150, uid: 'm2', hooks: true })}</div>
    <div class="cat curious">{@html catSvg(plush, 'curious', { size: 130, uid: 'm3', hooks: true })}</div>
  </div>

  <main in:fly={{ y: 30, duration: 500, easing: backOut }}>
    <div class="logo">
      <div class="paw"><Icon name="paw" size={34} /></div>
      <h1>Cat <span>Rescue</span></h1>
      <p class="tag">Уютные головоломки о спасении уличных котиков</p>
    </div>

    <div class="buttons">
      <button class="btn primary big" onclick={play}>
        <Icon name="play" />
        {started ? 'Продолжить' : 'Играть'}
      </button>
      <button class="btn" onclick={() => go('levels')}><Icon name="levels" /> Уровни</button>
      <button class="btn" onclick={() => go('shelter')}>
        <Icon name="shelter" /> Приют
        {#if app.freshCats.length}<span class="badge">{app.freshCats.length}</span>{/if}
      </button>
      <button class="btn" onclick={() => ((app.settingsOpen = true), audio.play('click'))}><Icon name="settings" /> Настройки</button>
    </div>

    <div class="stats">
      <span class="stat"><Icon name="star" size={18} /> {stars} / {LEVELS.length * 3}</span>
      <span class="stat"><Icon name="heart" size={18} /> {rescued} / {allCats.length} спасено</span>
    </div>
  </main>
</div>

<style>
  .menu {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    padding-top: calc(16px + var(--safe-top));
  }
  main {
    position: relative;
    z-index: 2;
    width: min(420px, 100%);
    display: grid;
    gap: 22px;
    justify-items: center;
    margin-top: -6vh;
  }
  .logo {
    text-align: center;
    display: grid;
    justify-items: center;
    gap: 6px;
  }
  .paw {
    width: 64px;
    height: 64px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(160deg, #f8b671, var(--orange));
    box-shadow: 0 4px 0 var(--orange-dark), 0 10px 20px rgba(216, 132, 59, 0.35);
    transform: rotate(-8deg);
  }
  h1 {
    font-size: clamp(48px, 13vw, 72px);
    font-weight: 900;
    line-height: 0.95;
    color: var(--ink);
    letter-spacing: -0.02em;
    text-shadow:
      0 3px 0 #fff,
      0 6px 18px rgba(76, 59, 58, 0.15);
  }
  h1 span {
    color: var(--orange-dark);
  }
  .tag {
    font-weight: 700;
    color: var(--ink-soft);
    max-width: 300px;
    background: rgba(255, 250, 243, 0.75);
    padding: 6px 14px;
    border-radius: 14px;
  }
  .buttons {
    display: grid;
    gap: 12px;
    width: min(300px, 100%);
  }
  .buttons .btn {
    width: 100%;
    position: relative;
  }
  .big {
    min-height: 60px;
    font-size: 21px;
  }
  .badge {
    position: absolute;
    right: 14px;
    min-width: 26px;
    height: 26px;
    border-radius: 13px;
    background: var(--rose);
    color: #fff;
    font-size: 14px;
    display: grid;
    place-items: center;
    padding: 0 6px;
  }
  .stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 250, 243, 0.85);
    padding: 6px 12px;
    border-radius: 99px;
    font-weight: 800;
    color: var(--ink-soft);
    box-shadow: var(--shadow-sm);
  }
  .stat :global(svg) {
    color: var(--gold-dark);
  }
  .stat:last-child :global(svg) {
    color: var(--rose);
  }
  .fence-cats,
  .ground-cats {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 1;
  }
  .fence-cats {
    bottom: calc(14% + 40px);
  }
  .ground-cats {
    bottom: 3%;
  }
  .cat {
    position: absolute;
  }
  .sleeping {
    left: 8%;
    bottom: 0;
  }
  .sitting {
    right: 6%;
    bottom: 0;
  }
  .curious {
    left: 4%;
    bottom: 0;
  }
  .cat :global(.cat-tail) {
    transform-origin: 30% 85%;
    animation: tail 3.2s ease-in-out infinite;
  }
  .cat :global(.cat-body) {
    transform-origin: 50% 100%;
    animation: breathe 3.4s ease-in-out infinite;
  }
  .sleeping :global(.cat-body) {
    animation-duration: 4.4s;
  }
  .curious :global(.cat-head) {
    transform-origin: 56% 60%;
    animation: tilt 5s ease-in-out infinite;
  }
  @keyframes tail {
    0%,
    100% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-6deg);
    }
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(1.025);
    }
  }
  @keyframes tilt {
    0%,
    60%,
    100% {
      transform: rotate(0deg);
    }
    70%,
    90% {
      transform: rotate(8deg);
    }
  }
  @media (max-width: 640px) {
    .sitting {
      right: -4%;
    }
    .sitting :global(svg) {
      width: 110px;
      height: 110px;
    }
    .curious :global(svg) {
      width: 100px;
      height: 100px;
    }
    .sleeping :global(svg) {
      width: 90px;
      height: 90px;
    }
  }
  @media (max-height: 640px) {
    main {
      gap: 14px;
      margin-top: 0;
    }
    .ground-cats {
      display: none;
    }
  }
</style>
