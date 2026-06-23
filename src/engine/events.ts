/**
 * Event detection for airdrop and external-lift records.
 *
 * Airdrop: exit (extraction onset), extraction (peak extraction force),
 * canopy opening (peak canopy tension before impact), and ground/water impact
 * (global peak structural resultant).
 *
 * External lift: pick-up (hook tension onset) and peak sling tension.
 */
import type { AnalysisEvent, Dataset, NodeSeries } from '../domain/types';
import { argMax, maxOf } from './math';

function findSeries(data: Dataset, id: NodeSeries['nodeId']): NodeSeries | undefined {
  return data.series.find((s) => s.nodeId === id);
}

/** First index where a (mostly non-negative) channel rises above `frac`·peak. */
function onsetIndex(x: Float64Array, frac: number): number {
  const peak = maxOf(x);
  if (!(peak > 0)) return -1;
  const threshold = frac * peak;
  for (let i = 0; i < x.length; i++) {
    if (x[i] >= threshold) return i;
  }
  return -1;
}

/**
 * Detect airdrop events. `structuralResultants` maps node id → filtered
 * resultant series; the global impact is the largest of those peaks.
 */
export function detectAirdropEvents(
  data: Dataset,
  structuralResultants: Map<string, Float64Array>,
): { events: AnalysisEvent[]; impactTimeS: number; canopyOpenTimeS: number | null } {
  const events: AnalysisEvent[] = [];

  // Impact: global peak structural resultant.
  let impactNode: NodeSeries | undefined;
  let impactIdx = -1;
  let impactPeak = -Infinity;
  for (const s of data.series) {
    const r = structuralResultants.get(s.nodeId);
    if (!r) continue;
    const idx = argMax(r);
    if (idx >= 0 && r[idx] > impactPeak) {
      impactPeak = r[idx];
      impactIdx = idx;
      impactNode = s;
    }
  }
  const impactTimeS = impactNode && impactIdx >= 0 ? impactNode.t[impactIdx] : 0;
  if (impactNode) {
    events.push({
      kind: 'impact',
      label: data.mode === 'static' ? 'Ground impact (static)' : 'Ground/water impact',
      time_s: impactTimeS,
      nodeId: impactNode.nodeId,
      value: impactPeak,
      unit: 'g',
    });
  }

  // Extraction onset (exit) and peak extraction force.
  const extract = findSeries(data, 'EXTRACT');
  if (extract?.tension) {
    const onset = onsetIndex(extract.tension, 0.05);
    if (onset >= 0) {
      events.push({
        kind: 'exit',
        label: 'Exit / extraction onset',
        time_s: extract.t[onset],
        nodeId: 'EXTRACT',
      });
    }
    const peakIdx = argMax(extract.tension);
    if (peakIdx >= 0) {
      events.push({
        kind: 'extraction',
        label: 'Peak extraction force',
        time_s: extract.t[peakIdx],
        nodeId: 'EXTRACT',
        value: extract.tension[peakIdx],
        unit: 'kN',
      });
    }
  }

  // Canopy opening: peak canopy tension before impact.
  let canopyOpenTimeS: number | null = null;
  const canopy = findSeries(data, 'CANOPY');
  if (canopy?.tension) {
    let bestIdx = -1;
    let best = -Infinity;
    for (let i = 0; i < canopy.tension.length; i++) {
      if (canopy.t[i] >= impactTimeS) break;
      if (canopy.tension[i] > best) {
        best = canopy.tension[i];
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      canopyOpenTimeS = canopy.t[bestIdx];
      events.push({
        kind: 'canopy_opening',
        label: 'Canopy opening (peak opening shock)',
        time_s: canopyOpenTimeS,
        nodeId: 'CANOPY',
        value: best,
        unit: 'kN',
      });
    }
  }

  events.sort((a, b) => a.time_s - b.time_s);
  return { events, impactTimeS, canopyOpenTimeS };
}

/** Detect external-lift events: pick-up onset and peak sling/hook tension. */
export function detectExternalLiftEvents(data: Dataset): {
  events: AnalysisEvent[];
  peakTensionTimeS: number;
} {
  const events: AnalysisEvent[] = [];

  // Use the largest tension channel as the hook/apex line.
  let apex: NodeSeries | undefined;
  let apexPeak = -Infinity;
  for (const s of data.series) {
    if (!s.tension) continue;
    const p = maxOf(s.tension);
    if (p > apexPeak) {
      apexPeak = p;
      apex = s;
    }
  }

  let peakTensionTimeS = 0;
  if (apex?.tension) {
    const onset = onsetIndex(apex.tension, 0.1);
    if (onset >= 0) {
      events.push({
        kind: 'pickup',
        label: 'Pick-up (hook tension onset)',
        time_s: apex.t[onset],
        nodeId: apex.nodeId,
      });
    }
    const peakIdx = argMax(apex.tension);
    if (peakIdx >= 0) {
      peakTensionTimeS = apex.t[peakIdx];
      events.push({
        kind: 'peak_tension',
        label: 'Peak sling/hook tension',
        time_s: peakTensionTimeS,
        nodeId: apex.nodeId,
        value: apex.tension[peakIdx],
        unit: 'kN',
      });
    }
    // Placement: tension falling back below pick-up threshold near the end.
    const placeThreshold = 0.1 * apexPeak;
    for (let i = peakIdx; i < apex.tension.length; i++) {
      if (apex.tension[i] <= placeThreshold) {
        events.push({
          kind: 'placement',
          label: 'Placement (load set down)',
          time_s: apex.t[i],
          nodeId: apex.nodeId,
        });
        break;
      }
    }
  }

  events.sort((a, b) => a.time_s - b.time_s);
  return { events, peakTensionTimeS };
}
