/**
 * Top-level analysis orchestrator. Pure: takes a Dataset plus options and
 * returns a complete AnalysisResult. No React, no I/O.
 */
import type {
  AnalysisResult,
  CfcSelection,
  Dataset,
  NodeMetrics,
  Thresholds,
  VerificationItem,
} from '../domain/types';
import { checkSampleRate } from './filters';
import { detectAirdropEvents, detectExternalLiftEvents } from './events';
import {
  computeDropSummary,
  computeExternalLiftMetrics,
  computeNodeMetrics,
  nodeResultant,
} from './metrics';
import { flag } from './math';

export interface AnalyseOptions {
  cfc: CfcSelection;
  thresholds: Thresholds;
  suspendedMassKg: number;
  pendantLengthM: number;
}

function fmt(value: number, digits = 1, unit = ''): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${unit ? ' ' + unit : ''}`;
}

function band(b: { pass: number; marginal: number }, unit: string): string {
  return `≤ ${b.pass} pass · ≤ ${b.marginal} marginal${unit ? ' ' + unit : ''}`;
}

/** Build the airdrop verification matrix. */
function airdropVerification(
  result: Omit<AnalysisResult, 'verification'>,
  t: Thresholds,
): VerificationItem[] {
  const s = result.summary;
  const items: VerificationItem[] = [
    {
      objective: 'Impact deceleration',
      measurement: 'Peak filtered resultant',
      value: fmt(s.peakImpactAccelG, 1, 'g'),
      threshold: band(t.impactAccelG, 'g'),
      flag: flag(s.peakImpactAccelG, t.impactAccelG),
    },
    {
      objective: 'Rate of descent at impact',
      measurement: 'Mean |vz| pre-impact',
      value: fmt(s.rateOfDescentFtps, 1, 'ft/s'),
      threshold: band(t.rateOfDescentFtps, 'ft/s'),
      flag: flag(s.rateOfDescentFtps, t.rateOfDescentFtps),
    },
    {
      objective: 'Attitude at impact',
      measurement: 'Max off-level √(roll²+pitch²)',
      value: fmt(s.maxOffLevelDeg, 1, '°'),
      threshold: band(t.offLevelDeg, '°'),
      flag: flag(s.maxOffLevelDeg, t.offLevelDeg),
    },
  ];
  if (s.peakExtractionForceKN != null) {
    items.push({
      objective: 'Extraction force',
      measurement: 'Peak EXTRACT tension',
      value: fmt(s.peakExtractionForceKN, 1, 'kN'),
      threshold: band(t.forceKN, 'kN'),
      flag: flag(s.peakExtractionForceKN, t.forceKN),
    });
  }
  if (s.peakOpeningShockKN != null) {
    items.push({
      objective: 'Opening shock',
      measurement: 'Peak CANOPY tension',
      value: fmt(s.peakOpeningShockKN, 1, 'kN'),
      threshold: band(t.forceKN, 'kN'),
      flag: flag(s.peakOpeningShockKN, t.forceKN),
    });
  }
  items.push({
    objective: 'Impact kinetic energy',
    measurement: '½·m·v² (suspended mass)',
    value: fmt(s.impactEnergyKJ, 1, 'kJ'),
    threshold: 'Informational',
    flag: 'green',
  });
  return items;
}

/** Build the external-lift verification matrix. */
function externalVerification(
  result: Omit<AnalysisResult, 'verification'>,
  t: Thresholds,
): VerificationItem[] {
  const e = result.external;
  if (!e) return [];
  return [
    {
      objective: 'Peak sling/hook tension',
      measurement: 'Max load-link tension',
      value: fmt(e.peakTensionKN, 1, 'kN'),
      threshold: band(t.tensionKN, 'kN'),
      flag: flag(e.peakTensionKN, t.tensionKN),
    },
    {
      objective: 'Dynamic amplification (DAF)',
      measurement: 'Peak tension ÷ static weight',
      value: fmt(e.daf, 2),
      threshold: 'Informational',
      flag: 'green',
    },
    {
      objective: 'Peak load swing',
      measurement: 'Max √(roll²+pitch²)',
      value: fmt(e.peakSwingDeg, 1, '°'),
      threshold: band(t.swingDeg, '°'),
      flag: flag(e.peakSwingDeg, t.swingDeg),
    },
    {
      objective: 'Swing stability',
      measurement: 'Late-window vs mid-window amplitude',
      value: e.stability,
      threshold: 'bounded = pass',
      flag: e.stability === 'bounded' ? 'green' : e.stability === 'growing' ? 'red' : 'amber',
    },
  ];
}

/** Run the full analysis. */
export function analyse(data: Dataset, opts: AnalyseOptions): AnalysisResult {
  const fs = data.sampleRate;
  const warnings: string[] = [];
  if (opts.cfc !== 'unfiltered') {
    const w = checkSampleRate(opts.cfc, fs);
    if (w) warnings.push(w);
  }

  // Filtered resultant per node; structural ones drive the global impact.
  const resultants = new Map<string, Float64Array>();
  const structuralResultants = new Map<string, Float64Array>();
  for (const s of data.series) {
    const r = nodeResultant(s, opts.cfc, fs);
    resultants.set(s.nodeId, r);
    if (s.nodeId.startsWith('PLT-') || s.nodeId.startsWith('LOAD-')) {
      structuralResultants.set(s.nodeId, r);
    }
  }

  const isExternal = data.mode === 'ext';
  const { events, impactTimeS, canopyOpenTimeS } = isExternal
    ? { ...detectExternalLiftEvents(data), impactTimeS: 0, canopyOpenTimeS: null }
    : detectAirdropEvents(data, structuralResultants);

  const nodeMetrics: NodeMetrics[] = data.series.map((s) =>
    computeNodeMetrics(
      s,
      resultants.get(s.nodeId)!,
      impactTimeS,
      canopyOpenTimeS,
      opts.suspendedMassKg,
    ),
  );

  const summary = computeDropSummary(data, nodeMetrics, opts.suspendedMassKg);
  const external = isExternal
    ? computeExternalLiftMetrics(data, opts.suspendedMassKg, opts.pendantLengthM)
    : null;

  const partial: Omit<AnalysisResult, 'verification'> = {
    mode: data.mode,
    cfc: opts.cfc,
    sampleRate: fs,
    nodeMetrics,
    summary,
    events,
    external,
    warnings,
    simulated: data.simulated,
  };

  const verification = isExternal
    ? externalVerification(partial, opts.thresholds)
    : airdropVerification(partial, opts.thresholds);

  return { ...partial, verification };
}
