import { describe, expect, it } from 'vitest';
import type { Thresholds } from '../../domain/types';
import { analyse } from '../../engine/analyse';
import { generateAirdrop, generateExternalLift } from '../../engine/generators';
import { summaryCards } from './resultsModel';

const THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

describe('summaryCards', () => {
  it('produces airdrop cards with traffic lights', () => {
    const data = generateAirdrop({ seed: 31, impactPeakG: 18 });
    const result = analyse(data, {
      cfc: 180,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    const cards = summaryCards(result, THRESHOLDS);
    const labels = cards.map((c) => c.label);
    expect(labels).toContain('Peak impact acceleration');
    expect(labels).not.toContain('Peak sling/hook tension');
    const impact = cards.find((c) => c.label === 'Peak impact acceleration')!;
    expect(['green', 'amber', 'red']).toContain(impact.flag);
  });

  it('switches to external-lift cards in ext mode', () => {
    const data = generateExternalLift({ seed: 31, suspendedMassKg: 4000, pendantLengthM: 6 });
    const result = analyse(data, {
      cfc: 'unfiltered',
      thresholds: THRESHOLDS,
      suspendedMassKg: 4000,
      pendantLengthM: 6,
    });
    const cards = summaryCards(result, THRESHOLDS);
    const labels = cards.map((c) => c.label);
    expect(labels).toContain('Peak sling/hook tension');
    expect(labels).toContain('Dynamic amplification (DAF)');
    expect(labels).not.toContain('Peak impact acceleration');
  });

  it('grades a low impact green and a high impact red', () => {
    const low = analyse(generateAirdrop({ seed: 5, impactPeakG: 10 }), {
      cfc: 180,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    const high = analyse(generateAirdrop({ seed: 5, impactPeakG: 60 }), {
      cfc: 180,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    const lowFlag = summaryCards(low, THRESHOLDS).find(
      (c) => c.label === 'Peak impact acceleration',
    )!.flag;
    const highFlag = summaryCards(high, THRESHOLDS).find(
      (c) => c.label === 'Peak impact acceleration',
    )!.flag;
    expect(lowFlag).toBe('green');
    expect(highFlag).toBe('red');
  });
});
