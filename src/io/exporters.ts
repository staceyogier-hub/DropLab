/**
 * Exporters: metrics CSV, decimated time-series CSV, full-result JSON and an
 * XLSX workbook (Summary, Per-Node, Event-Timeline, Verification-Matrix).
 *
 * All exports are produced locally; nothing is uploaded.
 */
import * as XLSX from 'xlsx';
import type { AnalysisResult, Dataset } from '../domain/types';
import { CSV_COLUMNS } from '../domain/constants';
import { getNode } from '../domain/nodes';
import { decimateIndices } from './decimate';

type Cell = string | number | null | undefined;

/** Escape one CSV cell, quoting when it contains a comma, quote or newline. */
export function csvCell(value: Cell): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Join an array-of-rows into a CSV string (CRLF line endings). */
export function rowsToCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function round(v: number | null, digits = 3): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

const NODE_METRIC_HEADER: Cell[] = [
  'node_id',
  'role',
  'peak_resultant_g',
  'pulse_width_ms',
  'onset_rate_g_per_ms',
  'rate_of_descent_ftps',
  'impact_energy_kJ',
  'in_flight_max_g',
  'roll_deg',
  'pitch_deg',
  'off_level_deg',
  'peak_tension_kN',
];

function nodeMetricRows(result: AnalysisResult): Cell[][] {
  return result.nodeMetrics.map((m) => [
    m.nodeId,
    m.role,
    round(m.peakResultantG),
    round(m.pulseWidthMs),
    round(m.onsetRateGPerMs),
    round(m.rateOfDescentFtps),
    round(m.impactEnergyKJ),
    round(m.inFlightMaxG),
    round(m.attitudeRollDeg),
    round(m.attitudePitchDeg),
    round(m.offLevelDeg),
    round(m.peakTensionKN),
  ]);
}

function summaryRows(result: AnalysisResult): Cell[][] {
  const s = result.summary;
  const rows: Cell[][] = [
    ['Field', 'Value', 'Unit'],
    ['Mode', result.mode, ''],
    ['CFC', String(result.cfc), ''],
    ['Sample rate', result.sampleRate, 'Hz'],
    ['Simulated', result.simulated ? 'yes' : 'no', ''],
    ['Peak impact acceleration', round(s.peakImpactAccelG), 'g'],
    ['Peak impact node', s.peakImpactNodeId ?? '', ''],
    ['Rate of descent at impact', round(s.rateOfDescentFtps), 'ft/s'],
    ['Peak extraction force', round(s.peakExtractionForceKN), 'kN'],
    ['Peak opening shock', round(s.peakOpeningShockKN), 'kN'],
    ['Impact kinetic energy', round(s.impactEnergyKJ), 'kJ'],
    ['Max off-level at impact', round(s.maxOffLevelDeg), 'deg'],
  ];
  if (result.external) {
    const e = result.external;
    rows.push(
      ['Static weight', round(e.staticWeightKN), 'kN'],
      ['Peak sling/hook tension', round(e.peakTensionKN), 'kN'],
      ['Dynamic amplification (DAF)', round(e.daf, 2), ''],
      ['Peak load swing', round(e.peakSwingDeg), 'deg'],
      ['Oscillation period (measured)', round(e.oscillationPeriodS, 2), 's'],
      ['Pendulum period 2π√(L/g)', round(e.pendulumPeriodS, 2), 's'],
      ['Natural frequency', round(e.naturalFreqHz, 3), 'Hz'],
      ['Swing stability', e.stability, ''],
    );
  }
  return rows;
}

function eventRows(result: AnalysisResult): Cell[][] {
  const rows: Cell[][] = [['kind', 'label', 'time_s', 'node_id', 'value', 'unit']];
  for (const e of result.events) {
    rows.push([e.kind, e.label, round(e.time_s, 4), e.nodeId ?? '', round(e.value ?? null), e.unit ?? '']);
  }
  return rows;
}

function verificationRows(result: AnalysisResult): Cell[][] {
  const rows: Cell[][] = [['objective', 'measurement', 'value', 'threshold', 'flag']];
  for (const v of result.verification) {
    rows.push([v.objective, v.measurement, v.value, v.threshold, v.flag]);
  }
  return rows;
}

/** Metrics CSV: a header banner, per-node table, then summary. */
export function metricsToCsv(result: AnalysisResult): string {
  const rows: Cell[][] = [];
  rows.push(['DropLab metrics export', result.simulated ? 'SIMULATED DATA' : 'Measured data']);
  rows.push([]);
  rows.push(['Per-node metrics']);
  rows.push(NODE_METRIC_HEADER);
  rows.push(...nodeMetricRows(result));
  rows.push([]);
  rows.push(['Drop summary']);
  rows.push(...summaryRows(result));
  rows.push([]);
  rows.push(['Verification matrix']);
  rows.push(...verificationRows(result));
  return rowsToCsv(rows);
}

/** Decimated time-series CSV in the import schema (round-trips). */
export function timeSeriesToCsv(dataset: Dataset, maxPointsPerNode = 2000): string {
  const rows: Cell[][] = [[...CSV_COLUMNS]];
  for (const s of dataset.series) {
    const idx = decimateIndices(s.t.length, maxPointsPerNode);
    for (const i of idx) {
      rows.push([
        s.nodeId,
        round(s.t[i], 6),
        round(s.ax[i], 4),
        round(s.ay[i], 4),
        round(s.az[i], 4),
        round(s.roll[i], 3),
        round(s.pitch[i], 3),
        round(s.yaw[i], 3),
        round(s.alt[i], 3),
        round(s.vz[i], 4),
        s.tension ? round(s.tension[i], 4) : '',
      ]);
    }
  }
  return rowsToCsv(rows);
}

/** Full result set as pretty-printed JSON. */
export function resultToJson(result: AnalysisResult, dataset?: Dataset): string {
  return JSON.stringify(
    {
      tool: 'DropLab',
      generatedAt: new Date().toISOString(),
      simulated: result.simulated,
      source: dataset?.source ?? null,
      result,
    },
    null,
    2,
  );
}

/** Build the four-sheet XLSX workbook (Google-Sheets compatible). */
export function buildWorkbook(result: AnalysisResult, dataset?: Dataset): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summary: Cell[][] = [
    ['DropLab — Drop Report (DRAFT)'],
    [result.simulated ? 'SIMULATED DATA — not from instrumented hardware' : 'Measured data'],
    ['Source', dataset?.source ?? ''],
    [],
    ...summaryRows(result),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  const perNode: Cell[][] = [NODE_METRIC_HEADER, ...nodeMetricRows(result)];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perNode), 'Per-Node');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eventRows(result)), 'Event-Timeline');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(verificationRows(result)),
    'Verification-Matrix',
  );

  return wb;
}

/** Serialise a workbook to bytes (xlsx). */
export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

// ---- Browser download helpers (no network; uses an object URL) ------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  triggerDownload(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function downloadWorkbook(filename: string, wb: XLSX.WorkBook): void {
  const buf = workbookToArrayBuffer(wb);
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

/** Human-readable export node label, used by the UI. */
export function nodeLabel(id: string): string {
  try {
    return getNode(id as never).name;
  } catch {
    return id;
  }
}
