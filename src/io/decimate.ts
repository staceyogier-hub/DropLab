/**
 * Display-only decimation. Analysis always runs on full-resolution data; these
 * helpers reduce point counts for charts and time-series export.
 */

/** Evenly-spaced indices (always including first and last). */
export function decimateIndices(n: number, maxPoints: number): number[] {
  if (n <= maxPoints || maxPoints < 2) {
    return Array.from({ length: n }, (_, i) => i);
  }
  const out: number[] = [];
  const step = (n - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) out.push(Math.round(i * step));
  out[out.length - 1] = n - 1;
  return Array.from(new Set(out));
}

/**
 * Bucketed decimation that preserves local extrema: each bucket contributes the
 * sample with the largest deviation from the series mean, so impact peaks are
 * never decimated away.
 */
export function decimateExtrema(values: ArrayLike<number>, maxPoints: number): number[] {
  const n = values.length;
  if (n <= maxPoints || maxPoints < 2) {
    return Array.from({ length: n }, (_, i) => i);
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += values[i];
  mean /= n;

  const indices: number[] = [0];
  const buckets = maxPoints - 2;
  const size = (n - 2) / buckets;
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(1 + b * size);
    const hi = Math.min(n - 1, Math.floor(1 + (b + 1) * size));
    let bestIdx = lo;
    let bestDev = -1;
    for (let i = lo; i < hi; i++) {
      const dev = Math.abs(values[i] - mean);
      if (dev > bestDev) {
        bestDev = dev;
        bestIdx = i;
      }
    }
    indices.push(bestIdx);
  }
  indices.push(n - 1);
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}
