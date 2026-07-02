export class ReplayHash {
  private static HASH_PRECISION = 1000;

  /**
   * Hashes a single coordinates point by converting to fixed-point integers.
   */
  static calculate(pos: { x: number; y: number }): string {
    const ix = Math.round(pos.x * this.HASH_PRECISION);
    const iy = Math.round(pos.y * this.HASH_PRECISION);
    
    let hash = 2166136261;
    hash = Math.imul(hash ^ ix, 16777619);
    hash = Math.imul(hash ^ iy, 16777619);
    
    return (hash >>> 0).toString(16);
  }

  /**
   * Hashes a sequence of points to ensure full path determinism.
   */
  static calculateSequence(points: Array<{ x: number; y: number }>): string {
    let hash = 2166136261;
    
    points.forEach((p) => {
      const ix = Math.round(p.x * this.HASH_PRECISION);
      const iy = Math.round(p.y * this.HASH_PRECISION);
      
      hash = Math.imul(hash ^ ix, 16777619);
      hash = Math.imul(hash ^ iy, 16777619);
    });
    
    return (hash >>> 0).toString(16);
  }
}
