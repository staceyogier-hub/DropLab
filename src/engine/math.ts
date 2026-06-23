/**
 * Small pure numeric helpers used across the engine.
 */
import type { ThresholdBand, TrafficLight } from '../domain/types';

/** Resultant magnitude √(x²+y²+z²) at each sample. */
export function resultant(
  x: Float64Array,
  y: Float64Array,
  z: Float64Array,
): Float64Array {
  const n = Math.min(x.length, y.length, z.length);
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = Math.hypot(x[i], y[i], z[i]);
  }
  return r;
}

/** 2-D resultant magnitude √(a²+b²), e.g. off-level from roll & pitch. */
export function magnitude2(a: number, b: number): number {
  return Math.hypot(a, b);
}

/** Index of the maximum value. Returns -1 for an empty array. */
export function argMax(x: ArrayLike<number>): number {
  let idx = -1;
  let best = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (x[i] > best) {
      best = x[i];
      idx = i;
    }
  }
  return idx;
}

/** Maximum value, or -Infinity for an empty range. */
export function maxOf(x: ArrayLike<number>, from = 0, to = x.length): number {
  let best = -Infinity;
  for (let i = from; i < to; i++) if (x[i] > best) best = x[i];
  return best;
}

/** Mean of a half-open index range. Returns 0 for an empty range. */
export function meanRange(x: ArrayLike<number>, from: number, to: number): number {
  const lo = Math.max(0, from);
  const hi = Math.min(x.length, to);
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += x[i];
  return sum / (hi - lo);
}

/**
 * Traffic-light a measured value against a pass/marginal band.
 *
 * For "lower is better" metrics (default): green ≤ pass, amber ≤ marginal,
 * red beyond. For "higher is better" metrics set `higherIsBetter`.
 */
export function flag(
  value: number,
  band: ThresholdBand,
  higherIsBetter = false,
): TrafficLight {
  if (!Number.isFinite(value)) return 'red';
  if (higherIsBetter) {
    if (value >= band.pass) return 'green';
    if (value >= band.marginal) return 'amber';
    return 'red';
  }
  if (value <= band.pass) return 'green';
  if (value <= band.marginal) return 'amber';
  return 'red';
}

/** Clamp to [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Find the sample index nearest a time value on a monotonic timebase. */
export function nearestIndex(t: Float64Array, time: number): number {
  if (t.length === 0) return -1;
  // Binary search on the sorted timebase.
  let lo = 0;
  let hi = t.length - 1;
  if (time <= t[lo]) return lo;
  if (time >= t[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] === time) return mid;
    if (t[mid] < time) lo = mid;
    else hi = mid;
  }
  return time - t[lo] <= t[hi] - time ? lo : hi;
}
