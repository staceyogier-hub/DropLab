import { describe, expect, it } from 'vitest';
import { generateAirdrop } from '../engine/generators';
import { withEnabledNodes } from './select';
import { NODE_IDS } from '../domain/nodes';
import type { NodeId } from '../domain/types';

describe('withEnabledNodes', () => {
  const data = generateAirdrop({ seed: 1 });

  it('keeps only the enabled nodes', () => {
    const enabled: NodeId[] = ['LOAD-CT', 'CANOPY'];
    const out = withEnabledNodes(data, enabled);
    expect(out.series.map((s) => s.nodeId).sort()).toEqual(['CANOPY', 'LOAD-CT']);
  });

  it('returns the same object when nothing is filtered out', () => {
    const out = withEnabledNodes(data, [...NODE_IDS] as NodeId[]);
    expect(out).toBe(data);
  });

  it('drops everything when none are enabled', () => {
    expect(withEnabledNodes(data, []).series.length).toBe(0);
  });
});
