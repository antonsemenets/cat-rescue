<script lang="ts">
  // Decorative cozy backdrop for menus: sky, clouds, hills, fence, grass.
  let { variant = 'day' }: { variant?: 'day' | 'evening' } = $props();
</script>

<div class="scenery {variant}" aria-hidden="true">
  <div class="sky"></div>
  <div class="sun"></div>
  <div class="cloud c1"></div>
  <div class="cloud c2"></div>
  <div class="cloud c3"></div>
  <svg class="hills" viewBox="0 0 1200 300" preserveAspectRatio="none">
    <path d="M0 170 C160 110 300 120 460 160 C620 200 760 110 920 120 C1040 128 1120 150 1200 140 L1200 300 L0 300 Z" fill="#c9dfb0" />
    <path d="M0 220 C180 170 360 190 520 210 C700 232 860 170 1040 180 C1110 184 1160 196 1200 200 L1200 300 L0 300 Z" fill="#b5d394" />
  </svg>
  <svg class="fence" viewBox="0 0 1200 120" preserveAspectRatio="none">
    <rect x="0" y="40" width="1200" height="12" rx="4" fill="#d9ab7b" stroke="#8a5f3e" stroke-width="3" />
    <rect x="0" y="74" width="1200" height="12" rx="4" fill="#d9ab7b" stroke="#8a5f3e" stroke-width="3" />
    {#each Array(25) as _, i}
      <path d="M{i * 50 + 14} 120 V22 L{i * 50 + 24} 10 L{i * 50 + 34} 22 V120 Z" fill="#e8c193" stroke="#8a5f3e" stroke-width="3" stroke-linejoin="round" />
    {/each}
  </svg>
  <div class="grass"></div>
  <svg class="flowers" viewBox="0 0 1200 80" preserveAspectRatio="none">
    {#each Array(26) as _, i}
      {@const x = i * 47 + ((i * 37) % 23)}
      {@const y = 30 + ((i * 53) % 34)}
      <path d="M{x} {y + 22} V{y + 6}" stroke="#6f9f57" stroke-width="2.5" />
      <circle cx={x} cy={y + 4} r="6" fill={['#f7b2c0', '#fff1a8', '#c9b6f2', '#fff6e0'][i % 4]} stroke="#7c6a5a" stroke-width="1.5" />
      <circle cx={x} cy={y + 4} r="2.2" fill="#f2c46d" />
    {/each}
  </svg>
</div>

<style>
  .scenery {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .sky {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #bfe1ea 0%, #dcefe6 45%, #f4ecd6 75%, #f7ecdc 100%);
  }
  .evening .sky {
    background: linear-gradient(180deg, #f5c9b3 0%, #f8dcc4 45%, #f6e7d3 80%);
  }
  .sun {
    position: absolute;
    top: 8%;
    right: 12%;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff6cf 0%, #ffe9a6 55%, rgba(255, 233, 166, 0) 72%);
  }
  .cloud {
    position: absolute;
    width: 180px;
    height: 56px;
    border-radius: 60px;
    background: #fffdf8;
    opacity: 0.9;
    box-shadow:
      40px -22px 0 6px #fffdf8,
      90px -6px 0 0 #fffdf8;
    animation: drift 70s linear infinite;
  }
  .c1 {
    top: 12%;
    left: -10%;
  }
  .c2 {
    top: 24%;
    left: 40%;
    transform: scale(0.7);
    animation-duration: 95s;
    animation-delay: -30s;
  }
  .c3 {
    top: 6%;
    left: 70%;
    transform: scale(0.85);
    animation-duration: 110s;
    animation-delay: -60s;
  }
  @keyframes drift {
    from {
      translate: -30vw 0;
    }
    to {
      translate: 120vw 0;
    }
  }
  .hills {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 18%;
    width: 100%;
    height: 34%;
  }
  .fence {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 14%;
    width: 100%;
    height: 14%;
    min-height: 70px;
  }
  .grass {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 17%;
    background: linear-gradient(180deg, #a9cb86, #97bd74);
    border-top: 4px solid #8fbb6c;
  }
  .flowers {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2%;
    width: 100%;
    height: 12%;
  }
</style>
