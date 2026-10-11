// Illustrated sprites (sliced from assets-src/ by scripts/slice_sprites.py).
// Vite turns every file into a hashed URL at build time.

const files = import.meta.glob('../assets/sprites/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type SpriteName =
  | 'meadow'
  | 'tree'
  | 'house'
  | `cloud-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11}`
  | 'bush-wide'
  | 'bush-round'
  | 'sun'
  | 'fence-short'
  | 'fence-long'
  | 'pine'
  | 'flowers'
  | 'grass'
  | 'stones'
  | 'sasha-hold'
  | 'sasha-wave'
  | 'sasha-hug'
  | 'sasha-pet'
  | 'sasha-face'
  | 'fluffy-sit'
  | 'fluffy-sleep'
  | 'fluffy-stand'
  | 'grey-walk'
  | 'grey-sit'
  | 'orange-happy'
  | 'orange-look'
  | 'cat-nap'
  | 'logo-icon'
  | 'logo-leaf-l'
  | 'logo-leaf-r'
  | 'logo-word';

export const SPRITES = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1).replace('.webp', ''), url]),
) as Record<SpriteName, string>;

/** Warm the browser cache so sprites appear without a flash. */
export function preloadSprites(names: SpriteName[]): void {
  for (const n of names) {
    const img = new Image();
    img.decoding = 'async';
    img.src = SPRITES[n];
  }
}
