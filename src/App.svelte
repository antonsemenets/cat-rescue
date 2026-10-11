<script lang="ts">
  import { fade } from 'svelte/transition';
  import { app } from './app/store.svelte';
  import { audio } from './audio/audio';
  import GameScreen from './ui/GameScreen.svelte';
  import LevelSelect from './ui/LevelSelect.svelte';
  import MainMenu from './ui/MainMenu.svelte';
  import SettingsModal from './ui/SettingsModal.svelte';
  import Shelter from './ui/Shelter.svelte';

  let musicStarted = false;
  function firstGesture() {
    audio.unlock();
    if (!musicStarted) {
      musicStarted = true;
      audio.setMusic(true);
    }
  }

  $effect(() => {
    document.documentElement.classList.toggle('reduced-motion', app.settings.reducedMotion);
  });
</script>

<svelte:window onpointerdown={firstGesture} onkeydown={firstGesture} />

{#key app.screen + (app.screen === 'game' ? app.levelId : '')}
  <div class="screen" in:fade={{ duration: 260 }}>
    {#if app.screen === 'menu'}
      <MainMenu />
    {:else if app.screen === 'levels'}
      <LevelSelect />
    {:else if app.screen === 'game'}
      <GameScreen />
    {:else if app.screen === 'shelter'}
      <Shelter />
    {/if}
  </div>
{/key}

{#if app.settingsOpen}
  <SettingsModal onclose={() => (app.settingsOpen = false)} />
{/if}

<style>
  .screen {
    position: absolute;
    inset: 0;
  }
</style>
