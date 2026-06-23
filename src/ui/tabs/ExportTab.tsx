import { useStore } from '../../state/store';
import {
  buildWorkbook,
  metricsToCsv,
  resultToJson,
  timeSeriesToCsv,
  workbookToArrayBuffer,
} from '../../io/exporters';
import { isDesktop, saveBytes, saveText } from '../../platform/native';
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

  const saveXlsx = () => {
    const buf = workbookToArrayBuffer(buildWorkbook(result, dataset));
    return saveBytes(
      name('xlsx'),
      new Uint8Array(buf),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  };

  return (
    <>
      <Card title="Export results">
        <div className="notice info small">
          All exports are produced locally{isDesktop() ? ' (native Save dialog)' : ' in your browser'}{' '}
          — nothing is uploaded.
        </div>
        {result.simulated && <div className="notice sim">Exporting SIMULATED data.</div>}

        <div className="grid cols-2">
          <div>
            <h3>Data files</h3>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button
                className="btn secondary"
                onClick={() => void saveText(name('metrics.csv'), metricsToCsv(result), 'text/csv')}
              >
                Metrics CSV
              </button>
              <button
                className="btn secondary"
                onClick={() => void saveText(name('timeseries.csv'), timeSeriesToCsv(dataset), 'text/csv')}
              >
                Time-series CSV (decimated)
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  void saveText(name('result.json'), resultToJson(result, dataset), 'application/json')
                }
              >
                Full result JSON
              </button>
              <button className="btn" onClick={() => void saveXlsx()}>
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
