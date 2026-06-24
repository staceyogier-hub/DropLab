/** SVG node-layout map coloured by each node's traffic-light state. */
import { NODES, getNode } from '../../domain/nodes';
import type { AnalysisResult, NodeId, Thresholds, TrafficLight } from '../../domain/types';
import { flag } from '../../engine/math';

const SIZE = 360;
const PALETTE: Record<TrafficLight, string> = {
  green: '#1b9e4b',
  amber: '#e8a317',
  red: '#cc2b2b',
};

function nodeFlag(
  result: AnalysisResult,
  thresholds: Thresholds,
  nodeId: NodeId,
): TrafficLight | null {
  const m = result.nodeMetrics.find((x) => x.nodeId === nodeId);
  if (!m) return null;
  const def = getNode(nodeId);
  const isExt = !!result.external;
  if (def.hasTension && m.peakTensionKN != null) {
    return flag(m.peakTensionKN, isExt ? thresholds.tensionKN : thresholds.forceKN);
  }
  if (isExt) return flag(m.offLevelDeg, thresholds.swingDeg);
  return flag(m.peakResultantG, thresholds.impactAccelG);
}

export function NodeMap({
  result,
  thresholds,
  enabled,
}: {
  result: AnalysisResult;
  thresholds: Thresholds;
  enabled: NodeId[];
}) {
  const px = (v: number) => v * SIZE;
  const centre = getNode('LOAD-CT').layout;
  const canopy = getNode('CANOPY').layout;
  const extract = getNode('EXTRACT').layout;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      style={{ maxWidth: 420, display: 'block', margin: '0 auto' }}
      role="img"
      aria-label="Node layout coloured by traffic-light state"
    >
      {/* Platform outline (corner nodes). */}
      <polygon
        points={[
          getNode('PLT-FL'),
          getNode('PLT-FR'),
          getNode('PLT-RR'),
          getNode('PLT-RL'),
        ]
          .map((n) => `${px(n.layout.x)},${px(n.layout.y)}`)
          .join(' ')}
        fill="rgba(19,64,116,0.06)"
        stroke="#cdd9e8"
        strokeWidth={1.5}
      />
      {/* Rigging lines. */}
      <line x1={px(canopy.x)} y1={px(canopy.y)} x2={px(centre.x)} y2={px(centre.y)} stroke="#cdd9e8" />
      <line
        x1={px(extract.x)}
        y1={px(extract.y)}
        x2={px(centre.x)}
        y2={px(centre.y)}
        stroke="#cdd9e8"
        strokeDasharray="4 3"
      />

      {NODES.map((n) => {
        const isOn = enabled.includes(n.id);
        const f = isOn ? nodeFlag(result, thresholds, n.id) : null;
        const fill = f ? PALETTE[f] : '#b9c6d6';
        return (
          <g key={n.id} opacity={isOn ? 1 : 0.35}>
            <circle cx={px(n.layout.x)} cy={px(n.layout.y)} r={11} fill={fill} stroke="#0b2545" strokeWidth={1} />
            <text
              x={px(n.layout.x)}
              y={px(n.layout.y) - 15}
              textAnchor="middle"
              fontSize={9}
              fill="#11202f"
            >
              {n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
