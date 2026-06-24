import { useState } from 'react';
import { useStore } from '../../state/store';
import { validCfcClasses } from '../../engine/filters';
import { CFC_CLASSES } from '../../domain/constants';
import { getNode } from '../../domain/nodes';
import type { CfcSelection } from '../../domain/types';
import { Card, Empty, Light, Pill, Stat } from '../components/common';
import { fmtNum, fmtTime } from '../format';
import { summaryCards } from './resultsModel';

export function ResultsTab() {
  const result = useStore((s) => s.result);
  const dataset = useStore((s) => s.dataset);
  const thresholds = useStore((s) => s.thresholds);
  const cfc = useStore((s) => s.cfc);
  const setCfc = useStore((s) => s.setCfc);
  const recompute = useStore((s) => s.recompute);
  const [syncMethod, setSyncMethod] = useState('gnss');

  if (!result || !dataset) {
    return (
      <Card>
        <Empty>No analysis yet. Load data on the Data tab.</Empty>
      </Card>
    );
  }

  const validClasses = validCfcClasses(dataset.sampleRate);
  const cards = summaryCards(result, thresholds);
  const isExt = !!result.external;

  return (
    <>
      <Card title="Analysis controls">
        <div className="grid cols-3">
          <label className="field">
            <span>CFC class (SAE J211 filter)</span>
            <select
              value={String(cfc)}
              onChange={(e) =>
                setCfc(e.target.value === 'unfiltered' ? 'unfiltered' : (Number(e.target.value) as CfcSelection))
              }
            >
              <option value="unfiltered">Unfiltered</option>
              {CFC_CLASSES.map((c) => (
                <option key={c} value={c} disabled={!validClasses.includes(c)}>
                  CFC {c}
                  {validClasses.includes(c) ? '' : ` (needs >${Math.round(6 * (c * 5) / 3)} Hz)`}
                </option>
              ))}
            </select>
            <span className="hint">Phaseless 4-pole Butterworth (filtfilt).</span>
          </label>
          <label className="field">
            <span>Time-sync method</span>
            <select
              value={syncMethod}
              onChange={(e) => {
                setSyncMethod(e.target.value);
                recompute();
              }}
            >
              <option value="gnss">GNSS / UTC common timebase</option>
              <option value="xcorr">Cross-correlation alignment</option>
            </select>
            <span className="hint">Data is logged on the common synchronised timebase.</span>
          </label>
          <div className="field">
            <span>Sample rate</span>
            <div className="stat" style={{ padding: '8px 10px' }}>
              <span className="value" style={{ fontSize: '1.2rem' }}>
                {dataset.sampleRate}
              </span>{' '}
              <span className="unit">Hz</span>
            </div>
          </div>
        </div>
        {result.warnings.map((w, i) => (
          <div key={i} className="notice warn small">
            ⚠ {w}
          </div>
        ))}
        {result.simulated && <div className="notice sim">Results computed from SIMULATED data.</div>}
      </Card>

      <Card title={isExt ? 'External-lift summary' : 'Drop summary'}>
        <div className="grid cols-3">
          {cards.map((c) => (
            <Stat
              key={c.label}
              label={c.label}
              value={c.value}
              unit={c.unit}
              sub={c.sub}
              flag={c.flag}
            />
          ))}
        </div>
      </Card>

      <Card title={isExt ? 'Event timeline (external lift)' : 'Event timeline'}>
        {result.events.length === 0 ? (
          <Empty>No events detected.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th className="num">Time</th>
                <th>Node</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {result.events.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td className="num">{fmtTime(e.time_s)}</td>
                  <td className="mono">{e.nodeId ?? '—'}</td>
                  <td className="num">
                    {e.value != null ? `${fmtNum(e.value, 1)} ${e.unit ?? ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Per-node results">
        <div className="grid cols-3">
          {result.nodeMetrics
            .filter((m) => dataset.series.some((s) => s.nodeId === m.nodeId))
            .map((m) => {
              const def = getNode(m.nodeId);
              const isLoadLink = def.hasTension;
              const impactFlag = !isExt
                ? m.peakResultantG <= thresholds.impactAccelG.pass
                  ? 'green'
                  : m.peakResultantG <= thresholds.impactAccelG.marginal
                    ? 'amber'
                    : 'red'
                : undefined;
              return (
                <div className="card" key={m.nodeId} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong className="mono">{m.nodeId}</strong>
                    <span className="muted small">{def.role}</span>
                    {impactFlag && (
                      <span style={{ marginLeft: 'auto' }}>
                        <Light flag={impactFlag} />
                      </span>
                    )}
                  </div>
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    {def.name}
                  </div>
                  {isLoadLink ? (
                    <table>
                      <tbody>
                        <tr>
                          <td>Peak tension</td>
                          <td className="num">{fmtNum(m.peakTensionKN, 1)} kN</td>
                        </tr>
                        <tr>
                          <td>Peak resultant</td>
                          <td className="num">{fmtNum(m.peakResultantG, 1)} g</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <tbody>
                        <tr>
                          <td>Peak resultant</td>
                          <td className="num">{fmtNum(m.peakResultantG, 1)} g</td>
                        </tr>
                        {!isExt && (
                          <>
                            <tr>
                              <td>Pulse width</td>
                              <td className="num">{fmtNum(m.pulseWidthMs, 1)} ms</td>
                            </tr>
                            <tr>
                              <td>Onset rate</td>
                              <td className="num">{fmtNum(m.onsetRateGPerMs, 2)} g/ms</td>
                            </tr>
                            <tr>
                              <td>Rate of descent</td>
                              <td className="num">{fmtNum(m.rateOfDescentFtps, 1)} ft/s</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td>{isExt ? 'Peak swing' : 'Off-level at impact'}</td>
                          <td className="num">{fmtNum(m.offLevelDeg, 1)} °</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
        </div>
      </Card>

      <Card title="Measurement-objectives verification matrix">
        <table>
          <thead>
            <tr>
              <th>Objective</th>
              <th>Measurement</th>
              <th className="num">Value</th>
              <th>Threshold</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {result.verification.map((v, i) => (
              <tr key={i}>
                <td>{v.objective}</td>
                <td className="muted small">{v.measurement}</td>
                <td className="num">{v.value}</td>
                <td className="small">{v.threshold}</td>
                <td>
                  <Pill flag={v.flag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
