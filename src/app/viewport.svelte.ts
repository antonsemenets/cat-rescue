// Reactive viewport facts shared by the UI.
//
// "compact" = a phone held sideways: very little height, plenty of width.
// Components switch to side panels and smaller type in that mode. The same
// query is used in CSS media rules so JS and CSS always agree.

export const COMPACT_QUERY = '(max-height: 500px) and (orientation: landscape)';

class Viewport {
  compact = $state(false);

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(COMPACT_QUERY);
    this.compact = mq.matches;
    mq.addEventListener('change', (e) => (this.compact = e.matches));
  }
}

export const viewport = new Viewport();
