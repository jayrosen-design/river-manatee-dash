import { STORAGE_KEYS } from "../constants";

export class ScoreSystem {
  score = 0;
  high = 0;
  constructor() {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEYS.HIGH);
      this.high = raw ? Number(raw) || 0 : 0;
    }
  }
  reset() {
    this.score = 0;
  }
  add(n: number) {
    this.score += n;
  }
  commitHigh() {
    if (this.score > this.high) {
      this.high = this.score;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.HIGH, String(this.high));
      }
    }
  }
}
