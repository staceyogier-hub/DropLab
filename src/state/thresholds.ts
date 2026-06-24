/**
 * Default operator thresholds and display labels.
 *
 * Impact-acceleration thresholds are INDICATIVE placeholders pending
 * load-specific fragility data — never certification limits.
 */
import type { DomainMode, NodeId, TestConfig, Thresholds } from '../domain/types';
import { NODE_IDS } from '../domain/nodes';

export const DEFAULT_THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

export const DEFAULT_CONFIG: TestConfig = {
  testReference: 'DROP-001',
  mode: 'full',
  aircraft: 'C-130J Hercules',
  dropAltitudeM: 350,
  riggedMassKg: 1100,
  suspendedMassKg: 1000,
  targetRateOfDescentFtps: 28,
  numCanopies: 1,
  waterDrop: false,
  pendantLengthM: 6,
  airspeedKt: 0,
  presetId: null,
  enabledNodes: [...NODE_IDS] as NodeId[],
};

export interface ThresholdLabel {
  key: keyof Thresholds;
  label: string;
  unit: string;
}

/** Threshold rows to show for a given mode (relabelled for external lift). */
export function thresholdLabels(mode: DomainMode): ThresholdLabel[] {
  if (mode === 'ext') {
    return [
      { key: 'tensionKN', label: 'Peak sling/hook tension', unit: 'kN' },
      { key: 'swingDeg', label: 'Peak load swing angle', unit: '°' },
      { key: 'offLevelDeg', label: 'Off-level at placement', unit: '°' },
    ];
  }
  return [
    { key: 'impactAccelG', label: 'Peak impact acceleration', unit: 'g' },
    { key: 'rateOfDescentFtps', label: 'Rate of descent at impact', unit: 'ft/s' },
    { key: 'forceKN', label: 'Peak extraction / opening force', unit: 'kN' },
    { key: 'offLevelDeg', label: 'Attitude off-level at impact', unit: '°' },
  ];
}
