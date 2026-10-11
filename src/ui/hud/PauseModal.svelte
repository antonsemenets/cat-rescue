<script lang="ts">
  import { app } from '../../app/store.svelte';
  import Icon from '../Icon.svelte';
  import Modal from '../Modal.svelte';

  let { onclose, onrestart }: { onclose: () => void; onrestart: () => void } = $props();
</script>

<Modal {onclose} label="Пауза" width={340}>
  <div class="pause">
    <h2>Пауза</h2>
    <button class="btn primary" onclick={onclose}><Icon name="play" /> Продолжить</button>
    <button class="btn" onclick={() => (onrestart(), onclose())}><Icon name="restart" /> Начать заново</button>
    <button class="btn" onclick={() => (app.settingsOpen = true)}><Icon name="settings" /> Настройки</button>
    <button class="btn" onclick={() => app.go('levels')}><Icon name="levels" /> Уровни</button>
    <button class="btn" onclick={() => app.go('menu')}><Icon name="home" /> Главное меню</button>
    <p class="keys">Пробел — ждать · Z — отменить · Esc — отмена · 1–7 — инструменты</p>
  </div>
</Modal>

<style>
  .pause {
    display: grid;
    gap: 10px;
  }
  h2 {
    text-align: center;
    font-size: 28px;
    font-weight: 900;
    margin-bottom: 6px;
  }
  .btn {
    width: 100%;
  }
  .keys {
    margin-top: 6px;
    text-align: center;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-faint);
  }
</style>
