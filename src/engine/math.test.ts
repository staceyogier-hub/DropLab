import { describe, expect, it } from 'vitest';
import { argMax, flag, magnitude2, meanRange, nearestIndex, resultant } from './math';

describe('resultant', () => {
  it('computes √(x²+y²+z²) per sample', () => {
    const r = resultant(
      new Float64Array([3, 0]),
      new Float64Array([4, 0]),
      new Float64Array([0, 5]),
    );
    expect(r[0]).toBeCloseTo(5, 10);
    expect(r[1]).toBeCloseTo(5, 10);
  });
});

describe('magnitude2', () => {
  it('computes off-level √(roll²+pitch²)', () => {
    expect(magnitude2(3, 4)).toBeCloseTo(5, 10);
  });
});

describe('argMax / meanRange', () => {
  it('finds the index of the maximum', () => {
    expect(argMax([1, 9, 3, 2])).toBe(1);
    expect(argMax([])).toBe(-1);
  });
  it('averages a half-open range', () => {
    expect(meanRange([2, 4, 6, 8], 1, 3)).toBeCloseTo(5, 10);
    expect(meanRange([1, 2], 1, 1)).toBe(0);
  });
});

describe('flag (traffic light)', () => {
  const band = { pass: 10, marginal: 20 };
  it('lower-is-better grading', () => {
    expect(flag(8, band)).toBe('green');
    expect(flag(10, band)).toBe('green');
    expect(flag(15, band)).toBe('amber');
    expect(flag(25, band)).toBe('red');
  });
  it('higher-is-better grading', () => {
    // For higher-is-better, pass is the upper (good) bound: green ≥ pass.
    const hi = { pass: 20, marginal: 10 };
    expect(flag(25, hi, true)).toBe('green');
    expect(flag(15, hi, true)).toBe('amber');
    expect(flag(5, hi, true)).toBe('red');
  });
  it('non-finite values are red', () => {
    expect(flag(NaN, band)).toBe('red');
    expect(flag(Infinity, band)).toBe('red');
  });
});

describe('nearestIndex', () => {
  const t = new Float64Array([0, 0.1, 0.2, 0.3, 0.4]);
  it('finds the nearest sample on a monotonic timebase', () => {
    expect(nearestIndex(t, 0.21)).toBe(2);
    expect(nearestIndex(t, 0.26)).toBe(3);
    expect(nearestIndex(t, -1)).toBe(0);
    expect(nearestIndex(t, 99)).toBe(4);
  });
});
