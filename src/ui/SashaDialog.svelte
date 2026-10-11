<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SPRITES, type SpriteName } from '../art/sprites';
  import { app } from '../app/store.svelte';
  import { audio } from '../audio/audio';
  import type { IntroLine, SashaPose } from '../core/level';
  import Icon from './Icon.svelte';

  let {
    lines,
    title,
    bottomOffset = 0,
    rightOffset = 0,
    onfocus,
    onclose,
  }: {
    lines: IntroLine[];
    title?: string;
    bottomOffset?: number;
    rightOffset?: number;
    onfocus?: (focus: IntroLine['focus'] | undefined) => void;
    onclose: () => void;
  } = $props();

  const POSE_SPRITE: Record<SashaPose, SpriteName> = {
    wave: 'sasha-wave',
    hold: 'sasha-hold',
    hug: 'sasha-hug',
    pet: 'sasha-pet',
  };

  let index = $state(0);
  let shown = $state(0);
  let leaving = $state(false);
  let poseKey = $state(0);
  let timer: number | null = null;

  const line = $derived(lines[Math.min(index, lines.length - 1)]);
  const full = $derived(line?.text ?? '');
  const typing = $derived(shown < full.length);
  const last = $derived(index >= lines.length - 1);

  function startTyping() {
    if (timer) clearInterval(timer);
    shown = 0;
    if (app.settings.reducedMotion) {
      shown = full.length;
      return;
    }
    const step = Math.max(8, 26 / app.settings.animSpeed);
    timer = window.setInterval(() => {
      shown = Math.min(full.length, shown + 1);
      if (shown % 9 === 0) audio.play('click');
      if (shown >= full.length && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, step);
  }

  function show(i: number) {
    const prevPose = lines[index]?.pose;
    index = i;
    if (lines[i].pose !== prevPose || i === 0) poseKey++;
    onfocus?.(lines[i].focus);
    startTyping();
  }

  function advance() {
    if (leaving) return;
    audio.unlock();
    if (typing) {
      shown = full.length;
      return;
    }
    if (last) close();
    else {
      audio.play('pop');
      show(index + 1);
    }
  }

  function close() {
    if (leaving) return;
    leaving = true;
    onfocus?.(undefined);
    if (timer) clearInterval(timer);
    window.setTimeout(onclose, app.settings.reducedMotion ? 0 : 420);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      advance();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }

  onMount(() => {
    show(0);
    audio.play('meow');
  });
  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<svelte:window onkeydowncapture={onkey} />

<div class="dlg" class:leaving style:--bottom="{bottomOffset}px" style:--right="{rightOffset}px" role="dialog" aria-modal="true" aria-label="Саша рассказывает">
  <button class="shade" onclick={advance} aria-label="Дальше"></button>

  {#key poseKey}
    <img class="sasha pose-{line.pose}" src={SPRITES[POSE_SPRITE[line.pose]]} alt="Саша" draggable="false" />
  {/key}

  <div class="box" onclick={advance} role="presentation">
    <div class="name">
      <img src={SPRITES['sasha-face']} alt="" />
      <span>Саша</span>
    </div>
    {#if title}<div class="title">{title}</div>{/if}
    <p class="text" aria-live="polite">
      {full.slice(0, shown)}<span class="ghost">{full.slice(shown)}</span>
    </p>
    <div class="foot">
      <div class="dots" aria-hidden="true">
        {#each lines as _, i}<i class:on={i === index} class:done={i < index}></i>{/each}
      </div>
      <button class="skip" onclick={(e) => (e.stopPropagation(), close())}>Пропустить</button>
      <button class="btn primary small next" onclick={(e) => (e.stopPropagation(), advance())}>
        {#if last && !typing}<Icon name="paw" size={18} /> Начать!{:else}Дальше <Icon name="next" size={18} />{/if}
      </button>
    </div>
  </div>
</div>

<style>
  .dlg {
    position: absolute;
    inset: 0;
    z-index: 45;
    overflow: clip;
    --ease-back: cubic-bezier(0.2, 0.9, 0.3, 1.25);
  }
  .shade {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 20% 100%, rgba(255, 236, 210, 0.55), transparent 70%),
      linear-gradient(180deg, rgba(76, 59, 58, 0.08) 0%, rgba(76, 59, 58, 0.18) 55%, rgba(76, 59, 58, 0.45) 100%);
    backdrop-filter: blur(1.5px);
    animation: fadeIn 0.35s ease-out both;
    cursor: pointer;
  }
  .leaving .shade {
    animation: fadeOut 0.4s ease-in both;
  }

  .sasha {
    position: absolute;
    left: max(0px, calc(50% - 620px));
    bottom: -5vh;
    height: min(78vh, 640px);
    pointer-events: none;
    user-select: none;
    transform-origin: 50% 100%;
    filter: drop-shadow(0 12px 24px rgba(60, 40, 30, 0.25));
    animation:
      slideIn 0.75s var(--ease-back) both,
      idle 4.6s ease-in-out 0.8s infinite;
  }
  .sasha.pose-hug {
    height: min(52vh, 460px);
    bottom: calc(var(--bottom) - 2vh);
  }
  .sasha.pose-pet {
    height: min(40vh, 340px);
    bottom: calc(var(--bottom) - 1vh);
  }
  .leaving .sasha {
    animation: slideOut 0.4s ease-in both;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-40%) rotate(-4deg);
    }
  }
  @keyframes slideOut {
    to {
      opacity: 0;
      transform: translateX(-45%) rotate(-5deg);
    }
  }
  @keyframes idle {
    0%,
    100% {
      transform: rotate(-0.8deg);
    }
    50% {
      transform: rotate(0.8deg) translateY(-6px);
    }
  }

  .box {
    position: absolute;
    left: max(240px, calc(50% - 300px));
    right: max(16px, calc(50% - 470px));
    bottom: calc(var(--bottom) + 14px);
    padding: 26px 26px 18px;
    border-radius: 28px;
    background: linear-gradient(180deg, #fffdf8, #fff6ea);
    border: 3px solid #f2d6b3;
    box-shadow:
      0 6px 0 #e8c79f,
      0 18px 40px rgba(76, 59, 58, 0.25);
    cursor: pointer;
    animation: boxIn 0.55s var(--ease-back) 0.2s both;
  }
  /* speech tail pointing at Sasha */
  .box::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 38px;
    width: 26px;
    height: 26px;
    background: #fffcf4;
    border-left: 3px solid #f2d6b3;
    border-bottom: 3px solid #f2d6b3;
    border-radius: 0 0 0 8px;
    transform: rotate(45deg);
  }
  .leaving .box {
    animation: boxOut 0.35s ease-in both;
  }
  @keyframes boxIn {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.92);
    }
  }
  @keyframes boxOut {
    to {
      opacity: 0;
      transform: translateY(24px) scale(0.95);
    }
  }
  .name {
    position: absolute;
    top: -20px;
    left: 22px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px 4px 4px;
    border-radius: 99px;
    color: #fff;
    font-weight: 900;
    font-size: 17px;
    background: linear-gradient(180deg, #f8b671, var(--orange));
    box-shadow: 0 3px 0 var(--orange-dark);
    text-shadow: 0 1px 0 rgba(150, 80, 20, 0.35);
    animation: tag 0.6s var(--ease-back) 0.45s both;
  }
  .name img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #fde3c6;
    box-shadow: 0 0 0 2px #fff;
  }
  @keyframes tag {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.6);
    }
  }
  .title {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--orange-dark);
    margin-bottom: 4px;
  }
  .text {
    font-size: 19px;
    font-weight: 700;
    line-height: 1.45;
    color: var(--ink);
    min-height: 2.9em;
  }
  .ghost {
    visibility: hidden;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }
  .dots {
    display: flex;
    gap: 6px;
    flex: 1;
  }
  .dots i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #ecdcc6;
    transition:
      transform 0.25s,
      background 0.25s;
  }
  .dots i.done {
    background: #f6c48e;
  }
  .dots i.on {
    background: var(--orange);
    transform: scale(1.35);
  }
  .skip {
    font-weight: 800;
    font-size: 14px;
    color: var(--ink-faint);
    padding: 8px 10px;
    border-radius: 12px;
  }
  .skip:hover {
    color: var(--ink-soft);
    background: #f6eadb;
  }
  .next {
    min-width: 128px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
  }
  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }

  /* phones: Sasha peeks above the dialog box */
  @media (max-width: 720px) and (min-height: 501px) {
    .sasha {
      left: -6vw;
      height: min(60vh, 520px);
      bottom: calc(var(--bottom) + 40px);
    }
    .sasha.pose-hug {
      height: min(36vh, 320px);
      bottom: calc(var(--bottom) + 120px);
    }
    .sasha.pose-pet {
      height: min(26vh, 230px);
      bottom: calc(var(--bottom) + 130px);
    }
    .box {
      left: 10px;
      right: 10px;
      padding: 24px 18px 14px;
    }
    .box::before {
      left: 46px;
      top: -15px;
      border-left: 3px solid #f2d6b3;
      border-bottom: none;
      border-top: 3px solid #f2d6b3;
      border-radius: 8px 0 0 0;
    }
    .name {
      left: auto;
      right: 18px;
    }
    .text {
      font-size: 16.5px;
    }
    .next {
      min-width: 0;
    }
  }

  /* phone held sideways: Sasha on the left, a slim box between her and the tool column */
  @media (max-height: 500px) and (orientation: landscape) {
    .sasha {
      left: calc(var(--safe-left) - 2vw);
      height: 96vh;
      bottom: -8vh;
    }
    .sasha.pose-hug {
      height: 66vh;
      bottom: -2vh;
    }
    .sasha.pose-pet {
      height: 46vh;
      bottom: 0;
    }
    .box {
      left: calc(var(--safe-left) + min(34vw, 300px));
      right: calc(var(--right) + 10px + var(--safe-right));
      bottom: calc(var(--bottom) + 4px);
      padding: 20px 18px 10px;
      border-radius: 22px;
    }
    .box::before {
      top: 30px;
    }
    .name {
      top: -17px;
      left: 16px;
      font-size: 14.5px;
      padding: 3px 12px 3px 3px;
    }
    .name img {
      width: 26px;
      height: 26px;
    }
    .title {
      font-size: 11px;
      margin-bottom: 2px;
    }
    .text {
      font-size: 15.5px;
      line-height: 1.38;
      min-height: 2.76em;
    }
    .foot {
      margin-top: 8px;
    }
    .next {
      min-width: 0;
      min-height: 36px;
      font-size: 14px;
    }
    .skip {
      font-size: 13px;
    }
  }
</style>
