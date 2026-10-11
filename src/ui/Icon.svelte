<script lang="ts" module>
  // Hand-drawn style UI icons (24×24, round strokes).
  export const ICONS = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    restart: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
    pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" stroke="none"/>',
    play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>',
    skip: '<path d="M5 6v12l8-6z" fill="currentColor"/><path d="M13 6v12l8-6z" fill="currentColor"/>',
    speed: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/>',
    sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.4" fill="currentColor"/><circle cx="17" cy="16" r="2.4" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/>',
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10.5 19v-4.5h3V19"/>',
    levels: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.6" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    paw: '<ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" fill="currentColor" stroke="none"/><ellipse cx="6.3" cy="10.5" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/><ellipse cx="9.6" cy="7" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="14.4" cy="7" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="17.7" cy="10.5" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M8 11h6"/>',
    film: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor"/>',
    shelter: '<path d="M3.5 11.5 12 4.5l8.5 7"/><path d="M6 10v9.5h12V10"/><path d="M12 17.2s-2.6-1.6-2.6-3.4a1.4 1.4 0 0 1 2.6-.8 1.4 1.4 0 0 1 2.6.8c0 1.8-2.6 3.4-2.6 3.4z" fill="currentColor"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.4 1.2 2.3V16h4v-.2c0-.9.5-1.8 1.2-2.3A5.5 5.5 0 0 0 12 3.5z"/>',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 24, stroke = 2.2 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html ICONS[name]}
</svg>
