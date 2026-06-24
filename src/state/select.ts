/**
 * Derived-data selectors.
 */
import type { Dataset, NodeId } from '../domain/types';

/**
 * Restrict a dataset to the fitted (enabled) nodes. Nodes unchecked in Test
 * Setup are excluded from analysis, charts and exports so an unfitted or failed
 * sensor cannot drive the results. A node absent from `enabled` is dropped; a
 * node in `enabled` but absent from the data is simply not present.
 */
export function withEnabledNodes(dataset: Dataset, enabled: NodeId[]): Dataset {
  const set = new Set(enabled);
  const series = dataset.series.filter((s) => set.has(s.nodeId));
  // Avoid allocating a new object when nothing is filtered out.
  if (series.length === dataset.series.length) return dataset;
  return { ...dataset, series };
}
