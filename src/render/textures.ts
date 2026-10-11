// Rasterise SVG strings into Phaser textures (once per key).

import type Phaser from 'phaser';

export interface SvgTexture {
  key: string;
  svg: string;
  /** logical size of the svg (its viewBox) */
  w: number;
  h: number;
}

function loadImage(svg: string, w: number, h: number): Promise<HTMLImageElement> {
  // bake the target pixel size into the svg so the browser rasterises it sharply
  const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Ensure every texture exists; `scale` = pixels per svg unit. */
export async function ensureTextures(scene: Phaser.Scene, list: SvgTexture[], scale: number): Promise<void> {
  const todo = list.filter((t) => !scene.textures.exists(t.key));
  await Promise.all(
    todo.map(async (t) => {
      const pw = Math.ceil(t.w * scale);
      const ph = Math.ceil(t.h * scale);
      try {
        const img = await loadImage(t.svg, pw, ph);
        if (scene.textures.exists(t.key)) return;
        const canvas = document.createElement('canvas');
        canvas.width = pw;
        canvas.height = ph;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, pw, ph);
        scene.textures.addCanvas(t.key, canvas);
      } catch {
        // a broken asset must never crash the game: use a 1px placeholder
        if (!scene.textures.exists(t.key)) {
          const c = document.createElement('canvas');
          c.width = c.height = 2;
          scene.textures.addCanvas(t.key, c);
        }
      }
    }),
  );
}
