import type { RandomSource } from './types.js';

export class XorShift32 implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return (this.state >>> 0) / 0x1_0000_0000;
  }
}
