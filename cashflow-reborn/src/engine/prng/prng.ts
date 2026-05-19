/**
 * Mulberry32 — fast, simple, good distribution.
 * Determinism is critical: every random call routes through this.
 */

export class PRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure 32-bit unsigned
    this.state = seed >>> 0;
  }

  /** Uniform [0, 1) */
  next(): number {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Approximate Gaussian via Box–Muller.
   * Use for asset returns and event severity.
   */
  gaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /** Snapshot state — for save/replay. */
  serialize(): number {
    return this.state;
  }

  static deserialize(state: number): PRNG {
    const p = new PRNG(0);
    p.state = state >>> 0;
    return p;
  }
}
