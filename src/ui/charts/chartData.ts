/**
 * Build decimated display series from a full-resolution dataset. Analysis is
 * always on full data; these are for charts only (~700 points each).
 */
import type { CfcSelection, Dataset, NodeId } from '../../domain/types';
import { nodeResultant } from '../../engine/metrics';
import { magnitude2 } from '../../engine/math';
import { decimateExtrema, decimateIndices } from '../../io/decimate';
import { getNode } from '../../domain/nodes';
import type { Series } from './LineChart';

const DISPLAY_POINTS = 700;

const PALETTE = [
  '#134074',
  '#1b9e4b',
  '#e8a317',
  '#cc2b2b',
  '#7b4dbf',
  '#1d9fa8',
  '#b5651d',
  '#0b2545',
  '#2b8cff',
  '#9e1b6b',
  '#5b8c00',
];

export function nodeColor(nodeId: NodeId): string {
  let h = 0;
  for (let i = 0; i < nodeId.length; i++) h = (h * 31 + nodeId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function toPoints(t: Float64Array, y: Float64Array, indices: number[]): { x: number; y: number }[] {
  return indices.map((i) => ({ x: t[i], y: y[i] }));
}

/** Filtered resultant acceleration per structural node. */
export function resultantSeries(dataset: Dataset, cfc: CfcSelection): Series[] {
  return dataset.series
    .filter((s) => getNode(s.nodeId).role === 'struct')
    .map((s) => {
      const r = nodeResultant(s, cfc, dataset.sampleRate);
      const idx = decimateExtrema(r, DISPLAY_POINTS);
      return { label: s.nodeId, points: toPoints(s.t, r, idx), color: nodeColor(s.nodeId) };
    });
}

/** Impact-window zoom: structural resultant within ±window of impact. */
export function impactZoomSeries(
  dataset: Dataset,
  cfc: CfcSelection,
  impactTimeS: number,
  windowS = 0.3,
): Series[] {
  const lo = impactTimeS - windowS;
  const hi = impactTimeS + windowS;
  return dataset.series
    .filter((s) => getNode(s.nodeId).role === 'struct')
    .map((s) => {
      const r = nodeResultant(s, cfc, dataset.sampleRate);
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < s.t.length; i++) {
        if (s.t[i] >= lo && s.t[i] <= hi) points.push({ x: s.t[i], y: r[i] });
      }
      return { label: s.nodeId, points, color: nodeColor(s.nodeId) };
    });
}

/** Load-link tension timeline (extraction & canopy / hook). */
export function tensionSeries(dataset: Dataset): Series[] {
  return dataset.series
    .filter((s) => s.tension)
    .map((s) => {
      const tension = s.tension!;
      const idx = decimateExtrema(tension, DISPLAY_POINTS);
      return { label: s.nodeId, points: toPoints(s.t, tension, idx), color: nodeColor(s.nodeId) };
    });
}

/** Altitude (descent profile) for the centre node, with |vz|. */
export function descentSeries(dataset: Dataset): { altitude: Series[]; rate: Series[] } {
  const node = dataset.series.find((s) => s.nodeId === 'LOAD-CT') ?? dataset.series[0];
  if (!node) return { altitude: [], rate: [] };
  const idx = decimateIndices(node.t.length, DISPLAY_POINTS);
  const altitude: Series = {
    label: 'Altitude (m)',
    points: idx.map((i) => ({ x: node.t[i], y: node.alt[i] })),
    color: '#134074',
    fill: true,
  };
  const rate: Series = {
    label: 'Rate of descent |vz| (m/s)',
    points: idx.map((i) => ({ x: node.t[i], y: Math.abs(node.vz[i]) })),
    color: '#cc2b2b',
  };
  return { altitude: [altitude], rate: [rate] };
}

/** Attitude (swing) oscillation per load-body node — used in EL mode. */
export function swingSeries(dataset: Dataset): Series[] {
  return dataset.series
    .filter((s) => {
      const g = getNode(s.nodeId).group;
      return g === 'load' || g === 'centre';
    })
    .map((s) => {
      const n = s.roll.length;
      const sw = new Float64Array(n);
      for (let i = 0; i < n; i++) sw[i] = magnitude2(s.roll[i], s.pitch[i]);
      const idx = decimateExtrema(sw, DISPLAY_POINTS);
      return { label: s.nodeId, points: toPoints(s.t, sw, idx), color: nodeColor(s.nodeId) };
    });
}
