// Audio — tiny WebAudio synthesiser for effects and a calm generative
// background loop. Real samples can be registered with `registerSample`;
// a missing or broken file silently falls back to the synthesised sound.

export type Sfx =
  | 'meow'
  | 'step'
  | 'rustle'
  | 'pop'
  | 'door'
  | 'eat'
  | 'rescue'
  | 'scared'
  | 'gate'
  | 'win'
  | 'click'
  | 'purr'
  | 'error'
  | 'undo';

interface Volumes {
  sfx: number;
  music: number;
  muted: boolean;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private samples = new Map<Sfx, AudioBuffer>();
  private pendingSamples = new Map<Sfx, string>();
  private vol: Volumes = { sfx: 0.7, music: 0.4, muted: false };
  private musicOn = false;
  private musicTimer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private lastPlayed = new Map<Sfx, number>();

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      // deterministic pseudo noise (LCG) — no Math.random anywhere in the game
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.applyVolumes();
      for (const [name, url] of this.pendingSamples) void this.loadSample(name, url);
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: Volumes) {
    this.vol = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.2);
  }

  registerSample(name: Sfx, url: string) {
    this.pendingSamples.set(name, url);
    if (this.ctx) void this.loadSample(name, url);
  }

  private async loadSample(name: Sfx, url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.samples.set(name, buf);
    } catch {
      // keep the synthesised fallback
    }
  }

  // ---------------------------------------------------------------------------
  // building blocks

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, out: AudioNode = this.sfxBus, attack = 0.01) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, attack, peak, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private noise(t: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.005, peak, dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, (t * 7.31) % 0.5);
    src.stop(t + dur + 0.05);
  }

  private meow(t: number, pitch = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    const g = ctx.createGain();
    const p = 560 * pitch;
    o.frequency.setValueAtTime(p * 0.9, t);
    o.frequency.linearRampToValueAtTime(p * 1.35, t + 0.14);
    o.frequency.linearRampToValueAtTime(p * 0.82, t + 0.42);
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1700, t + 0.16);
    f.frequency.linearRampToValueAtTime(800, t + 0.42);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
    g.gain.setValueAtTime(0.16, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.5);
  }

  play(name: Sfx) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    // rate-limit repeated triggers (several cats stepping at once)
    const last = this.lastPlayed.get(name) ?? -1;
    const minGap = name === 'step' ? 0.09 : name === 'meow' ? 0.35 : 0.03;
    if (now - last < minGap) return;
    this.lastPlayed.set(name, now);

    const sample = this.samples.get(name);
    if (sample) {
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      src.connect(this.sfxBus);
      src.start(now);
      return;
    }
    const t = now + 0.005;
    switch (name) {
      case 'meow':
        this.meow(t, 0.95 + ((now * 13) % 1) * 0.15);
        break;
      case 'step':
        this.noise(t, 0.05, 0.035, 'bandpass', 2400, 0.8);
        break;
      case 'rustle':
        this.noise(t, 0.22, 0.09, 'bandpass', 3200, 0.6);
        this.noise(t + 0.08, 0.18, 0.06, 'bandpass', 2200, 0.6);
        break;
      case 'pop':
        this.tone('sine', 520, 880, t, 0.09, 0.18);
        this.tone('triangle', 880, 1100, t + 0.03, 0.06, 0.06);
        break;
      case 'door':
        this.noise(t, 0.04, 0.22, 'highpass', 1800);
        this.tone('sine', 220, 120, t, 0.12, 0.25);
        this.tone('square', 1400, 900, t + 0.01, 0.03, 0.03);
        break;
      case 'eat':
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, 0.03, 0.08, 'bandpass', 1500 + i * 300, 2);
        break;
      case 'rescue': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.tone('triangle', f, f, t + i * 0.09, 0.32, 0.14));
        this.tone('sine', 1046.5, 1046.5, t + 0.36, 0.6, 0.06);
        break;
      }
      case 'scared':
        this.noise(t, 0.22, 0.07, 'highpass', 3500);
        this.tone('sawtooth', 420, 300, t, 0.18, 0.04);
        break;
      case 'gate':
        this.tone('sawtooth', 190, 140, t, 0.22, 0.05);
        this.noise(t + 0.18, 0.05, 0.12, 'bandpass', 900, 1.5);
        break;
      case 'win': {
        const seq = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
        seq.forEach((f, i) => this.tone('triangle', f, f, t + i * 0.11, 0.35, 0.13));
        [523.25, 659.25, 783.99].forEach((f) => this.tone('sine', f, f, t + 0.7, 1.2, 0.07, this.sfxBus, 0.05));
        this.meow(t + 0.9, 1.1);
        break;
      }
      case 'click':
        this.tone('sine', 900, 700, t, 0.04, 0.08);
        break;
      case 'undo':
        this.tone('sine', 700, 420, t, 0.12, 0.1);
        break;
      case 'error':
        this.tone('triangle', 300, 220, t, 0.16, 0.12);
        break;
      case 'purr': {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 260;
        const am = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 24;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain).connect(am.gain);
        am.gain.value = 0.5;
        const g = ctx.createGain();
        this.env(g, t, 0.15, 0.5, 1.1);
        src.connect(f).connect(am).connect(g).connect(this.sfxBus);
        src.start(t);
        lfo.start(t);
        src.stop(t + 1.4);
        lfo.stop(t + 1.4);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // background music: four warm chords and a soft plucked melody

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextBar = this.ctx.currentTime + 0.2;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 250);
    this.scheduleMusic();
  }

  private stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx) return;
    const BAR = 3.6;
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
    ];
    const melody = [
      [659.25, 783.99, 659.25, 587.33],
      [523.25, 659.25, 587.33, 523.25],
      [440.0, 523.25, 587.33, 659.25],
      [587.33, 493.88, 523.25, 587.33],
    ];
    while (this.nextBar < this.ctx.currentTime + 1.2) {
      const t = this.nextBar;
      const i = this.bar % 4;
      for (const f of chords[i]) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f / 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + BAR + 0.6);
        o.connect(g).connect(this.musicBus);
        o.start(t);
        o.stop(t + BAR + 0.7);
      }
      const mel = melody[i];
      const pattern = this.bar % 2 === 0 ? [0, 1, 2, 3] : [0, 2, 3];
      pattern.forEach((k, j) => {
        const nt = t + 0.3 + j * (BAR / pattern.length);
        this.tone('triangle', mel[k], mel[k], nt, 0.9, 0.035, this.musicBus, 0.02);
      });
      this.nextBar += BAR;
      this.bar++;
    }
  }
}

export const audio = new AudioEngine();
