import { useStore } from '../../state/store';
import { STANDARDS_TEXT } from '../../domain/constants';
import { fmtNum, fmtTime } from '../format';
import { summaryCards } from '../tabs/resultsModel';

export function PrintReport() {
  const result = useStore((s) => s.result);
  const dataset = useStore((s) => s.dataset);
  const config = useStore((s) => s.config);
  const thresholds = useStore((s) => s.thresholds);

  if (!result || !dataset) {
    return (
      <div className="print-report">
        <p>No analysis loaded. Return to the app and load data first.</p>
        <a href="#">← Back to DropLab</a>
      </div>
    );
  }

  const cards = summaryCards(result, thresholds);
  const generated = new Date().toLocaleString('en-AU');

  return (
    <>
      <div className="print-actions">
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <a className="btn secondary" href="#">
          ← Back to DropLab
        </a>
      </div>

      <div className="print-report">
        <div className="watermark">DRAFT</div>

        <div className="report-head">
          <h1>DropLab — Drop Report</h1>
          <div className="muted">
            {config.testReference} · {config.aircraft} · {config.mode.toUpperCase()} ·{' '}
            {dataset.simulated ? 'SIMULATED DATA' : 'Measured data'}
          </div>
          <div className="small muted">Generated {generated}</div>
        </div>

        {dataset.simulated && (
          <div className="notice sim">SIMULATED DATA — not from instrumented hardware.</div>
        )}

        <section>
          <h2>Test configuration</h2>
          <table>
            <tbody>
              <tr>
                <td>Test reference</td>
                <td>{config.testReference}</td>
                <td>Aircraft</td>
                <td>{config.aircraft}</td>
              </tr>
              <tr>
                <td>Mode</td>
                <td>{config.mode}</td>
                <td>Suspended mass</td>
                <td>{config.suspendedMassKg} kg</td>
              </tr>
              <tr>
                <td>{config.mode === 'ext' ? 'Pendant length' : 'Drop altitude'}</td>
                <td>{config.mode === 'ext' ? `${config.pendantLengthM} m` : `${config.dropAltitudeM} m`}</td>
                <td>CFC / sample rate</td>
                <td>
                  {String(result.cfc)} · {dataset.sampleRate} Hz
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Summary</h2>
          <table>
            <tbody>
              {cards.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td>
                    {c.value} {c.unit ?? ''}
                  </td>
                  <td>{c.flag ? c.flag.toUpperCase() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Event timeline</h2>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Time</th>
                <th>Node</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {result.events.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td>{fmtTime(e.time_s)}</td>
                  <td>{e.nodeId ?? '—'}</td>
                  <td>{e.value != null ? `${fmtNum(e.value, 1)} ${e.unit ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Verification matrix</h2>
          <table>
            <thead>
              <tr>
                <th>Objective</th>
                <th>Value</th>
                <th>Threshold</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.verification.map((v, i) => (
                <tr key={i}>
                  <td>{v.objective}</td>
                  <td>{v.value}</td>
                  <td>{v.threshold}</td>
                  <td>{v.flag.toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Standards & disclaimer</h2>
          <p className="small">{STANDARDS_TEXT.filter}</p>
          <p className="small">
            <strong>{STANDARDS_TEXT.disclaimer}</strong>
          </p>
          <p className="small">{STANDARDS_TEXT.offline}</p>
        </section>
      </div>
    </>
  );
}
