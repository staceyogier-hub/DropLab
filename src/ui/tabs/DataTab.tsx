import { useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { parseCsv } from '../../io/csv';
import { SIMULATED_LABEL } from '../../domain/constants';
import { getNode } from '../../domain/nodes';
import { isDesktop, openTextFileNative } from '../../platform/native';
import { Card, Empty } from '../components/common';

// Friendly guard against pathologically large files locking up the parser.
const MAX_BYTES = 120 * 1024 * 1024; // 120 MB

export function DataTab() {
  const dataset = useStore((s) => s.dataset);
  const config = useStore((s) => s.config);
  const computing = useStore((s) => s.computing);
  const generateFromConfig = useStore((s) => s.generateFromConfig);
  const setDataset = useStore((s) => s.setDataset);
  const setTab = useStore((s) => s.setTab);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const processText = async (name: string, text: string) => {
    setErrors([]);
    setWarnings([]);
    try {
      const res = parseCsv(text, { mode: config.mode, source: `Imported: ${name}` });
      setWarnings(res.warnings);
      if (res.errors.length || !res.dataset) {
        setErrors(res.errors.length ? res.errors : ['Failed to parse the file.']);
        return;
      }
      await setDataset(res.dataset);
      setTab('results');
    } catch (e) {
      setErrors([
        `Could not read the file: ${e instanceof Error ? e.message : String(e)}. ` +
          'Check it is a valid DropLab CSV.',
      ]);
    }
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setErrors([
        `File is ${(file.size / 1024 / 1024).toFixed(0)} MB, larger than the ${
          MAX_BYTES / 1024 / 1024
        } MB limit. Please decimate or split it first.`,
      ]);
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      await processText(file.name, text);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onNativeOpen = async () => {
    setBusy(true);
    try {
      const opened = await openTextFileNative([{ name: 'CSV', extensions: ['csv'] }]);
      if (opened) await processText(opened.name, opened.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Load data">
        <div className="grid cols-2">
          <div>
            <h3>Generate simulated data</h3>
            <p className="small muted">
              Produce a physically-plausible, clearly-labelled simulated record from the current Test
              Setup ({config.mode === 'ext' ? 'external lift' : `airdrop ${config.mode}`}).
            </p>
            <div className="btn-row">
              <button className="btn" disabled={busy || computing} onClick={() => void generateFromConfig()}>
                Generate from Test Setup
              </button>
            </div>
          </div>
          <div>
            <h3>Import CSV</h3>
            <p className="small muted">
              Schema: <span className="mono">node_id, t_s, ax_g … tension_kN</span>. Parsed locally;
              nothing is uploaded.
            </p>
            {isDesktop() ? (
              <button className="btn secondary" disabled={busy} onClick={() => void onNativeOpen()}>
                Open CSV…
              </button>
            ) : (
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Import CSV file"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            )}
            {busy && <p className="small muted">Reading…</p>}
          </div>
        </div>

        {errors.length > 0 && (
          <div className="notice warn" style={{ marginTop: 14 }} role="alert">
            <strong>Import errors:</strong>
            <ul className="small" style={{ margin: '6px 0 0' }}>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="notice info small" style={{ marginTop: 10 }}>
            {warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}
      </Card>

      {!dataset ? (
        <Card>
          <Empty>No dataset loaded. Generate or import data to begin.</Empty>
        </Card>
      ) : (
        <Card title="Loaded dataset">
          {dataset.simulated && <div className="notice sim">{SIMULATED_LABEL}</div>}
          <div className="grid cols-4">
            <div className="stat">
              <div className="label">Source</div>
              <div className="value" style={{ fontSize: '0.95rem' }}>
                {dataset.simulated ? 'Simulated' : 'Imported'}
              </div>
              <div className="sub">{dataset.source}</div>
            </div>
            <div className="stat">
              <div className="label">Mode</div>
              <div className="value" style={{ fontSize: '1.1rem' }}>
                {dataset.mode}
              </div>
            </div>
            <div className="stat">
              <div className="label">Nodes</div>
              <div className="value">{dataset.series.length}</div>
            </div>
            <div className="stat">
              <div className="label">Sample rate</div>
              <div className="value">{dataset.sampleRate}</div>
              <div className="sub">Hz</div>
            </div>
          </div>

          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Node</th>
                <th>Name</th>
                <th>Role</th>
                <th className="num">Samples</th>
                <th className="num">Duration (s)</th>
                <th>Tension</th>
              </tr>
            </thead>
            <tbody>
              {dataset.series.map((s) => {
                const def = getNode(s.nodeId);
                const dur = s.t.length ? s.t[s.t.length - 1] - s.t[0] : 0;
                return (
                  <tr key={s.nodeId}>
                    <td className="mono">{s.nodeId}</td>
                    <td>{def.name}</td>
                    <td>{def.role}</td>
                    <td className="num">{s.t.length}</td>
                    <td className="num">{dur.toFixed(2)}</td>
                    <td>{s.tension ? 'yes' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
