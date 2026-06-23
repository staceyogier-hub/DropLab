import { describe, expect, it } from 'vitest';
import type { Thresholds } from '../domain/types';
import { analyse } from './analyse';
import { generateAirdrop, generateExternalLift } from './generators';

const THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

describe('analyse — airdrop', () => {
  // Generator default fs = 2000 Hz, for which CFC 60 and 180 are valid
  // (CFC 600/1000 require far higher rates — see validCfcClasses).
  const data = generateAirdrop({ seed: 11, impactPeakG: 18, rateOfDescentFtps: 28 });
  const result = analyse(data, {
    cfc: 180,
    thresholds: THRESHOLDS,
    suspendedMassKg: 1000,
    pendantLengthM: 0,
  });

  it('detects the core airdrop events', () => {
    const kinds = result.events.map((e) => e.kind);
    expect(kinds).toContain('impact');
    expect(kinds).toContain('extraction');
    expect(kinds).toContain('canopy_opening');
  });

  it('produces a plausible drop summary', () => {
    expect(result.summary.peakImpactAccelG).toBeGreaterThan(10);
    expect(result.summary.rateOfDescentFtps).toBeGreaterThan(20);
    expect(result.summary.rateOfDescentFtps).toBeLessThan(36);
    expect(result.summary.peakExtractionForceKN).toBeGreaterThan(0);
    expect(result.summary.peakOpeningShockKN).toBeGreaterThan(0);
  });

  it('builds an airdrop verification matrix with traffic lights', () => {
    expect(result.external).toBeNull();
    expect(result.verification.length).toBeGreaterThanOrEqual(4);
    for (const v of result.verification) {
      expect(['green', 'amber', 'red']).toContain(v.flag);
    }
  });

  it('reduces the peak when a lower CFC class is selected', () => {
    const cfc60 = analyse(data, {
      cfc: 60,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    const cfc180 = analyse(data, {
      cfc: 180,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    // Heavier low-pass filtering (CFC60) should not exceed the lighter one's peak.
    expect(cfc60.summary.peakImpactAccelG).toBeLessThanOrEqual(
      cfc180.summary.peakImpactAccelG + 1e-9,
    );
  });

  it('warns about an inadequate sample rate', () => {
    // 1000 Hz is below 6× the CFC180 corner (300 Hz → 1800 Hz required).
    const slow = generateAirdrop({ seed: 11, sampleRate: 1000 });
    const r = analyse(slow, {
      cfc: 180,
      thresholds: THRESHOLDS,
      suspendedMassKg: 1000,
      pendantLengthM: 0,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('analyse — external lift', () => {
  const data = generateExternalLift({ seed: 13, suspendedMassKg: 4000, pendantLengthM: 6 });
  const result = analyse(data, {
    cfc: 'unfiltered',
    thresholds: THRESHOLDS,
    suspendedMassKg: 4000,
    pendantLengthM: 6,
  });

  it('computes external-lift metrics', () => {
    expect(result.external).not.toBeNull();
    expect(result.external!.daf).toBeGreaterThan(1);
    expect(result.external!.peakTensionKN).toBeGreaterThan(result.external!.staticWeightKN);
    expect(result.external!.naturalFreqHz).toBeGreaterThan(0);
  });

  it('detects pick-up and peak tension events', () => {
    const kinds = result.events.map((e) => e.kind);
    expect(kinds).toContain('pickup');
    expect(kinds).toContain('peak_tension');
  });

  it('builds an external-lift verification matrix', () => {
    const objectives = result.verification.map((v) => v.objective);
    expect(objectives.join(' ')).toMatch(/tension/i);
    expect(objectives.join(' ')).toMatch(/swing/i);
  });
});
