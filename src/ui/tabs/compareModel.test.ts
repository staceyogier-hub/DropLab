import { describe, expect, it } from 'vitest';
import type { Thresholds } from '../../domain/types';
import { analyse } from '../../engine/analyse';
import { generateAirdrop } from '../../engine/generators';
import { compareRuns, headlineEquivalence, verdict } from './compareModel';

const THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

describe('verdict', () => {
  it('flags within-band changes as equivalent', () => {
    expect(verdict(20, 21, true, 10)).toBe('Equivalent'); // +5%, band 10
  });
  it('flags a reduction as improved when lower is better', () => {
    expect(verdict(20, 14, true, 10)).toBe('Improved');
  });
  it('flags an increase as worse when lower is better', () => {
    expect(verdict(20, 30, true, 10)).toBe('Worse');
  });
  it('respects higher-is-better metrics (e.g. pulse width)', () => {
    expect(verdict(40, 60, false, 10)).toBe('Improved');
    expect(verdict(40, 25, false, 10)).toBe('Worse');
  });
});

describe('compareRuns — honeycomb vs lattice', () => {
  const opts = {
    cfc: 180 as const,
    thresholds: THRESHOLDS,
    suspendedMassKg: 1000,
    pendantLengthM: 0,
  };
  const baseline = analyse(
    generateAirdrop({ seed: 1, impactPeakG: 22, impactDurationMs: 40 }),
    opts,
  );
  const lattice = analyse(
    generateAirdrop({ seed: 1, impactPeakG: 14, impactDurationMs: 65 }),
    opts,
  );

  it('reports lower peak g and longer pulse as improvements', () => {
    const rows = compareRuns(baseline, lattice, 8);
    const peak = rows.find((r) => r.key === 'peakG')!;
    const pulse = rows.find((r) => r.key === 'pulseWidthMs')!;
    expect(peak.verdict).toBe('Improved'); // lower peak
    expect(pulse.verdict).toBe('Improved'); // longer pulse
    expect(peak.b).toBeLessThan(peak.a);
  });

  it('gives a headline equivalence call on peak deceleration', () => {
    const head = headlineEquivalence(baseline, lattice, 8);
    expect(head.verdict).toBe('Improved');
    expect(head.text).toMatch(/lower/);
  });

  it('calls near-identical runs equivalent', () => {
    const head = headlineEquivalence(baseline, baseline, 8);
    expect(head.verdict).toBe('Equivalent');
  });
});
