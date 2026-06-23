import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

const HEADER = 'node_id,t_s,ax_g,ay_g,az_g,roll_deg,pitch_deg,yaw_deg,alt_m,vz_mps,tension_kN';

function buildGoodCsv(): string {
  const lines = [HEADER];
  for (let i = 0; i < 10; i++) {
    const t = (i * 0.001).toFixed(3);
    lines.push(`LOAD-CT,${t},0,0,1,1,1,0,100,-8.5,`);
    lines.push(`EXTRACT,${t},0,0,1,0,0,0,100,-8.5,${(i * 2).toFixed(1)}`);
  }
  return lines.join('\n');
}

describe('parseCsv — valid input', () => {
  it('parses, groups by node and infers the sample rate', () => {
    const { dataset, errors } = parseCsv(buildGoodCsv());
    expect(errors).toEqual([]);
    expect(dataset).not.toBeNull();
    expect(dataset!.series.length).toBe(2);
    expect(dataset!.sampleRate).toBe(1000); // dt = 0.001 s
    expect(dataset!.simulated).toBe(false);
  });

  it('keeps tension only where present', () => {
    const { dataset } = parseCsv(buildGoodCsv());
    const load = dataset!.series.find((s) => s.nodeId === 'LOAD-CT')!;
    const extract = dataset!.series.find((s) => s.nodeId === 'EXTRACT')!;
    expect(load.tension).toBeNull(); // blank tension column
    expect(extract.tension).not.toBeNull();
  });

  it('honours the requested mode', () => {
    const { dataset } = parseCsv(buildGoodCsv(), { mode: 'ext' });
    expect(dataset!.mode).toBe('ext');
  });
});

describe('parseCsv — malformed input', () => {
  it('rejects an empty file', () => {
    const { dataset, errors } = parseCsv('   ');
    expect(dataset).toBeNull();
    expect(errors[0]).toMatch(/empty/i);
  });

  it('rejects a missing required column', () => {
    const { dataset, errors } = parseCsv('node_id,t_s\nLOAD-CT,0');
    expect(dataset).toBeNull();
    expect(errors[0]).toMatch(/Missing required column/);
  });

  it('skips unknown node ids with a warning', () => {
    const csv = `${HEADER}\nFOO-BAR,0,0,0,1,0,0,0,0,0,\nLOAD-CT,0,0,0,1,0,0,0,0,-8,\nLOAD-CT,0.001,0,0,1,0,0,0,0,-8,`;
    const { dataset, warnings } = parseCsv(csv);
    expect(dataset!.series.length).toBe(1);
    expect(warnings.join(' ')).toMatch(/unrecognised node_id/);
  });

  it('skips rows with non-numeric required fields', () => {
    const csv = `${HEADER}\nLOAD-CT,abc,0,0,1,0,0,0,0,-8,\nLOAD-CT,0,0,0,xyz,0,0,0,0,-8,\nLOAD-CT,0.001,0,0,1,0,0,0,0,-8,\nLOAD-CT,0.002,0,0,1,0,0,0,0,-8,`;
    const { dataset, warnings } = parseCsv(csv);
    expect(warnings.join(' ')).toMatch(/non-numeric/);
    expect(dataset!.series[0].t.length).toBe(2);
  });

  it('errors when timestamps do not increase', () => {
    const csv = `${HEADER}\nLOAD-CT,5,0,0,1,0,0,0,0,-8,\nLOAD-CT,5,0,0,1,0,0,0,0,-8,`;
    const { dataset, errors } = parseCsv(csv);
    expect(dataset).toBeNull();
    expect(errors.join(' ')).toMatch(/sample rate/i);
  });
});
