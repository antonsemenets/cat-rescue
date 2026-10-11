<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { GameSession, type Tool } from '../app/session.svelte';
  import { app } from '../app/store.svelte';
  import { audio } from '../audio/audio';
  import { levelById, nextLevel } from '../levels';
  import { BoardView } from '../render/BoardView';
  import Icon from './Icon.svelte';
  import InfoPanel from './hud/InfoPanel.svelte';
  import PauseModal from './hud/PauseModal.svelte';
  import Toolbar from './hud/Toolbar.svelte';
  import TopBar from './hud/TopBar.svelte';
  import VictoryModal from './hud/VictoryModal.svelte';
  import SashaDialog from './SashaDialog.svelte';
  import { SPRITES, preloadSprites } from '../art/sprites';

  preloadSprites(['sasha-wave', 'sasha-hold', 'sasha-hug', 'sasha-pet', 'sasha-face']);

  const def = levelById(app.levelId)!;
  const session = new GameSession(def);
  let boardEl: HTMLDivElement;
  let view: BoardView | null = null;
  let topH = $state(0);
  let botH = $state(0);
  let paused = $state(false);
  let dismissedProgress = $state<string | null>(null);

  onMount(() => {
    view = new BoardView(
      boardEl,
      {
        onHover: (c) => session.onHover(c),
        onTap: (c, id) => {
          audio.unlock();
          session.onTap(c, id);
        },
        onFx: (fx) => audio.play(fx === 'win' ? 'win' : fx),
      },
      { animSpeed: app.settings.animSpeed, reducedMotion: app.settings.reducedMotion },
    );
    void session.attach(view);
  });

  onDestroy(() => {
    session.detach();
    view?.destroy();
    view = null;
  });

  $effect(() => {
    const s = { animSpeed: app.settings.animSpeed, reducedMotion: app.settings.reducedMotion };
    view?.setSettings(s);
  });

  $effect(() => {
    void app.settings.showPaths;
    session.refresh();
  });

  $effect(() => {
    const top = topH;
    const bottom = botH + 16;
    view?.setInsets({ top: top + 4, bottom, left: 0, right: 0 });
  });

  function onkey(e: KeyboardEvent) {
    if (app.settingsOpen || paused || session.showVictory || session.briefing) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // a focused button handles Space/Enter itself — don't trigger a second action
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      session.skip();
    } else if ((e.key === 'z' || e.key === 'я' || e.key === 'Backspace') && !e.shiftKey) {
      e.preventDefault();
      session.undo();
    } else if ((e.key === 'R' || e.key === 'К') && e.shiftKey) {
      session.restart();
    } else if (e.key === 'Escape') {
      if (session.tool || session.selection || session.pendingTrap || session.pendingRotate) session.cancel();
      else paused = true;
    } else if (/^[1-7]$/.test(e.key)) {
      const tools = session.availableTools();
      const t: Tool | undefined = tools[Number(e.key) - 1];
      if (t) session.selectTool(t);
    } else if (e.key === '+' || e.key === '=') view?.zoomBy(1.2);
    else if (e.key === '-') view?.zoomBy(1 / 1.2);
  }

  function goNext() {
    const n = nextLevel(def.id);
    if (n) app.play(n.id);
  }

  const progressMsg = $derived(
    session.progress === 'stuck'
      ? 'Кажется, тупик: котиков больше ничего не заинтересует.'
      : session.progress === 'slow'
        ? 'Затянулось? Отмените пару ходов — может, найдётся путь короче.'
        : null,
  );
</script>

<svelte:window onkeydown={onkey} />

<div class="game" class:tool-active={!!session.tool}>
  <div class="bg" aria-hidden="true">
    <span class="cloud c1"></span>
    <span class="cloud c2"></span>
    <span class="cloud c3"></span>
  </div>
  <div class="board" bind:this={boardEl} role="application" aria-label="Игровое поле — {def.title}"></div>

  <TopBar {session} onpause={() => (paused = true)} bind:height={topH} />

  {#if session.briefing && def.intro}
    <SashaDialog
      lines={def.intro}
      title="Уровень {def.order} · {def.title}"
      bottomOffset={botH + 12}
      onfocus={(f) => session.setFocus(f)}
      onclose={() => session.closeBriefing()}
    />
  {/if}

  {#if session.hint && !session.replaying && !session.briefing}
    <div class="hint card" transition:fly={{ y: -10, duration: 220 }} style:top="{topH + 4}px">
      <img class="hint-ava" src={SPRITES['sasha-face']} alt="Саша" />
      <p>{session.hint}</p>
      <button class="hint-x" onclick={() => session.dismissHint()} aria-label="Скрыть подсказку"><Icon name="close" size={16} /></button>
    </div>
  {/if}

  {#if progressMsg && dismissedProgress !== session.progress + ':' + session.state.turn && !session.showVictory}
    <div class="banner card" transition:fly={{ y: -10, duration: 220 }} style:top="{topH + 4}px">
      <p>{progressMsg}</p>
      <div class="banner-btns">
        <button class="btn small" onclick={() => session.undo()}><Icon name="undo" size={18} /> Отменить</button>
        <button class="btn small" onclick={() => session.restart()}><Icon name="restart" size={18} /> Заново</button>
        {#if session.progress === 'slow'}
          <button class="btn small" onclick={() => (dismissedProgress = session.progress + ':' + session.state.turn)} aria-label="Скрыть"><Icon name="close" size={16} /></button>
        {/if}
      </div>
    </div>
  {/if}

  {#if session.replaying}
    <div class="replay card" transition:fade style:top="{topH + 4}px">
      <Icon name="film" size={20} /> Повтор решения
      <button class="btn small" onclick={() => session.stopReplay()}>Пропустить</button>
    </div>
  {/if}

  <InfoPanel {session} />

  {#if session.hoverText && session.tool}
    <div class="hover-tip" style:bottom="{botH + 22}px" transition:fade={{ duration: 120 }}>{session.hoverText}</div>
  {:else if session.tool && !session.hoverText}
    <div class="hover-tip soft" style:bottom="{botH + 22}px" transition:fade={{ duration: 120 }}>
      {session.pendingTrap ? 'Теперь выберите сторону входа' : session.pendingRotate ? 'Куда развернуть вход?' : 'Выберите клетку на поле · Esc — отмена'}
    </div>
  {/if}

  {#if session.toast}
    {#key session.toast.id}
      <div class="toast" class:info={session.toast.kind === 'info'} in:fly={{ y: 10, duration: 200 }} out:fade={{ duration: 200 }} style:bottom="{botH + 64}px" role="status">
        {session.toast.text}
      </div>
    {/key}
  {/if}

  <div class="zoom" style:bottom="{botH + 24}px">
    <button class="icon-btn" onclick={() => view?.zoomBy(1.25)} aria-label="Приблизить"><Icon name="zoomIn" size={22} /></button>
    <button class="icon-btn" onclick={() => view?.zoomBy(1 / 1.25)} aria-label="Отдалить"><Icon name="zoomOut" size={22} /></button>
  </div>

  <Toolbar {session} bind:height={botH} />

  {#if session.loading}
    <div class="loading" out:fade={{ duration: 300 }}>
      <div class="spinner"><Icon name="paw" size={40} /></div>
      <p>Котики собираются…</p>
    </div>
  {/if}

  {#if session.showVictory && session.result}
    <VictoryModal {session} onnext={goNext} onshelter={() => app.go('shelter')} />
  {/if}

  {#if paused}
    <PauseModal onclose={() => (paused = false)} onrestart={() => session.restart()} />
  {/if}
</div>

<style>
  .game {
    position: absolute;
    inset: 0;
    overflow: hidden;
    overflow: clip;
    user-select: none;
    -webkit-user-select: none;
  }
  .bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 40% at 20% 10%, rgba(255, 255, 255, 0.7), transparent 70%),
      radial-gradient(ellipse 50% 35% at 85% 20%, rgba(255, 246, 207, 0.8), transparent 70%),
      linear-gradient(180deg, #cde6ea 0%, #e3f0e2 45%, #efeedb 75%, #f4e9d6 100%);
  }
  .cloud {
    position: absolute;
    width: 160px;
    height: 46px;
    border-radius: 50px;
    background: rgba(255, 253, 248, 0.85);
    box-shadow:
      36px -18px 0 4px rgba(255, 253, 248, 0.85),
      80px -4px 0 0 rgba(255, 253, 248, 0.85);
    animation: drift 90s linear infinite;
  }
  .c1 {
    top: 14%;
    left: -12%;
  }
  .c2 {
    top: 30%;
    left: 50%;
    transform: scale(0.65);
    animation-duration: 120s;
    animation-delay: -50s;
    opacity: 0.8;
  }
  .c3 {
    top: 8%;
    left: 75%;
    transform: scale(0.8);
    animation-duration: 140s;
    animation-delay: -90s;
  }
  @keyframes drift {
    from {
      translate: -30vw 0;
    }
    to {
      translate: 120vw 0;
    }
  }
  .board {
    position: absolute;
    inset: 0;
    touch-action: none;
  }
  .board :global(canvas) {
    display: block;
  }
  .tool-active .board {
    cursor: crosshair;
  }
  .hint,
  .banner,
  .replay {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    border-radius: 18px;
    max-width: min(560px, calc(100vw - 24px));
    width: max-content;
  }
  .hint p,
  .banner p {
    font-weight: 700;
    font-size: 15px;
    line-height: 1.3;
  }
  .hint-ava {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #fde3c6;
    box-shadow:
      0 0 0 3px #fff,
      0 0 0 5px var(--orange);
    animation: avaPop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
  }
  @keyframes avaPop {
    from {
      transform: scale(0.4) rotate(-20deg);
      opacity: 0;
    }
  }
  .hint-x {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: var(--ink-faint);
    flex-shrink: 0;
  }
  .hint-x:hover {
    background: #f6eadb;
  }
  .banner {
    flex-wrap: wrap;
    justify-content: center;
    background: #fff4ef;
  }
  .banner-btns {
    display: flex;
    gap: 6px;
  }
  .replay {
    font-weight: 800;
  }
  .hover-tip {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9;
    padding: 7px 14px;
    border-radius: 12px;
    background: rgba(76, 59, 58, 0.88);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    max-width: calc(100vw - 24px);
    text-align: center;
    pointer-events: none;
  }
  .hover-tip.soft {
    background: rgba(76, 59, 58, 0.6);
  }
  .toast {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    padding: 10px 18px;
    border-radius: 14px;
    background: #fff;
    color: var(--rose-dark);
    font-weight: 800;
    box-shadow: var(--shadow);
    border: 2px solid var(--rose-soft);
    max-width: calc(100vw - 24px);
    text-align: center;
  }
  .toast.info {
    color: var(--mint-dark);
    border-color: var(--mint-soft);
  }
  .zoom {
    position: absolute;
    right: 12px;
    z-index: 9;
    display: grid;
    gap: 8px;
  }
  .loading {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    background: var(--cream);
    font-weight: 800;
    color: var(--ink-soft);
  }
  .spinner {
    color: var(--orange);
    animation: bob 0.9s ease-in-out infinite;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(-8deg);
    }
    50% {
      transform: translateY(-10px) rotate(8deg);
    }
  }
  @media (max-width: 640px) {
    .zoom {
      right: 8px;
      gap: 6px;
    }
    .zoom :global(.icon-btn) {
      width: 40px;
      height: 40px;
      border-radius: 14px;
    }
    .hint p,
    .banner p {
      font-size: 14px;
    }
  }
</style>
