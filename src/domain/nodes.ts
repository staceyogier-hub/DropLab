/**
 * The standard 11-node instrumentation fit, with roles, grouping and layout
 * coordinates for the SVG node map. Layout is a normalised top-down view of a
 * cargo platform: platform corners outside, load corners inside, centre-top in
 * the middle, with canopy (above) and extraction (trailing) markers.
 */
import type { NodeDef, NodeId } from './types';

export const NODES: readonly NodeDef[] = [
  // Platform corners (outer).
  { id: 'PLT-FL', name: 'Platform Front-Left', role: 'struct', group: 'platform', hasTension: false, layout: { x: 0.18, y: 0.28 } },
  { id: 'PLT-FR', name: 'Platform Front-Right', role: 'struct', group: 'platform', hasTension: false, layout: { x: 0.82, y: 0.28 } },
  { id: 'PLT-RL', name: 'Platform Rear-Left', role: 'struct', group: 'platform', hasTension: false, layout: { x: 0.18, y: 0.78 } },
  { id: 'PLT-RR', name: 'Platform Rear-Right', role: 'struct', group: 'platform', hasTension: false, layout: { x: 0.82, y: 0.78 } },
  // Load corners (inner).
  { id: 'LOAD-FL', name: 'Load Front-Left', role: 'struct', group: 'load', hasTension: false, layout: { x: 0.34, y: 0.4 } },
  { id: 'LOAD-FR', name: 'Load Front-Right', role: 'struct', group: 'load', hasTension: false, layout: { x: 0.66, y: 0.4 } },
  { id: 'LOAD-RL', name: 'Load Rear-Left', role: 'struct', group: 'load', hasTension: false, layout: { x: 0.34, y: 0.66 } },
  { id: 'LOAD-RR', name: 'Load Rear-Right', role: 'struct', group: 'load', hasTension: false, layout: { x: 0.66, y: 0.66 } },
  // Load centre-top.
  { id: 'LOAD-CT', name: 'Load Centre-Top', role: 'struct', group: 'centre', hasTension: false, layout: { x: 0.5, y: 0.53 } },
  // Canopy (mains) — load link.
  { id: 'CANOPY', name: 'Main Canopy Riser', role: 'canopy', group: 'canopy', hasTension: true, layout: { x: 0.5, y: 0.08 } },
  // Extraction parachute — load link.
  { id: 'EXTRACT', name: 'Extraction Parachute', role: 'extract', group: 'extract', hasTension: true, layout: { x: 0.5, y: 0.95 } },
];

export const NODE_IDS: readonly NodeId[] = NODES.map((n) => n.id);

const NODE_BY_ID: ReadonlyMap<NodeId, NodeDef> = new Map(NODES.map((n) => [n.id, n]));

export function getNode(id: NodeId): NodeDef {
  const node = NODE_BY_ID.get(id);
  if (!node) throw new Error(`Unknown node id: ${id}`);
  return node;
}

export function isKnownNodeId(id: string): id is NodeId {
  return NODE_BY_ID.has(id as NodeId);
}

/** Structural nodes carry impact/attitude metrics. */
export function structuralNodes(): NodeDef[] {
  return NODES.filter((n) => n.role === 'struct');
}

/** In external-lift mode the load-body nodes carry swing/attitude. */
export function loadBodyNodes(): NodeDef[] {
  return NODES.filter((n) => n.group === 'load' || n.group === 'centre');
}
