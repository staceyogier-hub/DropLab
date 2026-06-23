/**
 * CSV import & validation for the DropLab schema.
 *
 *   node_id, t_s, ax_g, ay_g, az_g, roll_deg, pitch_deg, yaw_deg, alt_m, vz_mps, tension_kN
 *
 * Groups rows by node, infers the sample rate from t_s, tolerates blank
 * tension, and surfaces clear validation errors. Pure and framework-free.
 */
import type { CsvColumn } from '../domain/constants';
import { CSV_COLUMNS, REQUIRED_CSV_COLUMNS } from '../domain/constants';
import { isKnownNodeId } from '../domain/nodes';
import type { Dataset, DomainMode, NodeId, NodeSeries } from '../domain/types';

export interface CsvParseResult {
  dataset: Dataset | null;
  errors: string[];
  warnings: string[];
}

export interface CsvParseOptions {
  mode?: DomainMode;
  source?: string;
}

/** Split a single CSV line, honouring simple double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

interface RawRow {
  values: Map<CsvColumn, string>;
  line: number;
}

/** Median of a numeric array (sorted copy). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Parse a number, returning null for blank/invalid. */
function num(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { dataset: null, errors: ['The file is empty.'], warnings };
  }

  // Header.
  const header = splitLine(lines[0]).map((h) => h.trim());
  const colIndex = new Map<CsvColumn, number>();
  for (const col of CSV_COLUMNS) {
    const idx = header.indexOf(col);
    if (idx >= 0) colIndex.set(col, idx);
  }
  const missing = REQUIRED_CSV_COLUMNS.filter((c) => !colIndex.has(c));
  if (missing.length > 0) {
    errors.push(
      `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
        `Expected header: ${CSV_COLUMNS.join(', ')}.`,
    );
    return { dataset: null, errors, warnings };
  }

  // Data rows.
  const rows: RawRow[] = [];
  let unknownNodeCount = 0;
  let badNumericCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const get = (col: CsvColumn): string => {
      const idx = colIndex.get(col);
      return idx != null ? (cells[idx] ?? '') : '';
    };
    const nodeId = get('node_id').trim();
    if (!isKnownNodeId(nodeId)) {
      unknownNodeCount++;
      continue;
    }
    const tVal = num(get('t_s'));
    const azVal = num(get('az_g'));
    if (tVal == null || azVal == null) {
      badNumericCount++;
      continue;
    }
    const values = new Map<CsvColumn, string>();
    for (const col of CSV_COLUMNS) values.set(col, get(col));
    rows.push({ values, line: i + 1 });
  }

  if (unknownNodeCount > 0) {
    warnings.push(`${unknownNodeCount} row(s) skipped: unrecognised node_id.`);
  }
  if (badNumericCount > 0) {
    warnings.push(`${badNumericCount} row(s) skipped: non-numeric t_s or az_g.`);
  }
  if (rows.length === 0) {
    errors.push('No valid data rows were found.');
    return { dataset: null, errors, warnings };
  }

  // Group by node, preserving sample order.
  const byNode = new Map<NodeId, RawRow[]>();
  for (const row of rows) {
    const id = row.values.get('node_id')!.trim() as NodeId;
    const list = byNode.get(id);
    if (list) list.push(row);
    else byNode.set(id, [row]);
  }

  // Build series and infer sample rate from the node with the most samples.
  const series: NodeSeries[] = [];
  let maxLen = 0;
  let inferredFs = 0;
  for (const [nodeId, nodeRows] of byNode) {
    const n = nodeRows.length;
    const t = new Float64Array(n);
    const ax = new Float64Array(n);
    const ay = new Float64Array(n);
    const az = new Float64Array(n);
    const roll = new Float64Array(n);
    const pitch = new Float64Array(n);
    const yaw = new Float64Array(n);
    const alt = new Float64Array(n);
    const vz = new Float64Array(n);
    const tensionArr = new Float64Array(n);
    let hasTension = false;

    for (let i = 0; i < n; i++) {
      const v = nodeRows[i].values;
      t[i] = num(v.get('t_s')) ?? 0;
      ax[i] = num(v.get('ax_g')) ?? 0;
      ay[i] = num(v.get('ay_g')) ?? 0;
      az[i] = num(v.get('az_g')) ?? 0;
      roll[i] = num(v.get('roll_deg')) ?? 0;
      pitch[i] = num(v.get('pitch_deg')) ?? 0;
      yaw[i] = num(v.get('yaw_deg')) ?? 0;
      alt[i] = num(v.get('alt_m')) ?? 0;
      vz[i] = num(v.get('vz_mps')) ?? 0;
      const tn = num(v.get('tension_kN'));
      if (tn != null) {
        tensionArr[i] = tn;
        hasTension = true;
      }
    }

    if (n > maxLen) {
      maxLen = n;
      const dts: number[] = [];
      for (let i = 1; i < n; i++) {
        const dt = t[i] - t[i - 1];
        if (dt > 0) dts.push(dt);
      }
      const dt = median(dts);
      inferredFs = dt > 0 ? 1 / dt : 0;
    }

    series.push({
      nodeId,
      t,
      ax,
      ay,
      az,
      roll,
      pitch,
      yaw,
      alt,
      vz,
      tension: hasTension ? tensionArr : null,
    });
  }

  if (!(inferredFs > 0)) {
    errors.push('Could not infer a sample rate from t_s — timestamps are not increasing.');
    return { dataset: null, errors, warnings };
  }

  const dataset: Dataset = {
    mode: options.mode ?? 'full',
    sampleRate: Math.round(inferredFs),
    series,
    simulated: false,
    source: options.source ?? 'Imported CSV',
  };
  return { dataset, errors, warnings };
}
