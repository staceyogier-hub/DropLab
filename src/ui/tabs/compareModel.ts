/**
 * Pure A/B comparison model (the LFAM use case: baseline honeycomb vs candidate
 * lattice). Computes per-metric % delta and an Improved/Equivalent/Worse verdict
 * against an editable equivalence band, plus a headline equivalence call.
 */
import type { AnalysisResult } from '../../domain/types';

export type Verdict = 'Improved' | 'Equivalent' | 'Worse';

export interface CompMetrics {
  peakG: number;
  pulseWidthMs: number;
  onsetRateGPerMs: number;
  rateOfDescentFtps: number;
  forceKN: number;
  offLevelDeg: number;
}

export interface MetricRow {
  key: keyof CompMetrics;
  label: string;
  unit: string;
  /** True when a lower value is better. */
  betterIsLower: boolean;
  a: number;
  b: number;
  deltaPct: number;
  verdict: Verdict;
}

/** Pull the comparable scalar metrics from a result (peak-impact node). */
export function extractMetrics(result: AnalysisResult): CompMetrics {
  const s = result.summary;
  const node = result.nodeMetrics.find((m) => m.nodeId === s.peakImpactNodeId);
  const force = s.peakExtractionForceKN ?? s.peakOpeningShockKN ?? 0;
  return {
    peakG: s.peakImpactAccelG,
    pulseWidthMs: node?.pulseWidthMs ?? 0,
    onsetRateGPerMs: node?.onsetRateGPerMs ?? 0,
    rateOfDescentFtps: s.rateOfDescentFtps,
    forceKN: force,
    offLevelDeg: s.maxOffLevelDeg,
  };
}

/** Verdict for B relative to A given an equivalence band (percent). */
export function verdict(a: number, b: number, betterIsLower: boolean, bandPct: number): Verdict {
  if (a === 0 && b === 0) return 'Equivalent';
  const base = a === 0 ? Math.abs(b) : Math.abs(a);
  const changePct = ((b - a) / base) * 100;
  if (Math.abs(changePct) <= bandPct) return 'Equivalent';
  const improved = betterIsLower ? b < a : b > a;
  return improved ? 'Improved' : 'Worse';
}

interface MetricSpec {
  key: keyof CompMetrics;
  label: string;
  unit: string;
  betterIsLower: boolean;
}

const SPECS: MetricSpec[] = [
  { key: 'peakG', label: 'Peak deceleration', unit: 'g', betterIsLower: true },
  { key: 'pulseWidthMs', label: 'Pulse width', unit: 'ms', betterIsLower: false },
  { key: 'onsetRateGPerMs', label: 'Onset rate', unit: 'g/ms', betterIsLower: true },
  { key: 'rateOfDescentFtps', label: 'Rate of descent', unit: 'ft/s', betterIsLower: true },
  { key: 'forceKN', label: 'Impact / extraction force', unit: 'kN', betterIsLower: true },
  { key: 'offLevelDeg', label: 'Off-level', unit: '°', betterIsLower: true },
];

export function compareRuns(a: AnalysisResult, b: AnalysisResult, bandPct: number): MetricRow[] {
  const ma = extractMetrics(a);
  const mb = extractMetrics(b);
  return SPECS.map((spec) => {
    const av = ma[spec.key];
    const bv = mb[spec.key];
    const base = av === 0 ? (bv === 0 ? 1 : Math.abs(bv)) : Math.abs(av);
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      betterIsLower: spec.betterIsLower,
      a: av,
      b: bv,
      deltaPct: ((bv - av) / base) * 100,
      verdict: verdict(av, bv, spec.betterIsLower, bandPct),
    };
  });
}

/** Headline equivalence call on peak deceleration. */
export function headlineEquivalence(
  a: AnalysisResult,
  b: AnalysisResult,
  bandPct: number,
): { verdict: Verdict; text: string } {
  const av = a.summary.peakImpactAccelG;
  const bv = b.summary.peakImpactAccelG;
  const v = verdict(av, bv, true, bandPct);
  const changePct = av === 0 ? 0 : ((bv - av) / Math.abs(av)) * 100;
  const dir = changePct < 0 ? 'lower' : 'higher';
  const text =
    v === 'Equivalent'
      ? `Run B peak deceleration is within ±${bandPct}% of Run A — equivalent on peak g.`
      : `Run B peak deceleration is ${Math.abs(changePct).toFixed(1)}% ${dir} than Run A — ${v.toLowerCase()}.`;
  return { verdict: v, text };
}
