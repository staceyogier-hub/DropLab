import { describe, expect, it } from 'vitest';
import { G } from '../domain/constants';
import { generateAirdrop, generateExternalLift } from './generators';
import { computeExternalLiftMetrics } from './metrics';
import { maxOf } from './math';

describe('generateAirdrop', () => {
  it('is deterministic for a given seed', () => {
    const a = generateAirdrop({ seed: 42 });
    const b = generateAirdrop({ seed: 42 });
    const sa = a.series[0].az;
    const sb = b.series[0].az;
    expect(sa.length).toBe(sb.length);
    for (let i = 0; i < sa.length; i += 250) expect(sa[i]).toBe(sb[i]);
  });

  it('differs for a different seed', () => {
    const a = generateAirdrop({ seed: 1 });
    const b = generateAirdrop({ seed: 2 });
    expect(a.series[0].az[1000]).not.toBe(b.series[0].az[1000]);
  });

  it('produces all 11 nodes, labelled simulated, with an impact peak', () => {
    const d = generateAirdrop({ seed: 3, impactPeakG: 18 });
    expect(d.series.length).toBe(11);
    expect(d.simulated).toBe(true);
    const struct = d.series.find((s) => s.nodeId === 'LOAD-CT')!;
    expect(maxOf(struct.az)).toBeGreaterThan(10);
  });

  it('puts tension only on load-link nodes', () => {
    const d = generateAirdrop({ seed: 3 });
    expect(d.series.find((s) => s.nodeId === 'EXTRACT')!.tension).not.toBeNull();
    expect(d.series.find((s) => s.nodeId === 'CANOPY')!.tension).not.toBeNull();
    expect(d.series.find((s) => s.nodeId === 'PLT-FL')!.tension).toBeNull();
  });
});

describe('generateExternalLift', () => {
  it('peak tension exceeds the static weight (DAF > 1)', () => {
    const mass = 4000;
    const d = generateExternalLift({ seed: 5, suspendedMassKg: mass, pendantLengthM: 6 });
    const m = computeExternalLiftMetrics(d, mass, 6);
    const staticWeightKN = (mass * G) / 1000;
    expect(m.peakTensionKN).toBeGreaterThan(staticWeightKN);
    expect(m.daf).toBeGreaterThan(1);
  });

  it('oscillation period ≈ 2π√(L/g)', () => {
    const L = 6;
    const d = generateExternalLift({ seed: 5, pendantLengthM: L });
    const m = computeExternalLiftMetrics(d, 4000, L);
    const expected = 2 * Math.PI * Math.sqrt(L / G);
    expect(m.pendulumPeriodS).toBeCloseTo(expected, 5);
    // Measured period from the swing data should be near the theoretical one.
    expect(m.oscillationPeriodS).toBeGreaterThan(expected * 0.8);
    expect(m.oscillationPeriodS).toBeLessThan(expected * 1.2);
  });

  it('flags growing swing when requested', () => {
    const bounded = generateExternalLift({ seed: 9, growing: false });
    const growing = generateExternalLift({ seed: 9, growing: true });
    expect(computeExternalLiftMetrics(bounded, 4000, 6).stability).toBe('bounded');
    expect(computeExternalLiftMetrics(growing, 4000, 6).stability).toBe('growing');
  });
});
