/**
 * Airdrop and external-lift metric computation.
 *
 * All inputs are CFC-filtered (or unfiltered) channels; this module turns a
 * node's series into the per-node and drop-level measurement objectives.
 */
import type {
  CfcSelection,
  Dataset,
  DropSummary,
  ExternalLiftMetrics,
  NodeMetrics,
  NodeSeries,
} from '../domain/types';
import { G, MPS_TO_FTPS } from '../domain/constants';
import { getNode, loadBodyNodes } from '../domain/nodes';
import { cfcCoefficients, filtfilt } from './filters';
import { argMax, magnitude2, maxOf, nearestIndex, resultant } from './math';

/** Filter the three acceleration channels of a node (or pass through). */
export function filteredAccel(
  s: NodeSeries,
  cfc: CfcSelection,
  fs: number,
): { ax: Float64Array; ay: Float64Array; az: Float64Array } {
  if (cfc === 'unfiltered') {
    return { ax: s.ax, ay: s.ay, az: s.az };
  }
  const c = cfcCoefficients(cfc, fs);
  return {
    ax: filtfilt(s.ax, c),
    ay: filtfilt(s.ay, c),
    az: filtfilt(s.az, c),
  };
}

/** Filtered resultant acceleration (g) for a node. */
export function nodeResultant(s: NodeSeries, cfc: CfcSelection, fs: number): Float64Array {
  const f = filteredAccel(s, cfc, fs);
  return resultant(f.ax, f.ay, f.az);
}

/**
 * Pulse window indices: the contiguous run containing the peak where the
 * resultant exceeds 1g + 20%·(peak − 1g). Baseline is 1g (gravity at rest).
 */
function pulseWindow(r: Float64Array, peakIdx: number): { left: number; right: number; threshold: number } {
  const peak = r[peakIdx];
  const threshold = 1 + 0.2 * (peak - 1);
  let left = peakIdx;
  while (left > 0 && r[left - 1] > threshold) left--;
  let right = peakIdx;
  while (right < r.length - 1 && r[right + 1] > threshold) right++;
  return { left, right, threshold };
}

/**
 * Compute one node's metrics. `impactTimeS` and `canopyOpenTimeS` come from
 * event detection so per-node windows align with the drop-level timeline.
 */
export function computeNodeMetrics(
  s: NodeSeries,
  r: Float64Array,
  impactTimeS: number,
  canopyOpenTimeS: number | null,
  suspendedMassKg: number,
  isExternal = false,
): NodeMetrics {
  const def = getNode(s.nodeId);
  const peakIdx = Math.max(0, argMax(r));
  const peakResultantG = r.length ? r[peakIdx] : 0;
  const peakTimeS = s.t.length ? s.t[peakIdx] : 0;

  // Pulse width (ms).
  const { left, right } = pulseWindow(r, peakIdx);
  const pulseWidthMs = (s.t[right] - s.t[left]) * 1000;

  // Onset rate to peak (g/ms): rise from pulse left edge to the peak.
  const riseMs = (s.t[peakIdx] - s.t[left]) * 1000;
  const onsetRateGPerMs = riseMs > 0 ? (peakResultantG - r[left]) / riseMs : 0;

  // Rate of descent at impact: mean |vz| in 0.05–0.6 s before impact.
  const i0 = nearestIndex(s.t, impactTimeS - 0.6);
  const i1 = nearestIndex(s.t, impactTimeS - 0.05);
  let sumAbs = 0;
  let count = 0;
  for (let i = Math.max(0, i0); i <= Math.min(s.t.length - 1, i1); i++) {
    sumAbs += Math.abs(s.vz[i]);
    count++;
  }
  const rodMps = count > 0 ? sumAbs / count : 0;
  const rateOfDescentFtps = rodMps * MPS_TO_FTPS;

  // Impact kinetic energy ½·m·v² (kJ).
  const impactEnergyKJ = (0.5 * suspendedMassKg * rodMps * rodMps) / 1000;

  // In-flight max g between canopy opening and impact.
  let inFlightMaxG = 0;
  if (canopyOpenTimeS != null) {
    const a = nearestIndex(s.t, canopyOpenTimeS);
    const b = nearestIndex(s.t, impactTimeS);
    inFlightMaxG = maxOf(r, Math.max(0, a), Math.min(r.length, b));
    if (!Number.isFinite(inFlightMaxG)) inFlightMaxG = 0;
  }

  // Attitude / off-level. Airdrop: at impact. External lift: there is no
  // impact, so report the peak swing over the whole lift window and the
  // attitude at that instant.
  let attitudeRollDeg: number;
  let attitudePitchDeg: number;
  let offLevelDeg: number;
  if (isExternal) {
    let bestIdx = 0;
    let best = -1;
    for (let i = 0; i < s.roll.length; i++) {
      const o = magnitude2(s.roll[i], s.pitch[i]);
      if (o > best) {
        best = o;
        bestIdx = i;
      }
    }
    attitudeRollDeg = s.roll.length ? s.roll[bestIdx] : 0;
    attitudePitchDeg = s.pitch.length ? s.pitch[bestIdx] : 0;
    offLevelDeg = best < 0 ? 0 : best;
  } else {
    const impactIdx = nearestIndex(s.t, impactTimeS);
    attitudeRollDeg = impactIdx >= 0 ? s.roll[impactIdx] : 0;
    attitudePitchDeg = impactIdx >= 0 ? s.pitch[impactIdx] : 0;
    offLevelDeg = magnitude2(attitudeRollDeg, attitudePitchDeg);
  }

  const peakTensionKN = s.tension ? maxOf(s.tension) : null;

  return {
    nodeId: s.nodeId,
    role: def.role,
    peakResultantG,
    pulseWidthMs,
    onsetRateGPerMs,
    rateOfDescentFtps,
    impactEnergyKJ,
    inFlightMaxG,
    attitudeRollDeg,
    attitudePitchDeg,
    offLevelDeg,
    peakTensionKN: peakTensionKN != null && Number.isFinite(peakTensionKN) ? peakTensionKN : null,
    peakTimeS,
  };
}

/** Build the drop-level summary from per-node metrics. */
export function computeDropSummary(
  data: Dataset,
  nodeMetrics: NodeMetrics[],
  suspendedMassKg: number,
): DropSummary {
  const structural = nodeMetrics.filter((m) => m.role === 'struct');

  let peakImpactAccelG = 0;
  let peakImpactNodeId: DropSummary['peakImpactNodeId'] = null;
  let maxOffLevelDeg = 0;
  let rodSum = 0;
  let rodCount = 0;
  for (const m of structural) {
    if (m.peakResultantG > peakImpactAccelG) {
      peakImpactAccelG = m.peakResultantG;
      peakImpactNodeId = m.nodeId;
    }
    if (m.offLevelDeg > maxOffLevelDeg) maxOffLevelDeg = m.offLevelDeg;
    rodSum += m.rateOfDescentFtps;
    rodCount++;
  }
  const rateOfDescentFtps = rodCount > 0 ? rodSum / rodCount : 0;
  const rodMps = rateOfDescentFtps / MPS_TO_FTPS;
  const impactEnergyKJ = (0.5 * suspendedMassKg * rodMps * rodMps) / 1000;

  const extract = data.series.find((s) => s.nodeId === 'EXTRACT');
  const canopy = data.series.find((s) => s.nodeId === 'CANOPY');
  const peakExtractionForceKN = extract?.tension ? maxOf(extract.tension) : null;
  const peakOpeningShockKN = canopy?.tension ? maxOf(canopy.tension) : null;

  return {
    peakImpactAccelG,
    peakImpactNodeId,
    rateOfDescentFtps,
    peakExtractionForceKN:
      peakExtractionForceKN != null && Number.isFinite(peakExtractionForceKN)
        ? peakExtractionForceKN
        : null,
    peakOpeningShockKN:
      peakOpeningShockKN != null && Number.isFinite(peakOpeningShockKN)
        ? peakOpeningShockKN
        : null,
    impactEnergyKJ,
    maxOffLevelDeg,
  };
}

/**
 * Estimate the dominant oscillation period (s) of a signal via mean spacing of
 * mean-crossings over a window. Returns 0 when fewer than three crossings.
 */
export function estimatePeriod(t: Float64Array, x: Float64Array, from = 0, to = x.length): number {
  const lo = Math.max(0, from);
  const hi = Math.min(x.length, to);
  if (hi - lo < 4) return 0;
  let mean = 0;
  for (let i = lo; i < hi; i++) mean += x[i];
  mean /= hi - lo;

  const crossings: number[] = [];
  for (let i = lo + 1; i < hi; i++) {
    const a = x[i - 1] - mean;
    const b = x[i] - mean;
    if (a === 0) continue;
    if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
      // Linear interpolation for sub-sample crossing time.
      const frac = a / (a - b);
      crossings.push(t[i - 1] + frac * (t[i] - t[i - 1]));
    }
  }
  if (crossings.length < 3) return 0;
  const span = crossings[crossings.length - 1] - crossings[0];
  const halfPeriods = crossings.length - 1;
  return (2 * span) / halfPeriods;
}

/** Off-level (swing) angle series for a node, √(roll²+pitch²). */
function swingSeries(s: NodeSeries): Float64Array {
  const n = s.roll.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = magnitude2(s.roll[i], s.pitch[i]);
  return out;
}

/** Root-mean-square over a half-open index range. */
function rmsRange(x: Float64Array, from: number, to: number): number {
  const lo = Math.max(0, from);
  const hi = Math.min(x.length, to);
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / (hi - lo));
}

/** Compute external-lift metrics. */
export function computeExternalLiftMetrics(
  data: Dataset,
  suspendedMassKg: number,
  pendantLengthM: number,
): ExternalLiftMetrics {
  const staticWeightKN = (suspendedMassKg * G) / 1000;

  // Peak tension across any hook/apex line.
  let peakTensionKN = 0;
  for (const s of data.series) {
    if (s.tension) peakTensionKN = Math.max(peakTensionKN, maxOf(s.tension));
  }
  const daf = staticWeightKN > 0 ? peakTensionKN / staticWeightKN : 0;

  // Peak swing over load-body nodes and a representative swing signal.
  const bodyIds = new Set(loadBodyNodes().map((n) => n.id));
  let peakSwingDeg = 0;
  let representative: NodeSeries | undefined;
  let representativeAmp = -Infinity;
  for (const s of data.series) {
    if (!bodyIds.has(s.nodeId)) continue;
    const sw = swingSeries(s);
    const amp = maxOf(sw);
    if (amp > peakSwingDeg) peakSwingDeg = amp;
    if (amp > representativeAmp) {
      representativeAmp = amp;
      representative = s;
    }
  }

  // Measured oscillation period from the representative node's roll channel.
  let oscillationPeriodS = 0;
  let stability: ExternalLiftMetrics['stability'] = 'unknown';
  if (representative) {
    oscillationPeriodS = estimatePeriod(representative.t, representative.roll);
    const sw = swingSeries(representative);
    const n = sw.length;
    if (n >= 10) {
      // Compare RMS swing in a mid-flight window against a later one; a clear
      // late-window increase indicates a growing (unstable) oscillation.
      const midRms = rmsRange(sw, Math.floor(n * 0.35), Math.floor(n * 0.55));
      const lateRms = rmsRange(sw, Math.floor(n * 0.7), Math.floor(n * 0.9));
      stability = lateRms > midRms * 1.15 ? 'growing' : 'bounded';
    }
  }

  const pendulumPeriodS = pendantLengthM > 0 ? 2 * Math.PI * Math.sqrt(pendantLengthM / G) : 0;
  const naturalFreqHz = pendulumPeriodS > 0 ? 1 / pendulumPeriodS : 0;
  if (oscillationPeriodS === 0) oscillationPeriodS = pendulumPeriodS;

  return {
    staticWeightKN,
    peakTensionKN,
    daf,
    peakSwingDeg,
    oscillationPeriodS,
    pendulumPeriodS,
    naturalFreqHz,
    stability,
    pendantLengthM,
  };
}
