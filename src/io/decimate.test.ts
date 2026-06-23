import { describe, expect, it } from 'vitest';
import { decimateExtrema, decimateIndices } from './decimate';

describe('decimateIndices', () => {
  it('returns all indices when below the cap', () => {
    expect(decimateIndices(5, 100)).toEqual([0, 1, 2, 3, 4]);
  });
  it('reduces to roughly the requested count and keeps the endpoints', () => {
    const idx = decimateIndices(1000, 100);
    expect(idx.length).toBeLessThanOrEqual(100);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(999);
  });
});

describe('decimateExtrema', () => {
  it('preserves a sharp peak that simple striding could miss', () => {
    const n = 1000;
    const values = new Float64Array(n);
    const peakIdx = 503; // off a round stride boundary
    values[peakIdx] = 100;
    const idx = decimateExtrema(values, 50);
    expect(idx).toContain(peakIdx);
    expect(idx.length).toBeLessThanOrEqual(50);
    // Endpoints retained and indices strictly increasing.
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(n - 1);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  });
  it('returns all indices when below the cap', () => {
    expect(decimateExtrema(new Float64Array([1, 2, 3]), 100)).toEqual([0, 1, 2]);
  });
});
