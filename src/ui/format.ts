/** Display formatting helpers for the UI. */
import type { TrafficLight } from '../domain/types';

export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function fmtSigned(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function fmtTime(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} s`;
}

export function flagText(flag: TrafficLight): string {
  return flag === 'green' ? 'Pass' : flag === 'amber' ? 'Marginal' : 'Exceeded';
}
