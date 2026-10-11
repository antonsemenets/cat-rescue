<script lang="ts">
  import { catSvg, CAT_POSES } from '../../art/cats';
  import * as P from '../../art/props';
  import { LEVELS } from '../../levels';

  const cats = LEVELS.flatMap((l) => l.cats);
  const props = [
    P.bushSvg(0), P.bushFrontSvg(), P.treeSvg(0), P.treeSvg(1), P.rockSvg(), P.kibbleSvg(), P.tunaSvg(), P.toySvg(),
    P.mowerSvg(), P.radioSvg(), P.chimesSvg(), P.heartSvg(), P.sparkleSvg(), P.zzzSvg(), P.scentSvg(), P.shadeSvg(),
    P.flowerSvg(0), P.flowerSvg(1), P.flowerSvg(2), P.tuftSvg(), P.pebblesSvg(),
    ...(['food', 'question', 'alert', 'heart', 'toy', 'sleep'] as const).map((k) => P.emoteSvg(k)),
  ];
</script>

<div class="wrap">
  <h3>Props</h3>
  <div class="row">
    {#each props as s}
      <figure>{@html s}</figure>
    {/each}
  </div>
  {#each cats as c (c.id)}
    <h3>{c.name} — {c.look.pattern}</h3>
    <div class="row">
      {#each CAT_POSES as pose}
        <figure>
          {@html catSvg(c.look, pose, { size: 128 })}
          <figcaption>{pose}</figcaption>
        </figure>
      {/each}
    </div>
  {/each}
</div>

<style>
  .wrap { padding: 16px; background: #a9cb86; min-height: 100vh; overflow: auto; height: 100vh; box-sizing: border-box; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
  figure { margin: 0; background: #b8d696; border-radius: 12px; text-align: center; font-size: 12px; padding: 4px; }
  h3 { margin: 12px 0 4px; font-family: sans-serif; }
</style>
