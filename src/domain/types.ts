/**
 * DropLab domain types.
 *
 * Shared, framework-free type definitions for the ADIS analysis tool. These
 * model the synchronised multi-node airdrop/external-lift logger data, the
 * analysis result set, and the operator thresholds. No React, no I/O.
 */

/** The 11 standard instrumentation node ids. */
export type NodeId =
  | 'PLT-FL'
  | 'PLT-FR'
  | 'PLT-RL'
  | 'PLT-RR'
  | 'LOAD-FL'
  | 'LOAD-FR'
  | 'LOAD-RL'
  | 'LOAD-RR'
  | 'LOAD-CT'
  | 'CANOPY'
  | 'EXTRACT';

/** Coarse role used to drive analysis and UI behaviour. */
export type NodeRole = 'struct' | 'canopy' | 'extract';

/** Finer grouping for layout and labelling. */
export type NodeGroup = 'platform' | 'load' | 'centre' | 'canopy' | 'extract';

/** A node definition (static configuration, not data). */
export interface NodeDef {
  readonly id: NodeId;
  readonly name: string;
  readonly role: NodeRole;
  readonly group: NodeGroup;
  /** Load-link nodes carry a tension channel. */
  readonly hasTension: boolean;
  /** Normalised layout position (0..1) for the SVG node map. */
  readonly layout: { readonly x: number; readonly y: number };
}

/** Analysis domain / mode. */
export type DomainMode = 'full' | 'static' | 'ext';

/** Channel Frequency Class per SAE J211 / ISO 6487. */
export type CfcClass = 60 | 180 | 600 | 1000;

/** CFC selection including the unfiltered passthrough. */
export type CfcSelection = CfcClass | 'unfiltered';

/** One parsed CSV row (one sample for one node). */
export interface CsvRow {
  node_id: NodeId;
  t_s: number;
  ax_g: number;
  ay_g: number;
  az_g: number;
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  alt_m: number;
  vz_mps: number;
  /** Blank for non-load-link nodes. */
  tension_kN: number | null;
}

/**
 * Per-node time series stored as typed arrays for performance. All arrays
 * share the same length and index the common synchronised timebase `t`.
 */
export interface NodeSeries {
  nodeId: NodeId;
  t: Float64Array;
  ax: Float64Array;
  ay: Float64Array;
  az: Float64Array;
  roll: Float64Array;
  pitch: Float64Array;
  yaw: Float64Array;
  alt: Float64Array;
  vz: Float64Array;
  /** null when the node has no load link. */
  tension: Float64Array | null;
}

/** A full loaded dataset: every node's series plus shared metadata. */
export interface Dataset {
  mode: DomainMode;
  /** Inferred common sample rate (Hz). */
  sampleRate: number;
  series: NodeSeries[];
  /** True when produced by the synthetic generator. */
  simulated: boolean;
  /** Human-readable provenance, e.g. "Simulated CDS A-22 low-velocity". */
  source: string;
}

/** Traffic-light state for a flagged result. */
export type TrafficLight = 'green' | 'amber' | 'red';

/** A pass/marginal threshold band. Beyond marginal is red. */
export interface ThresholdBand {
  pass: number;
  marginal: number;
}

/** Operator-set acceptance thresholds. Indicative until fragility data exists. */
export interface Thresholds {
  /** Peak impact resultant acceleration (g). */
  impactAccelG: ThresholdBand;
  /** Rate of descent at impact (ft/s). */
  rateOfDescentFtps: ThresholdBand;
  /** Peak load-link force — extraction / opening shock (kN). */
  forceKN: ThresholdBand;
  /** Off-level attitude at impact (deg). */
  offLevelDeg: ThresholdBand;
  /** External lift: peak sling/hook tension (kN). */
  tensionKN: ThresholdBand;
  /** External lift: peak load swing angle (deg). */
  swingDeg: ThresholdBand;
}

/** Detected airdrop / external-lift events. */
export type EventKind =
  | 'exit'
  | 'extraction'
  | 'canopy_opening'
  | 'impact'
  | 'pickup'
  | 'peak_tension'
  | 'placement';

export interface AnalysisEvent {
  kind: EventKind;
  label: string;
  time_s: number;
  nodeId?: NodeId;
  value?: number;
  unit?: string;
}

/** Per-node computed metrics. */
export interface NodeMetrics {
  nodeId: NodeId;
  role: NodeRole;
  /** Peak filtered resultant acceleration (g). */
  peakResultantG: number;
  /** Pulse width above the 20%-of-peak threshold (ms). */
  pulseWidthMs: number;
  /** Onset rate to peak (g/ms). */
  onsetRateGPerMs: number;
  /** Rate of descent before impact (ft/s). */
  rateOfDescentFtps: number;
  /** Impact kinetic energy ½·m·v² (kJ). */
  impactEnergyKJ: number;
  /** Max resultant g between canopy opening and impact. */
  inFlightMaxG: number;
  /** Attitude at impact (deg). */
  attitudeRollDeg: number;
  attitudePitchDeg: number;
  /** Off-level √(roll²+pitch²) at impact (deg). */
  offLevelDeg: number;
  /** Peak tension for load-link nodes, else null (kN). */
  peakTensionKN: number | null;
  /** Time of this node's peak resultant (s). */
  peakTimeS: number;
}

/** Drop-level summary (airdrop). */
export interface DropSummary {
  peakImpactAccelG: number;
  peakImpactNodeId: NodeId | null;
  rateOfDescentFtps: number;
  peakExtractionForceKN: number | null;
  peakOpeningShockKN: number | null;
  impactEnergyKJ: number;
  maxOffLevelDeg: number;
}

/** External-lift metrics. */
export interface ExternalLiftMetrics {
  /** Static weight W = m·g (kN). */
  staticWeightKN: number;
  /** Peak sling/hook tension (kN). */
  peakTensionKN: number;
  /** Dynamic amplification factor = peak / static. */
  daf: number;
  /** Peak load swing angle (deg). */
  peakSwingDeg: number;
  /** Oscillation period measured from the data (s). */
  oscillationPeriodS: number;
  /** Theoretical pendulum period 2π·√(L/g) (s). */
  pendulumPeriodS: number;
  /** Pendulum natural frequency fn = (1/2π)·√(g/L) (Hz). */
  naturalFreqHz: number;
  /** Late-window vs mid-window swing comparison. */
  stability: 'bounded' | 'growing' | 'unknown';
  /** Effective pendant length used (m). */
  pendantLengthM: number;
}

/** One row of the measurement-objectives verification matrix. */
export interface VerificationItem {
  objective: string;
  measurement: string;
  value: string;
  threshold: string;
  flag: TrafficLight;
}

/** The complete analysis result. */
export interface AnalysisResult {
  mode: DomainMode;
  cfc: CfcSelection;
  sampleRate: number;
  nodeMetrics: NodeMetrics[];
  summary: DropSummary;
  events: AnalysisEvent[];
  /** Present only in external-lift mode. */
  external: ExternalLiftMetrics | null;
  verification: VerificationItem[];
  warnings: string[];
  simulated: boolean;
}

/** Test configuration captured in Test Setup. */
export interface TestConfig {
  testReference: string;
  mode: DomainMode;
  aircraft: string;
  dropAltitudeM: number;
  riggedMassKg: number;
  suspendedMassKg: number;
  targetRateOfDescentFtps: number;
  numCanopies: number;
  waterDrop: boolean;
  /** External lift only. */
  pendantLengthM: number;
  airspeedKt: number;
  /** Active preset id, or null when custom. */
  presetId: string | null;
  /** Enabled node ids. */
  enabledNodes: NodeId[];
}
