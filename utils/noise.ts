
/**
 * Simple 1D Pseudo-random noise for smooth transitions.
 * Since we don't want to use external libs, we implement a basic lerp-based noise.
 */
export class SimpleNoise {
  private p: number[] = new Array(512);
  
  constructor() {
    const permutation = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number): number {
    return (hash & 1) === 0 ? x : -x;
  }

  public noise(x: number): number {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const u = this.fade(x);
    return this.lerp(u, this.grad(this.p[X], x), this.grad(this.p[X + 1], x - 1)) * 2;
  }
}
