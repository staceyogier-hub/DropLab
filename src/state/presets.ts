/**
 * Test presets. Selecting one auto-fills mass, rate of descent and thresholds
 * (all remain editable). Grounded figures where available; impact-g thresholds
 * are INDICATIVE placeholders.
 */
import type { DomainMode, Thresholds } from '../domain/types';

export interface Preset {
  id: string;
  label: string;
  mode: DomainMode;
  /** Suspended mass (kg). */
  suspendedMassKg: number;
  riggedMassKg: number;
  /** Airdrop target rate of descent (ft/s). */
  rateOfDescentFtps: number;
  numCanopies: number;
  /** External lift pendant length (m) / airspeed (kt). */
  pendantLengthM: number;
  airspeedKt: number;
  aircraft: string;
  thresholds: Thresholds;
  note: string;
  /** Hint passed to the synthetic generator. */
  gen: {
    impactPeakG?: number;
    impactDurationMs?: number;
    snatchDaf?: number;
    swingDeg?: number;
  };
}

function t(
  impactAccelG: [number, number],
  rateOfDescentFtps: [number, number],
  forceKN: [number, number],
  offLevelDeg: [number, number],
  tensionKN: [number, number],
  swingDeg: [number, number],
): Thresholds {
  return {
    impactAccelG: { pass: impactAccelG[0], marginal: impactAccelG[1] },
    rateOfDescentFtps: { pass: rateOfDescentFtps[0], marginal: rateOfDescentFtps[1] },
    forceKN: { pass: forceKN[0], marginal: forceKN[1] },
    offLevelDeg: { pass: offLevelDeg[0], marginal: offLevelDeg[1] },
    tensionKN: { pass: tensionKN[0], marginal: tensionKN[1] },
    swingDeg: { pass: swingDeg[0], marginal: swingDeg[1] },
  };
}

const INDICATIVE = 'Impact-g thresholds are indicative placeholders pending fragility data.';

export const PRESETS: readonly Preset[] = [
  {
    id: 'a22-lv',
    label: 'CDS A-22 — low velocity',
    mode: 'full',
    suspendedMassKg: 1000,
    riggedMassKg: 1100,
    rateOfDescentFtps: 28,
    numCanopies: 1,
    pendantLengthM: 0,
    airspeedKt: 0,
    aircraft: 'C-130J Hercules',
    thresholds: t([20, 35], [28, 32], [40, 60], [10, 20], [80, 120], [10, 20]),
    note: `CDS A-22 container, low-velocity (G-12/26 ft canopy). Rate of descent capped at 28 ft/s. ${INDICATIVE}`,
    gen: { impactPeakG: 18, impactDurationMs: 50 },
  },
  {
    id: 'a22-hv',
    label: 'CDS A-22 — high velocity (ring slot)',
    mode: 'full',
    suspendedMassKg: 1000,
    riggedMassKg: 1100,
    rateOfDescentFtps: 80,
    numCanopies: 1,
    pendantLengthM: 0,
    airspeedKt: 0,
    aircraft: 'C-130J Hercules',
    thresholds: t([60, 90], [80, 90], [60, 90], [12, 22], [80, 120], [10, 20]),
    note: `CDS A-22 high-velocity (ring-slot canopy ~80 ft/s); energy-absorbing honeycomb stack expected. ${INDICATIVE}`,
    gen: { impactPeakG: 65, impactDurationMs: 25 },
  },
  {
    id: 'typev-8t',
    label: 'Type V platform — ~8 t',
    mode: 'full',
    suspendedMassKg: 8000,
    riggedMassKg: 8400,
    rateOfDescentFtps: 28,
    numCanopies: 3,
    pendantLengthM: 0,
    airspeedKt: 0,
    aircraft: 'C-17A Globemaster III',
    thresholds: t([18, 30], [28, 32], [200, 300], [8, 15], [80, 120], [10, 20]),
    note: `Type V modular platform, ~8 t, multi-canopy cluster. ${INDICATIVE}`,
    gen: { impactPeakG: 16, impactDurationMs: 60 },
  },
  {
    id: 'typev-16t',
    label: 'Type V platform — ~16 t',
    mode: 'full',
    suspendedMassKg: 16000,
    riggedMassKg: 16800,
    rateOfDescentFtps: 28,
    numCanopies: 4,
    pendantLengthM: 0,
    airspeedKt: 0,
    aircraft: 'C-17A Globemaster III',
    thresholds: t([15, 25], [28, 32], [350, 500], [8, 15], [80, 120], [10, 20]),
    note: `Type V heavy platform, ~16 t, four-canopy cluster. ${INDICATIVE}`,
    gen: { impactPeakG: 14, impactDurationMs: 70 },
  },
  {
    id: 'el-light',
    label: 'External lift — light (~1 t, UH-60M)',
    mode: 'ext',
    suspendedMassKg: 1000,
    riggedMassKg: 1050,
    rateOfDescentFtps: 0,
    numCanopies: 0,
    pendantLengthM: 4,
    airspeedKt: 60,
    aircraft: 'UH-60M Black Hawk',
    thresholds: t([20, 35], [28, 35], [60, 90], [10, 20], [20, 28], [10, 20]),
    note: 'UH-60M cargo hook class. EL thresholds: tension vs hook rating, swing-angle limit.',
    gen: { snatchDaf: 1.7, swingDeg: 6 },
  },
  {
    id: 'el-medium',
    label: 'External lift — medium (~4 t, CH-47F)',
    mode: 'ext',
    suspendedMassKg: 4000,
    riggedMassKg: 4150,
    rateOfDescentFtps: 0,
    numCanopies: 0,
    pendantLengthM: 6,
    airspeedKt: 70,
    aircraft: 'CH-47F Chinook',
    thresholds: t([20, 35], [28, 35], [60, 90], [10, 20], [70, 95], [10, 20]),
    note: 'CH-47F fore/aft hook class. EL thresholds: tension vs hook rating, swing-angle limit.',
    gen: { snatchDaf: 1.8, swingDeg: 7 },
  },
  {
    id: 'el-heavy',
    label: 'External lift — heavy (~9 t, CH-47F centre hook)',
    mode: 'ext',
    suspendedMassKg: 9000,
    riggedMassKg: 9200,
    rateOfDescentFtps: 0,
    numCanopies: 0,
    pendantLengthM: 8,
    airspeedKt: 60,
    aircraft: 'CH-47F Chinook',
    thresholds: t([20, 35], [28, 35], [60, 90], [8, 15], [100, 115], [8, 15]),
    note: 'CH-47F centre hook rated 26,000 lb (11.8 t / ~115 kN). EL thresholds near hook rating.',
    gen: { snatchDaf: 1.9, swingDeg: 6 },
  },
];

export function getPreset(id: string | null): Preset | undefined {
  return id ? PRESETS.find((p) => p.id === id) : undefined;
}
