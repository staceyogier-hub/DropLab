/**
 * Physical constants, unit conversions, CSV schema and standards text.
 */
import type { CfcClass } from './types';

/** Standard gravity (m/s²). */
export const G = 9.80665;

/** Metres-per-second to feet-per-second. */
export const MPS_TO_FTPS = 3.280839895;

/** Feet-per-second to metres-per-second. */
export const FTPS_TO_MPS = 1 / MPS_TO_FTPS;

/** Kilograms to pounds. */
export const KG_TO_LB = 2.2046226218;

/** The CSV column order, exactly as ingested/exported. */
export const CSV_COLUMNS = [
  'node_id',
  't_s',
  'ax_g',
  'ay_g',
  'az_g',
  'roll_deg',
  'pitch_deg',
  'yaw_deg',
  'alt_m',
  'vz_mps',
  'tension_kN',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Columns that must be present and numeric for a valid import. */
export const REQUIRED_CSV_COLUMNS: readonly CsvColumn[] = ['node_id', 't_s', 'az_g'];

export const CFC_CLASSES: readonly CfcClass[] = [60, 180, 600, 1000];

/**
 * −3 dB corner frequency for each CFC class (Hz). The principled value is
 * CFC × 5/3; the source CONEMP rounds CFC1000 to ~1650 Hz.
 */
export const CFC_CORNER_HZ: Record<CfcClass, number> = {
  60: 100,
  180: 300,
  600: 1000,
  1000: (1000 * 5) / 3,
};

/** Applied-standards summary shown in About/Standards. */
export const STANDARDS_TEXT = {
  filter:
    'Acceleration channels are filtered per SAE J211-1 / ISO 6487 using a phaseless ' +
    '(4-pole) Butterworth: a 2-pole low-pass applied forward then backward (filtfilt) for ' +
    'zero phase shift. Channel Frequency Classes 60, 180, 600 and 1000 are provided.',
  rateOfDescent:
    'Rate of descent at impact is reported in ft/s. Low-velocity cargo systems are nominally ' +
    'limited to 28 ft/s.',
  disclaimer:
    'DropLab makes no airworthiness determination. All acceptance thresholds are operator-set. ' +
    'Impact-acceleration thresholds are INDICATIVE placeholders pending load-specific fragility ' +
    'data and must not be treated as certification limits.',
  offline:
    'All processing is performed locally in your browser. No data is uploaded and the application ' +
    'makes no network calls at runtime — suitable for OFFICIAL: SENSITIVE handling.',
} as const;

/** Reporting label for whether the active data is real or simulated. */
export const SIMULATED_LABEL = 'SIMULATED DATA — not from instrumented hardware';
