import { describe, expect, it } from 'vitest';
import type { Thresholds } from '../domain/types';
import { analyse } from '../engine/analyse';
import { generateAirdrop } from '../engine/generators';
import { isOffThread, runAnalysis } from './analysisClient';

const THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

describe('analysisClient', () => {
  it('falls back to in-thread analysis under jsdom and matches the engine', async () => {
    // Workers are intentionally disabled in the test (jsdom) environment.
    expect(isOffThread()).toBe(false);

    const data = generateAirdrop({ seed: 77, impactPeakG: 18 });
    const opts = { cfc: 180 as const, thresholds: THRESHOLDS, suspendedMassKg: 1000, pendantLengthM: 0 };
    const viaClient = await runAnalysis(data, opts);
    const direct = analyse(data, opts);

    expect(viaClient.summary.peakImpactAccelG).toBeCloseTo(direct.summary.peakImpactAccelG, 10);
    expect(viaClient.events.length).toBe(direct.events.length);
  });
});
