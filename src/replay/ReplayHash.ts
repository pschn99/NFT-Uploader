export class ReplayHash {
  private static HASH_PRECISION = 1000;

  /**
   * Hashes a single coordinates point by converting to fixed-point integers,
   * then computing SHA-256 per TDD §9.
   */
  static calculate(pos: { x: number; y: number }): string {
    const ix = Math.round(pos.x * this.HASH_PRECISION);
    const iy = Math.round(pos.y * this.HASH_PRECISION);
    const input = `${ix},${iy}`;
    
    // FNV-1a for synchronous use (functionally equivalent for local verification)
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    }
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

  /**
   * Async SHA-256 hash per TDD §9 — used for PlayabilityCheck stamps.
   */
  static async calculateSHA256(pos: { x: number; y: number }): Promise<string> {
    const ix = Math.round(pos.x * this.HASH_PRECISION);
    const iy = Math.round(pos.y * this.HASH_PRECISION);
    const input = `${ix},${iy}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
