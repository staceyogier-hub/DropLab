import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { withEnabledNodes } from '../../state/select';
import { Card, Empty } from '../components/common';
import { LineChart, type PhaseMarker } from '../charts/LineChart';
import { NodeMap } from '../charts/NodeMap';
import {
  descentSeries,
  impactZoomSeries,
  resultantSeries,
  swingSeries,
  tensionSeries,
} from '../charts/chartData';

const MARKER_COLORS: Record<string, string> = {
  exit: '#7b4dbf',
  extraction: '#e8a317',
  canopy_opening: '#1b9e4b',
  impact: '#cc2b2b',
  pickup: '#7b4dbf',
  peak_tension: '#cc2b2b',
  placement: '#134074',
};

export function ChartsTab() {
  const dataset = useStore((s) => s.dataset);
  const result = useStore((s) => s.result);
  const cfc = useStore((s) => s.cfc);
  const thresholds = useStore((s) => s.thresholds);
  const config = useStore((s) => s.config);

  const markers: PhaseMarker[] = useMemo(
    () =>
      (result?.events ?? []).map((e) => ({
        x: e.time_s,
        label: e.label.split(' ')[0],
        color: MARKER_COLORS[e.kind],
      })),
    [result],
  );

  // Chart only the fitted (enabled) nodes, matching the analysis.
  const shown = useMemo(
    () => (dataset ? withEnabledNodes(dataset, config.enabledNodes) : null),
    [dataset, config.enabledNodes],
  );

  const resultant = useMemo(() => (shown ? resultantSeries(shown, cfc) : []), [shown, cfc]);
  const tension = useMemo(() => (shown ? tensionSeries(shown) : []), [shown]);
  const descent = useMemo(
    () => (shown ? descentSeries(shown) : { altitude: [], rate: [] }),
    [shown],
  );
  const swing = useMemo(() => (shown ? swingSeries(shown) : []), [shown]);

  const impactTime = result?.events.find((e) => e.kind === 'impact')?.time_s ?? null;
  const zoom = useMemo(
    () => (shown && impactTime != null ? impactZoomSeries(shown, cfc, impactTime) : []),
    [shown, cfc, impactTime],
  );

  if (!dataset || !result) {
    return (
      <Card>
        <Empty>No data to chart. Load data on the Data tab.</Empty>
      </Card>
    );
  }

  const isExt = !!result.external;

  return (
    <>
      {result.simulated && <div className="notice sim">Charts show SIMULATED data.</div>}

      <Card title={`Resultant acceleration vs time (CFC ${cfc})`}>
        <LineChart series={resultant} xLabel="Time (s)" yLabel="Resultant (g)" markers={markers} />
      </Card>

      {isExt ? (
        <Card title="Attitude / swing oscillation">
          <p className="small muted">Off-level √(roll²+pitch²) per load-body node.</p>
          <LineChart series={swing} xLabel="Time (s)" yLabel="Swing (°)" markers={markers} />
        </Card>
      ) : (
        <div className="grid cols-2">
          <Card title="Descent profile (altitude)">
            <LineChart series={descent.altitude} xLabel="Time (s)" yLabel="Altitude (m)" markers={markers} />
          </Card>
          <Card title="Rate of descent">
            <LineChart series={descent.rate} xLabel="Time (s)" yLabel="|vz| (m/s)" markers={markers} />
          </Card>
        </div>
      )}

      <Card title={isExt ? 'Sling / hook tension timeline' : 'Line-load timeline (extraction & canopy)'}>
        {tension.length === 0 ? (
          <Empty>No load-link tension channels in this dataset.</Empty>
        ) : (
          <LineChart series={tension} xLabel="Time (s)" yLabel="Tension (kN)" markers={markers} />
        )}
      </Card>

      {!isExt && (
        <Card title="Impact-window zoom (CFC-filtered resultant)">
          {zoom.length === 0 ? (
            <Empty>No impact detected.</Empty>
          ) : (
            <LineChart series={zoom} xLabel="Time (s)" yLabel="Resultant (g)" markers={markers} />
          )}
        </Card>
      )}

      <Card title="Node layout — traffic-light state">
        <NodeMap result={result} thresholds={thresholds} enabled={config.enabledNodes} />
        <p className="small muted" style={{ textAlign: 'center' }}>
          Colour reflects each node's worst objective against the operator thresholds. Dimmed nodes
          are not fitted.
        </p>
      </Card>
    </>
  );
}
