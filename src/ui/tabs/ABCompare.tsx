import { useRef, useState } from 'react';
import { useStore, type ComparisonRun } from '../../state/store';
import { analyse } from '../../engine/analyse';
import { generateAirdrop } from '../../engine/generators';
import { parseCsv } from '../../io/csv';
import { validCfcClasses } from '../../engine/filters';
import { Card, Empty, Pill } from '../components/common';
import { LineChart, type Series } from '../charts/LineChart';
import { impactZoomSeries } from '../charts/chartData';
import { fmtNum, fmtSigned } from '../format';
import { compareRuns, headlineEquivalence, type Verdict } from './compareModel';
import type { CfcSelection } from '../../domain/types';

function verdictFlag(v: Verdict) {
  return v === 'Improved' ? 'green' : v === 'Equivalent' ? 'amber' : 'red';
}

function impactDecel(run: ComparisonRun, cfc: CfcSelection, color: string, label: string): Series | null {
  const impactT = run.result.events.find((e) => e.kind === 'impact')?.time_s;
  if (impactT == null) return null;
  const all = impactZoomSeries(run.dataset, cfc, impactT, 0.25);
  const peakNode = run.result.summary.peakImpactNodeId;
  const s = all.find((x) => x.label === peakNode) ?? all[0];
  if (!s) return null;
  // Re-centre on impact time so A and B align on the x-axis.
  return { label, points: s.points.map((p) => ({ x: p.x - impactT, y: p.y })), color };
}

export function ABCompareTab() {
  const result = useStore((s) => s.result);
  const dataset = useStore((s) => s.dataset);
  const cfc = useStore((s) => s.cfc);
  const thresholds = useStore((s) => s.thresholds);
  const config = useStore((s) => s.config);
  const runA = useStore((s) => s.runA);
  const runB = useStore((s) => s.runB);
  const setRun = useStore((s) => s.setRun);
  const [bandPct, setBandPct] = useState(5);
  const fileA = useRef<HTMLInputElement>(null);
  const fileB = useRef<HTMLInputElement>(null);

  const setFromCurrent = (slot: 'A' | 'B') => {
    if (!result || !dataset) return;
    setRun(slot, { label: `${slot}: ${dataset.source}`, result, dataset });
  };

  const importRun = async (slot: 'A' | 'B', file: File) => {
    const text = await file.text();
    const res = parseCsv(text, { mode: config.mode, source: file.name });
    if (!res.dataset) return;
    const usableCfc =
      cfc === 'unfiltered'
        ? 'unfiltered'
        : (validCfcClasses(res.dataset.sampleRate).includes(cfc) ? cfc : 'unfiltered');
    const r = analyse(res.dataset, {
      cfc: usableCfc,
      thresholds,
      suspendedMassKg: config.suspendedMassKg,
      pendantLengthM: config.pendantLengthM,
    });
    setRun(slot, { label: `${slot}: ${file.name}`, result: r, dataset: res.dataset });
  };

  const loadDemo = () => {
    const opts = {
      cfc: cfc === 'unfiltered' ? ('unfiltered' as const) : (180 as const),
      thresholds,
      suspendedMassKg: config.suspendedMassKg,
      pendantLengthM: 0,
    };
    const honeycomb = generateAirdrop({
      seed: 100,
      impactPeakG: 22,
      impactDurationMs: 40,
      source: 'Baseline honeycomb (illustrative)',
    });
    const lattice = generateAirdrop({
      seed: 100,
      impactPeakG: 14,
      impactDurationMs: 66,
      source: 'Candidate lattice (illustrative)',
    });
    setRun('A', { label: 'A: Baseline honeycomb (illustrative)', result: analyse(honeycomb, opts), dataset: honeycomb });
    setRun('B', { label: 'B: Candidate lattice (illustrative)', result: analyse(lattice, opts), dataset: lattice });
  };

  const both = runA && runB;
  const rows = both ? compareRuns(runA.result, runB.result, bandPct) : [];
  const headline = both ? headlineEquivalence(runA.result, runB.result, bandPct) : null;

  const overlay: Series[] = [];
  if (runA) {
    const s = impactDecel(runA, cfc, '#134074', 'Run A');
    if (s) overlay.push(s);
  }
  if (runB) {
    const s = impactDecel(runB, cfc, '#cc2b2b', 'Run B');
    if (s) overlay.push(s);
  }

  return (
    <>
      <Card title="Set comparison runs">
        <p className="small muted">
          The LFAM use case: baseline honeycomb vs candidate lattice. Set each run from the current
          analysis or an imported CSV, or load the one-click illustrative demo.
        </p>
        <div className="grid cols-2">
          <div>
            <h3>Run A {runA && <Pill flag="green">{runA.label}</Pill>}</h3>
            <div className="btn-row">
              <button className="btn secondary" disabled={!result} onClick={() => setFromCurrent('A')}>
                Use current analysis
              </button>
              <button className="btn secondary" onClick={() => fileA.current?.click()}>
                Import CSV
              </button>
              <input
                ref={fileA}
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importRun('A', f);
                }}
              />
            </div>
          </div>
          <div>
            <h3>Run B {runB && <Pill flag="green">{runB.label}</Pill>}</h3>
            <div className="btn-row">
              <button className="btn secondary" disabled={!result} onClick={() => setFromCurrent('B')}>
                Use current analysis
              </button>
              <button className="btn secondary" onClick={() => fileB.current?.click()}>
                Import CSV
              </button>
              <input
                ref={fileB}
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importRun('B', f);
                }}
              />
            </div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={loadDemo}>
            Load illustrative demo (honeycomb vs lattice)
          </button>
        </div>
        <div className="notice info small" style={{ marginTop: 10 }}>
          The demo lattice is a <strong>modelled, illustrative</strong> profile (lower peak g, longer
          pulse) — not measured data.
        </div>
      </Card>

      {!both ? (
        <Card>
          <Empty>Set both Run A and Run B to compare.</Empty>
        </Card>
      ) : (
        <>
          <Card title="Headline equivalence (peak deceleration)">
            <div className="notice info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Pill flag={verdictFlag(headline!.verdict)}>{headline!.verdict}</Pill>
              <span>{headline!.text}</span>
            </div>
            <label className="field" style={{ maxWidth: 260, marginTop: 10 }}>
              <span>Equivalence band (± %)</span>
              <input
                type="number"
                value={bandPct}
                min={0}
                onChange={(e) => setBandPct(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </Card>

          <Card title="Impact deceleration overlay (CFC-filtered, aligned on impact)">
            {overlay.length === 0 ? (
              <Empty>No impact deceleration to overlay.</Empty>
            ) : (
              <LineChart series={overlay} xLabel="Time from impact (s)" yLabel="Resultant (g)" />
            )}
          </Card>

          <Card title="Metric comparison (B vs A)">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="num">Run A</th>
                  <th className="num">Run B</th>
                  <th className="num">Δ%</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.label} <span className="muted small">({r.unit})</span>
                    </td>
                    <td className="num">{fmtNum(r.a, 1)}</td>
                    <td className="num">{fmtNum(r.b, 1)}</td>
                    <td className="num">{fmtSigned(r.deltaPct, 1)}%</td>
                    <td>
                      <Pill flag={verdictFlag(r.verdict)}>{r.verdict}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">
              Verdict is relative to the editable equivalence band. “Improved” means Run B is better
              on that metric (lower for peak g / forces / off-level; higher for pulse width).
            </p>
          </Card>
        </>
      )}
    </>
  );
}
