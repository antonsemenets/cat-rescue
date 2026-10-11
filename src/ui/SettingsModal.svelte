<script lang="ts">
  import { app } from '../app/store.svelte';
  import { audio } from '../audio/audio';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import { viewport } from '../app/viewport.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let confirmReset = $state(false);
  const s = $derived(app.settings);

  function setSpeed(v: 1 | 2 | 3) {
    app.updateSettings({ animSpeed: v });
    audio.play('click');
  }
</script>

<Modal {onclose} label="Настройки" width={viewport.compact ? 760 : 440}>
  <div class="head">
    <h2>Настройки</h2>
    <button class="icon-btn" onclick={onclose} aria-label="Закрыть"><Icon name="close" /></button>
  </div>

  <div class="cols">
  <section>
    <label class="row">
      <span class="lbl"><Icon name="sound" size={20} /> Звуки</span>
      <input type="range" min="0" max="1" step="0.05" value={s.sfxVolume} oninput={(e) => app.updateSettings({ sfxVolume: +e.currentTarget.value })} onchange={() => audio.play('pop')} />
    </label>
    <label class="row">
      <span class="lbl"><Icon name="music" size={20} /> Музыка</span>
      <input type="range" min="0" max="1" step="0.05" value={s.musicVolume} oninput={(e) => app.updateSettings({ musicVolume: +e.currentTarget.value })} />
    </label>
    <label class="row toggle">
      <span class="lbl"><Icon name="mute" size={20} /> Без звука</span>
      <input type="checkbox" checked={s.muted} onchange={(e) => app.updateSettings({ muted: e.currentTarget.checked })} />
      <span class="switch" aria-hidden="true"></span>
    </label>
  </section>

  <section>
    <div class="row">
      <span class="lbl"><Icon name="speed" size={20} /> Скорость анимаций</span>
      <div class="seg" role="radiogroup" aria-label="Скорость анимаций">
        {#each [1, 2, 3] as v}
          <button role="radio" aria-checked={s.animSpeed === v} class:on={s.animSpeed === v} onclick={() => setSpeed(v as 1 | 2 | 3)}>{v}×</button>
        {/each}
      </div>
    </div>
    <label class="row toggle">
      <span class="lbl"><Icon name="eye" size={20} /> Меньше движения</span>
      <input type="checkbox" checked={s.reducedMotion} onchange={(e) => app.updateSettings({ reducedMotion: e.currentTarget.checked })} />
      <span class="switch" aria-hidden="true"></span>
    </label>
    <label class="row toggle">
      <span class="lbl"><Icon name="paw" size={20} /> Показывать маршруты кошек</span>
      <input type="checkbox" checked={s.showPaths} onchange={(e) => app.updateSettings({ showPaths: e.currentTarget.checked })} />
      <span class="switch" aria-hidden="true"></span>
    </label>
    <label class="row toggle">
      <span class="lbl"><Icon name="bulb" size={20} /> Подсказки</span>
      <input type="checkbox" checked={s.showHints} onchange={(e) => app.updateSettings({ showHints: e.currentTarget.checked })} />
      <span class="switch" aria-hidden="true"></span>
    </label>
  </section>

  </div>

  <section class="danger">
    {#if !confirmReset}
      <button class="btn small" onclick={() => (confirmReset = true)}>Сбросить прогресс</button>
    {:else}
      <p>Все звёзды и котики в приюте будут забыты. Точно?</p>
      <div class="btns">
        <button class="btn small rose" onclick={() => (app.resetProgress(), (confirmReset = false), onclose())}>Да, сбросить</button>
        <button class="btn small" onclick={() => (confirmReset = false)}>Отмена</button>
      </div>
    {/if}
  </section>
</Modal>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  h2 {
    font-size: 26px;
    font-weight: 900;
  }
  section {
    display: grid;
    gap: 6px;
    padding: 12px 0;
    border-top: 2px dashed var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    font-weight: 700;
    position: relative;
  }
  .lbl {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ink);
  }
  .lbl :global(svg) {
    color: var(--orange-dark);
  }
  input[type='range'] {
    width: 46%;
    accent-color: var(--orange);
  }
  .toggle input {
    position: absolute;
    opacity: 0;
    right: 0;
    width: 52px;
    height: 30px;
    margin: 0;
    cursor: pointer;
  }
  .switch {
    width: 52px;
    height: 30px;
    border-radius: 99px;
    background: #e8d9c6;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
    pointer-events: none;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s;
  }
  .toggle input:checked + .switch {
    background: var(--mint);
  }
  .toggle input:checked + .switch::after {
    transform: translateX(22px);
  }
  .toggle input:focus-visible + .switch {
    outline: 3px solid var(--sky-dark);
    outline-offset: 2px;
  }
  .seg {
    display: inline-flex;
    background: #f1e4d3;
    border-radius: 99px;
    padding: 3px;
  }
  .seg button {
    min-width: 44px;
    height: 34px;
    border-radius: 99px;
    font-weight: 800;
    color: var(--ink-soft);
  }
  .seg button.on {
    background: #fff;
    color: var(--ink);
    box-shadow: 0 2px 6px rgba(76, 59, 58, 0.15);
  }
  .danger p {
    font-weight: 700;
    color: var(--rose-dark);
  }
  .btns {
    display: flex;
    gap: 8px;
  }
  @media (max-height: 500px) and (orientation: landscape) {
    .head {
      margin-bottom: 4px;
    }
    h2 {
      font-size: 21px;
    }
    .cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 22px;
    }
    section {
      padding: 6px 0;
      gap: 2px;
    }
    .row {
      min-height: 38px;
      font-size: 14px;
    }
    .seg button {
      min-width: 38px;
      height: 30px;
    }
  }
</style>
