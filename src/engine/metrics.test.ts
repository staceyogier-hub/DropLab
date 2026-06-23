import { describe, expect, it } from 'vitest';
import type { NodeSeries } from '../domain/types';
import { FTPS_TO_MPS } from '../domain/constants';
import { computeNodeMetrics, estimatePeriod, nodeResultant } from './metrics';

/**
 * Hand-built structural node: 1g baseline with a half-sine impact pulse of
 * peak 20 g over 40 ms centred at t = 1.0 s, constant descent of 8.5 m/s.
 */
function buildPulseNode(): { s: NodeSeries; fs: number; impactTimeS: number } {
  const fs = 1000;
  const n = 2000;
  const t = new Float64Array(n);
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const az = new Float64Array(n);
  const roll = new Float64Array(n);
  const pitch = new Float64Array(n);
  const yaw = new Float64Array(n);
  const alt = new Float64Array(n);
  const vz = new Float64Array(n);

  const peakG = 20;
  const td = 0.04; // 40 ms
  const t0 = 1.0 - td / 2; // pulse centred at 1.0 s
  for (let i = 0; i < n; i++) {
    const ti = i / fs;
    t[i] = ti;
    let a = 1; // gravity baseline
    if (ti >= t0 && ti <= t0 + td) {
      a += peakG * Math.sin((Math.PI * (ti - t0)) / td);
    }
    az[i] = a;
    vz[i] = -8.5;
    roll[i] = 2;
    pitch[i] = 1.5;
    void yaw;
    void alt;
  }
  return {
    s: { nodeId: 'LOAD-CT', t, ax, ay, az, roll, pitch, yaw, alt, vz, tension: null },
    fs,
    impactTimeS: 1.0,
  };
}

describe('computeNodeMetrics on a known pulse', () => {
  const { s, fs, impactTimeS } = buildPulseNode();
  const r = nodeResultant(s, 'unfiltered', fs);
  const m = computeNodeMetrics(s, r, impactTimeS, null, 1000);

  it('recovers the peak resultant (~21 g incl. baseline)', () => {
    expect(m.peakResultantG).toBeCloseTo(21, 1);
  });

  it('recovers the pulse width (~34.9 ms above 20%-of-peak)', () => {
    expect(m.pulseWidthMs).toBeGreaterThan(32);
    expect(m.pulseWidthMs).toBeLessThan(38);
  });

  it('computes a plausible onset rate (g/ms)', () => {
    expect(m.onsetRateGPerMs).toBeGreaterThan(0.6);
    expect(m.onsetRateGPerMs).toBeLessThan(1.3);
  });

  it('reports rate of descent ≈ 8.5 m/s in ft/s', () => {
    expect(m.rateOfDescentFtps).toBeCloseTo(8.5 / FTPS_TO_MPS, 1);
  });

  it('computes impact energy ½·m·v² (≈ 36.1 kJ at 1000 kg)', () => {
    expect(m.impactEnergyKJ).toBeCloseTo(36.1, 0);
  });

  it('reports attitude/off-level at impact', () => {
    expect(m.offLevelDeg).toBeCloseTo(Math.hypot(2, 1.5), 5);
  });
});

describe('estimatePeriod', () => {
  it('recovers the period of a clean sine', () => {
    const fs = 50;
    const n = 1500; // 30 s
    const f = 0.2; // → period 5 s
    const t = new Float64Array(n);
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = i / fs;
      x[i] = Math.sin(2 * Math.PI * f * t[i]);
    }
    expect(estimatePeriod(t, x)).toBeCloseTo(5, 1);
  });

  it('returns 0 when too few crossings', () => {
    const t = new Float64Array([0, 1, 2]);
    const x = new Float64Array([1, 1, 1]);
    expect(estimatePeriod(t, x)).toBe(0);
  });
});
