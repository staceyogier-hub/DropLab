/**
 * Pure view-model for the Results tab summary cards. Kept separate from the
 * React component so the traffic-light logic and the airdrop/EL switch can be
 * unit-tested without rendering.
 */
import type { AnalysisResult, Thresholds, TrafficLight } from '../../domain/types';
import { flag } from '../../engine/math';
import { fmtNum } from '../format';

export interface SummaryCard {
  label: string;
  value: string;
  unit?: string;
  flag?: TrafficLight;
  sub?: string;
}

function airdropSummaryCards(result: AnalysisResult, t: Thresholds): SummaryCard[] {
  const s = result.summary;
  const cards: SummaryCard[] = [
    {
      label: 'Peak impact acceleration',
      value: fmtNum(s.peakImpactAccelG, 1),
      unit: 'g',
      flag: flag(s.peakImpactAccelG, t.impactAccelG),
      sub: s.peakImpactNodeId ? `at ${s.peakImpactNodeId}` : undefined,
    },
    {
      label: 'Rate of descent at impact',
      value: fmtNum(s.rateOfDescentFtps, 1),
      unit: 'ft/s',
      flag: flag(s.rateOfDescentFtps, t.rateOfDescentFtps),
    },
    {
      label: 'Peak extraction force',
      value: fmtNum(s.peakExtractionForceKN, 1),
      unit: 'kN',
      flag: s.peakExtractionForceKN == null ? undefined : flag(s.peakExtractionForceKN, t.forceKN),
    },
    {
      label: 'Peak opening shock',
      value: fmtNum(s.peakOpeningShockKN, 1),
      unit: 'kN',
      flag: s.peakOpeningShockKN == null ? undefined : flag(s.peakOpeningShockKN, t.forceKN),
    },
    {
      label: 'Impact kinetic energy',
      value: fmtNum(s.impactEnergyKJ, 1),
      unit: 'kJ',
    },
    {
      label: 'Max impact off-level',
      value: fmtNum(s.maxOffLevelDeg, 1),
      unit: '°',
      flag: flag(s.maxOffLevelDeg, t.offLevelDeg),
    },
  ];
  return cards;
}

function externalSummaryCards(result: AnalysisResult, t: Thresholds): SummaryCard[] {
  const e = result.external;
  if (!e) return [];
  return [
    {
      label: 'Peak sling/hook tension',
      value: fmtNum(e.peakTensionKN, 1),
      unit: 'kN',
      flag: flag(e.peakTensionKN, t.tensionKN),
    },
    {
      label: 'Dynamic amplification (DAF)',
      value: fmtNum(e.daf, 2),
      sub: 'peak ÷ static',
    },
    {
      label: 'Static weight',
      value: fmtNum(e.staticWeightKN, 1),
      unit: 'kN',
    },
    {
      label: 'Peak load swing',
      value: fmtNum(e.peakSwingDeg, 1),
      unit: '°',
      flag: flag(e.peakSwingDeg, t.swingDeg),
    },
    {
      label: 'Oscillation period',
      value: fmtNum(e.oscillationPeriodS, 2),
      unit: 's',
      sub: `theory 2π√(L/g) = ${fmtNum(e.pendulumPeriodS, 2)} s`,
    },
    {
      label: 'Swing stability',
      value: e.stability,
      flag: e.stability === 'bounded' ? 'green' : e.stability === 'growing' ? 'red' : 'amber',
    },
  ];
}

/** Summary cards appropriate to the result's mode. */
export function summaryCards(result: AnalysisResult, thresholds: Thresholds): SummaryCard[] {
  return result.external
    ? externalSummaryCards(result, thresholds)
    : airdropSummaryCards(result, thresholds);
}
