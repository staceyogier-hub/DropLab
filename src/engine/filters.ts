/**
 * SAE J211-1 / ISO 6487 acceleration filtering.
 *
 * The standard channel filter is a phaseless (4-pole) Butterworth, realised as
 * a 2-pole low-pass applied forward and then backward (filtfilt → zero phase).
 * Channel Frequency Classes (CFC) 60/180/600/1000 select the corner frequency.
 *
 * This module is pure and framework-free.
 */
import type { CfcClass } from '../domain/types';
import { CFC_CORNER_HZ } from '../domain/constants';

/** Second-order section coefficients for the digital Butterworth. */
export interface ButterworthCoeffs {
  a0: number;
  a1: number;
  a2: number;
  b1: number;
  b2: number;
}

/**
 * Compute the SAE J211 2-pole Butterworth coefficients for a given CFC value
 * and sample rate. `cfc` is the class number (60/180/600/1000); the formula
 * uses it directly.
 *
 *   T  = 1/fs
 *   wd = 2π·CFC·2.0775
 *   wa = tan(wd·T/2)
 *   den = 1 + √2·wa + wa²
 *   a0 = wa²/den, a1 = 2·a0, a2 = a0
 *   b1 = −2·(wa²−1)/den, b2 = (−1 + √2·wa − wa²)/den
 */
export function cfcCoefficients(cfc: number, fs: number): ButterworthCoeffs {
  if (fs <= 0) throw new Error('Sample rate must be positive.');
  const T = 1 / fs;
  const wd = 2 * Math.PI * cfc * 2.0775;
  const wa = Math.tan((wd * T) / 2);
  const wa2 = wa * wa;
  const den = 1 + Math.SQRT2 * wa + wa2;
  const a0 = wa2 / den;
  const a1 = 2 * a0;
  const a2 = a0;
  const b1 = (-2 * (wa2 - 1)) / den;
  const b2 = (-1 + Math.SQRT2 * wa - wa2) / den;
  return { a0, a1, a2, b1, b2 };
}

/**
 * Single causal pass of the 2-pole IIR. Initial conditions are set to steady
 * state at the first sample value (the filter has unity DC gain), minimising
 * the startup transient and keeping filtfilt symmetric for symmetric inputs.
 */
export function filterForward(x: Float64Array, c: ButterworthCoeffs): Float64Array {
  const n = x.length;
  const y = new Float64Array(n);
  if (n === 0) return y;
  const x0 = x[0];
  let xm1 = x0;
  let xm2 = x0;
  let ym1 = x0;
  let ym2 = x0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = c.a0 * xi + c.a1 * xm1 + c.a2 * xm2 + c.b1 * ym1 + c.b2 * ym2;
    y[i] = yi;
    xm2 = xm1;
    xm1 = xi;
    ym2 = ym1;
    ym1 = yi;
  }
  return y;
}

function reversed(x: Float64Array): Float64Array {
  const n = x.length;
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = x[n - 1 - i];
  return r;
}

/**
 * Zero-phase filter: forward pass, reverse, forward pass again, reverse back.
 * Equivalent to a 4-pole phaseless Butterworth with no group delay.
 */
export function filtfilt(x: Float64Array, c: ButterworthCoeffs): Float64Array {
  if (x.length === 0) return new Float64Array(0);
  const fwd = filterForward(x, c);
  const back = filterForward(reversed(fwd), c);
  return reversed(back);
}

/** Apply the CFC class filter (phaseless) to a channel. */
export function cfcFilter(x: Float64Array, cfc: CfcClass, fs: number): Float64Array {
  const c = cfcCoefficients(cfc, fs);
  return filtfilt(x, c);
}

/**
 * Validate the sample rate against the CFC corner. SAE J211 requires the
 * sample rate to exceed 6× the corner frequency; returns a warning string
 * otherwise, else null.
 */
export function checkSampleRate(cfc: CfcClass, fs: number): string | null {
  const corner = CFC_CORNER_HZ[cfc];
  const minRate = 6 * corner;
  if (fs <= minRate) {
    return (
      `Sample rate ${fs.toFixed(0)} Hz is at or below 6× the CFC${cfc} corner ` +
      `(${corner.toFixed(0)} Hz → ${minRate.toFixed(0)} Hz required). Filtered results may be unreliable.`
    );
  }
  return null;
}

/**
 * The CFC classes whose 6× sample-rate requirement is met at `fs`. The UI uses
 * this to restrict the CFC selector so an undersampled (unstable) filter is
 * never applied.
 */
export function validCfcClasses(fs: number): CfcClass[] {
  return (Object.keys(CFC_CORNER_HZ) as unknown as string[])
    .map((k) => Number(k) as CfcClass)
    .filter((cfc) => fs > 6 * CFC_CORNER_HZ[cfc]);
}
