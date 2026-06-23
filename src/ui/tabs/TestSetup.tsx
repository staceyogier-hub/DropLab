import type { ChangeEvent } from 'react';
import { useStore } from '../../state/store';
import { PRESETS } from '../../state/presets';
import { thresholdLabels } from '../../state/thresholds';
import { NODES } from '../../domain/nodes';
import type { DomainMode, NodeId, Thresholds } from '../../domain/types';
import { Card, Field } from '../components/common';

const AIRCRAFT = [
  'C-130J Hercules',
  'C-17A Globemaster III',
  'KC-30A',
  'CH-47F Chinook',
  'UH-60M Black Hawk',
  'MRH-90 Taipan',
];

function numFromEvent(e: ChangeEvent<HTMLInputElement>): number {
  const v = Number(e.target.value);
  return Number.isFinite(v) ? v : 0;
}

export function TestSetupTab() {
  const config = useStore((s) => s.config);
  const thresholds = useStore((s) => s.thresholds);
  const setConfig = useStore((s) => s.setConfig);
  const setThresholds = useStore((s) => s.setThresholds);
  const applyPreset = useStore((s) => s.applyPreset);

  const isExt = config.mode === 'ext';
  const labels = thresholdLabels(config.mode);

  const toggleNode = (id: NodeId, on: boolean) => {
    const set = new Set(config.enabledNodes);
    if (on) set.add(id);
    else set.delete(id);
    setConfig({ enabledNodes: NODES.map((n) => n.id).filter((nid) => set.has(nid)) });
  };

  const setBand = (key: keyof Thresholds, which: 'pass' | 'marginal', value: number) => {
    setThresholds({ [key]: { ...thresholds[key], [which]: value } } as Partial<Thresholds>);
  };

  return (
    <>
      <Card title="Load a preset">
        <Field
          label="Preset"
          hint="Selecting a preset auto-fills mass, rate of descent and thresholds. Everything remains editable."
        >
          <select
            value={config.presetId ?? ''}
            onChange={(e) => (e.target.value ? applyPreset(e.target.value) : undefined)}
          >
            <option value="">— Custom (no preset) —</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        {config.presetId && (
          <div className="notice info small">
            {PRESETS.find((p) => p.id === config.presetId)?.note}
          </div>
        )}
        <div className="notice warn small">
          Impact-acceleration thresholds are <strong>indicative placeholders</strong> pending
          load-specific fragility data — not certification limits.
        </div>
      </Card>

      <Card title="Test configuration">
        <div className="grid cols-3">
          <Field label="Test reference">
            <input
              type="text"
              value={config.testReference}
              onChange={(e) => setConfig({ testReference: e.target.value })}
            />
          </Field>
          <Field label="Test type">
            <select
              value={config.mode}
              onChange={(e) => setConfig({ mode: e.target.value as DomainMode })}
            >
              <option value="full">Airdrop — full-scale</option>
              <option value="static">Airdrop — static (tower/crane)</option>
              <option value="ext">External lift (underslung)</option>
            </select>
          </Field>
          <Field label="Aircraft">
            <select value={config.aircraft} onChange={(e) => setConfig({ aircraft: e.target.value })}>
              {AIRCRAFT.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label={isExt ? 'Transit / hover height (m)' : 'Drop altitude (m AGL)'}>
            <input
              type="number"
              value={config.dropAltitudeM}
              onChange={(e) => setConfig({ dropAltitudeM: numFromEvent(e) })}
            />
          </Field>
          <Field label="Rigged mass (kg)">
            <input
              type="number"
              value={config.riggedMassKg}
              onChange={(e) => setConfig({ riggedMassKg: numFromEvent(e) })}
            />
          </Field>
          <Field label="Suspended mass (kg)" hint="Used for impact energy / static weight.">
            <input
              type="number"
              value={config.suspendedMassKg}
              onChange={(e) => setConfig({ suspendedMassKg: numFromEvent(e) })}
            />
          </Field>

          {!isExt && (
            <>
              <Field label="Target rate of descent (ft/s)">
                <input
                  type="number"
                  value={config.targetRateOfDescentFtps}
                  onChange={(e) => setConfig({ targetRateOfDescentFtps: numFromEvent(e) })}
                />
              </Field>
              <Field label="Number of canopies">
                <input
                  type="number"
                  min={1}
                  value={config.numCanopies}
                  onChange={(e) => setConfig({ numCanopies: numFromEvent(e) })}
                />
              </Field>
              <Field label="Water drop">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={config.waterDrop}
                    onChange={(e) => setConfig({ waterDrop: e.target.checked })}
                  />
                  <span className="small muted">Impact onto water</span>
                </div>
              </Field>
            </>
          )}

          {isExt && (
            <>
              <Field label="Effective pendant length L (m)" hint="Drives fn = (1/2π)√(g/L).">
                <input
                  type="number"
                  value={config.pendantLengthM}
                  onChange={(e) => setConfig({ pendantLengthM: numFromEvent(e) })}
                />
              </Field>
              <Field label="Transit airspeed (kt)">
                <input
                  type="number"
                  value={config.airspeedKt}
                  onChange={(e) => setConfig({ airspeedKt: numFromEvent(e) })}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card title="Acceptance thresholds (traffic-light)">
        <p className="small muted">
          Green ≤ pass · amber ≤ marginal · red beyond.{' '}
          {isExt ? 'Labels reframed for external lift.' : ''}
        </p>
        <table>
          <thead>
            <tr>
              <th>Objective</th>
              <th className="num">Pass ≤</th>
              <th className="num">Marginal ≤</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((l) => (
              <tr key={l.key}>
                <td>{l.label}</td>
                <td className="num">
                  <input
                    type="number"
                    value={thresholds[l.key].pass}
                    onChange={(e) => setBand(l.key, 'pass', numFromEvent(e))}
                    style={{ maxWidth: 110 }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    value={thresholds[l.key].marginal}
                    onChange={(e) => setBand(l.key, 'marginal', numFromEvent(e))}
                    style={{ maxWidth: 110 }}
                  />
                </td>
                <td className="muted">{l.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Node configuration (11-node fit)">
        <p className="small muted">Toggle which instrumentation nodes are fitted for this test.</p>
        <div className="grid cols-3">
          {NODES.map((n) => {
            const on = config.enabledNodes.includes(n.id);
            return (
              <div key={n.id} className="node-toggle">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggleNode(n.id, e.target.checked)}
                  id={`node-${n.id}`}
                />
                <label htmlFor={`node-${n.id}`} style={{ cursor: 'pointer' }}>
                  <strong className="mono">{n.id}</strong>
                  <span className="muted small"> · {n.name}</span>
                </label>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
