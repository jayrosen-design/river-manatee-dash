// Lightweight WebAudio SFX — no external files. Created on first unlock.
import { STORAGE_KEYS } from "../constants";

type SfxName =
  | "pickup"
  | "warn"
  | "splash"
  | "complete"
  | "gameover"
  | "click"
  | "closeCall"
  | "dash"
  | "gate"
  | "locked"
  | "ambience";

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceNode: { stop: () => void } | null = null;
  private _muted = false;
  unlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      this._muted = window.localStorage.getItem(STORAGE_KEYS.MUTED) === "1";
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.MUTED, m ? "1" : "0");
    }
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  /** Pause all sound (e.g. game paused / hidden). */
  suspend() {
    void this.ctx?.suspend().catch(() => {});
  }

  /** Resume sound after a suspend. */
  resume() {
    void this.ctx?.resume().catch(() => {});
  }

  /** Fully tear down audio: stops ambience and closes the context. */
  dispose() {
    this.ambienceNode?.stop();
    this.ambienceNode = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    try {
      void ctx?.close();
    } catch {
      /* ignore */
    }
  }

  unlock() {
    if (this.unlocked || typeof window === "undefined") return;
    try {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this.startAmbience();
    } catch {
      // ignore
    }
  }

  private envTone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.3, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, gain = 0.25) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(
      1,
      Math.floor(this.ctx.sampleRate * dur),
      this.ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  private startAmbience() {
    if (!this.ctx || !this.master) return;
    // Never stack ambience layers.
    this.ambienceNode?.stop();
    this.ambienceNode = null;
    // Gentle pad: two detuned sine oscillators very low.
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    o1.type = "sine";
    o2.type = "sine";
    o1.frequency.value = 110;
    o2.frequency.value = 138;
    o1.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o1.start();
    o2.start();
    this.ambienceNode = {
      stop: () => {
        try {
          o1.stop();
          o2.stop();
        } catch {
          /* ignore */
        }
      },
    };
  }

  /** `pitch` scales frequencies (1 = default); used to make combo pickups climb. */
  play(name: SfxName, pitch = 1) {
    if (!this.unlocked || this._muted || !this.ctx) return;
    switch (name) {
      case "pickup":
        this.envTone(880 * pitch, 0.08, "triangle", 0.25);
        this.envTone(1320 * pitch, 0.1, "triangle", 0.2, 0.04);
        break;
      case "closeCall":
        this.envTone(420, 0.07, "square", 0.16);
        this.envTone(840, 0.12, "triangle", 0.2, 0.06);
        this.envTone(1260, 0.14, "triangle", 0.16, 0.12);
        break;
      case "dash":
        this.noiseBurst(0.18, 0.12);
        this.envTone(240, 0.16, "sine", 0.12);
        break;
      case "gate":
        // Rising fanfare + a deep splash as the boom sinks.
        [392, 494, 587, 784, 988].forEach((f, i) =>
          this.envTone(f, 0.22, "triangle", 0.22, i * 0.09),
        );
        this.noiseBurst(0.5, 0.2);
        break;
      case "locked":
        this.envTone(220, 0.09, "square", 0.14);
        this.envTone(180, 0.14, "square", 0.14, 0.1);
        break;
      case "warn":
        this.envTone(660, 0.1, "square", 0.18);
        this.envTone(660, 0.1, "square", 0.18, 0.18);
        break;
      case "splash":
        this.noiseBurst(0.35, 0.35);
        this.envTone(180, 0.25, "sine", 0.18);
        break;
      case "complete":
        [523, 659, 784, 1046].forEach((f, i) => this.envTone(f, 0.18, "triangle", 0.25, i * 0.12));
        break;
      case "gameover":
        [440, 330, 220, 165].forEach((f, i) => this.envTone(f, 0.3, "sawtooth", 0.22, i * 0.18));
        break;
      case "click":
        this.envTone(520, 0.05, "square", 0.15);
        break;
      case "ambience":
        break;
    }
  }
}

/** Shared instance — a single AudioContext for the whole app. */
export const audio = new AudioSystem();
