import { describe, expect, it } from 'vitest';
import {
  cfcCoefficients,
  cfcFilter,
  checkSampleRate,
  filterForward,
  filtfilt,
} from './filters';
import { argMax, maxOf } from './math';

/** Max |x| over a central window, avoiding edge transients. */
function centralAmplitude(x: Float64Array): number {
  const a = Math.floor(x.length / 4);
  const b = Math.floor((3 * x.length) / 4);
  let m = 0;
  for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i]));
  return m;
}

describe('cfcCoefficients', () => {
  // Golden values computed independently (see commit notes). These lock the
  // SAE J211 coefficient formula against regressions.
  it('matches hand-computed values for CFC180 @ 2000 Hz', () => {
    const c = cfcCoefficients(180, 2000);
    expect(c.a0).toBeCloseTo(0.1858740433048897, 12);
    expect(c.a1).toBeCloseTo(0.3717480866097794, 12);
    expect(c.a2).toBeCloseTo(0.1858740433048897, 12);
    expect(c.b1).toBeCloseTo(0.4668752705473031, 12);
    expect(c.b2).toBeCloseTo(-0.21037144376686184, 12);
  });

  it('matches hand-computed values for CFC1000 @ 10000 Hz', () => {
    const c = cfcCoefficients(1000, 10000);
    expect(c.a0).toBeCloseTo(0.2192314172190018, 12);
    expect(c.b1).toBeCloseTo(0.31189654499598485, 12);
    expect(c.b2).toBeCloseTo(-0.18882221387199205, 12);
  });

  it('matches hand-computed values for CFC60 @ 1000 Hz', () => {
    const c = cfcCoefficients(60, 1000);
    expect(c.a0).toBeCloseTo(0.09718462527936682, 12);
    expect(c.b1).toBeCloseTo(0.9455740090617893, 12);
    expect(c.b2).toBeCloseTo(-0.3343125101792567, 12);
  });

  it('satisfies the SAE J211 structural invariants', () => {
    for (const [cfc, fs] of [
      [60, 1000],
      [180, 2000],
      [600, 10000],
      [1000, 20000],
    ] as const) {
      const c = cfcCoefficients(cfc, fs);
      // a1 = 2·a0, a2 = a0.
      expect(c.a1).toBeCloseTo(2 * c.a0, 12);
      expect(c.a2).toBeCloseTo(c.a0, 12);
      // Unity DC gain: (a0+a1+a2)/(1−b1−b2) = 1.
      const dc = (c.a0 + c.a1 + c.a2) / (1 - c.b1 - c.b2);
      expect(dc).toBeCloseTo(1, 10);
    }
  });

  it('throws on a non-positive sample rate', () => {
    expect(() => cfcCoefficients(180, 0)).toThrow();
  });
});

describe('filtfilt zero-phase behaviour', () => {
  it('keeps a symmetric pulse symmetric (no phase shift)', () => {
    const n = 401;
    const centre = 200;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const d = i - centre;
      x[i] = Math.exp(-(d * d) / (2 * 18 * 18));
    }
    const c = cfcCoefficients(180, 2000);
    const y = filtfilt(x, c);

    // Output symmetric about the centre within tight tolerance.
    const peak = maxOf(y);
    for (let i = 0; i < n; i++) {
      expect(Math.abs(y[i] - y[n - 1 - i])).toBeLessThan(1e-6 * peak);
    }
    // Peak stays at the centre (zero group delay).
    expect(argMax(y)).toBe(centre);
  });

  it('a single forward pass DOES shift the peak (contrast)', () => {
    const n = 401;
    const centre = 200;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const d = i - centre;
      x[i] = Math.exp(-(d * d) / (2 * 18 * 18));
    }
    const c = cfcCoefficients(180, 2000);
    const y = filterForward(x, c);
    expect(argMax(y)).toBeGreaterThan(centre); // causal delay
  });

  it('attenuates a sine above the corner and passes one below', () => {
    const fs = 2000; // CFC180 corner = 300 Hz
    const n = 4000;
    const high = new Float64Array(n);
    const low = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / fs;
      high[i] = Math.sin(2 * Math.PI * 600 * t); // 2× corner
      low[i] = Math.sin(2 * Math.PI * 30 * t); // 0.1× corner
    }
    const hf = cfcFilter(high, 180, fs);
    const lf = cfcFilter(low, 180, fs);
    expect(centralAmplitude(hf)).toBeLessThan(0.15); // strongly attenuated
    expect(centralAmplitude(lf)).toBeGreaterThan(0.95); // passes through
  });

  it('returns empty for empty input', () => {
    expect(filtfilt(new Float64Array(0), cfcCoefficients(180, 2000)).length).toBe(0);
  });
});

describe('checkSampleRate', () => {
  it('warns when fs ≤ 6× corner', () => {
    // CFC180 corner = 300 Hz → needs > 1800 Hz.
    expect(checkSampleRate(180, 1500)).toMatch(/below 6/);
    expect(checkSampleRate(180, 1800)).toMatch(/below 6/);
  });
  it('passes when fs > 6× corner', () => {
    expect(checkSampleRate(180, 2000)).toBeNull();
  });
});
