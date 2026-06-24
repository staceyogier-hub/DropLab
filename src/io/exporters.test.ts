import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Thresholds } from '../domain/types';
import { analyse } from '../engine/analyse';
import { generateAirdrop } from '../engine/generators';
import {
  buildWorkbook,
  csvCell,
  metricsToCsv,
  resultToJson,
  rowsToCsv,
  timeSeriesToCsv,
} from './exporters';

const THRESHOLDS: Thresholds = {
  impactAccelG: { pass: 20, marginal: 35 },
  rateOfDescentFtps: { pass: 28, marginal: 35 },
  forceKN: { pass: 60, marginal: 90 },
  offLevelDeg: { pass: 10, marginal: 20 },
  tensionKN: { pass: 80, marginal: 120 },
  swingDeg: { pass: 10, marginal: 20 },
};

const data = generateAirdrop({ seed: 21, impactPeakG: 18 });
const result = analyse(data, {
  cfc: 180,
  thresholds: THRESHOLDS,
  suspendedMassKg: 1000,
  pendantLengthM: 0,
});

describe('csvCell escaping', () => {
  it('quotes commas, quotes and newlines correctly', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3.5)).toBe('3.5');
  });

  it('rowsToCsv joins with commas and CRLF', () => {
    expect(rowsToCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2');
  });
});

describe('XLSX workbook', () => {
  it('has the four expected sheets', () => {
    const wb = buildWorkbook(result, data);
    expect(wb.SheetNames).toEqual(['Summary', 'Per-Node', 'Event-Timeline', 'Verification-Matrix']);
  });

  it('round-trips through the SheetJS reader', () => {
    const wb = buildWorkbook(result, data);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const reread = XLSX.read(buf, { type: 'array' });
    expect(reread.SheetNames).toContain('Per-Node');
  });
});

describe('metrics / time-series / JSON exports', () => {
  it('metrics CSV contains the per-node header and all nodes', () => {
    const csv = metricsToCsv(result);
    expect(csv).toMatch(/peak_resultant_g/);
    expect(csv).toMatch(/LOAD-CT/);
    expect(csv).toMatch(/Verification matrix/);
  });

  it('time-series CSV round-trips into the import schema', () => {
    const csv = timeSeriesToCsv(data, 100);
    const header = csv.split('\r\n')[0];
    expect(header).toBe(
      'node_id,t_s,ax_g,ay_g,az_g,roll_deg,pitch_deg,yaw_deg,alt_m,vz_mps,tension_kN',
    );
  });

  it('JSON export parses and carries the result', () => {
    const parsed = JSON.parse(resultToJson(result, data));
    expect(parsed.tool).toBe('DropLab');
    expect(parsed.result.summary.peakImpactAccelG).toBeGreaterThan(0);
  });
});
