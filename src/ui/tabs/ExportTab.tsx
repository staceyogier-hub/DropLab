import { useStore } from '../../state/store';
import {
  buildWorkbook,
  downloadText,
  downloadWorkbook,
  metricsToCsv,
  resultToJson,
  timeSeriesToCsv,
} from '../../io/exporters';
import { Card, Empty } from '../components/common';

export function ExportTab() {
  const result = useStore((s) => s.result);
  const dataset = useStore((s) => s.dataset);
  const config = useStore((s) => s.config);

  if (!result || !dataset) {
    return (
      <Card>
        <Empty>No analysis to export. Load data first.</Empty>
      </Card>
    );
  }

  const base = config.testReference || 'droplab';
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (ext: string) => `${base}_${stamp}.${ext}`;

  return (
    <>
      <Card title="Export results">
        <div className="notice info small">
          All exports are produced locally in your browser — nothing is uploaded.
        </div>
        {result.simulated && <div className="notice sim">Exporting SIMULATED data.</div>}

        <div className="grid cols-2">
          <div>
            <h3>Data files</h3>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button className="btn secondary" onClick={() => downloadText(name('metrics.csv'), metricsToCsv(result), 'text/csv')}>
                Metrics CSV
              </button>
              <button
                className="btn secondary"
                onClick={() => downloadText(name('timeseries.csv'), timeSeriesToCsv(dataset), 'text/csv')}
              >
                Time-series CSV (decimated)
              </button>
              <button
                className="btn secondary"
                onClick={() => downloadText(name('result.json'), resultToJson(result, dataset), 'application/json')}
              >
                Full result JSON
              </button>
              <button className="btn" onClick={() => downloadWorkbook(name('xlsx'), buildWorkbook(result, dataset))}>
                Excel workbook (XLSX)
              </button>
            </div>
          </div>
          <div>
            <h3>Drop report (PDF)</h3>
            <p className="small muted">
              Opens a dedicated print view with a DRAFT watermark; use your browser’s “Save as PDF”.
            </p>
            <div className="btn-row">
              <a className="btn" href="#print" target="_blank" rel="noopener">
                Open print report
              </a>
            </div>
          </div>
        </div>
      </Card>

      <Card title="XLSX workbook contents">
        <p className="small muted">Google-Sheets compatible. Sheets:</p>
        <ul className="small">
          <li>
            <strong>Summary</strong> — drop/EL summary and metadata.
          </li>
          <li>
            <strong>Per-Node</strong> — per-node metrics.
          </li>
          <li>
            <strong>Event-Timeline</strong> — detected events.
          </li>
          <li>
            <strong>Verification-Matrix</strong> — objectives vs thresholds with pass/fail.
          </li>
        </ul>
      </Card>
    </>
  );
}
