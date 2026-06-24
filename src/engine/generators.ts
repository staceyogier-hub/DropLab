/**
 * Synthetic data generators.
 *
 * Produce physically-plausible, clearly-labelled SIMULATED records so DropLab
 * is usable before instrumented hardware exists. Deterministic given a seed.
 *
 * Airdrop:        exit → extraction shock → canopy opening → steady descent → ground impact.
 * External lift:  ground → pick-up snatch → hover → transit oscillation → manoeuvre → placement.
 */
import type { Dataset, DomainMode, NodeId, NodeSeries } from '../domain/types';
import { FTPS_TO_MPS, G } from '../domain/constants';
import { NODES } from '../domain/nodes';

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussianBump(t: number, centre: number, sigma: number): number {
  const d = t - centre;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

export interface AirdropGenOptions {
  mode?: 'full' | 'static';
  sampleRate?: number;
  durationS?: number;
  suspendedMassKg?: number;
  rateOfDescentFtps?: number;
  impactPeakG?: number;
  impactDurationMs?: number;
  numCanopies?: number;
  seed?: number;
  source?: string;
}

/** Generate a simulated airdrop dataset. */
export function generateAirdrop(options: AirdropGenOptions = {}): Dataset {
  const mode: DomainMode = options.mode ?? 'full';
  const fs = options.sampleRate ?? 2000;
  const duration = options.durationS ?? (mode === 'static' ? 4 : 9);
  const mass = options.suspendedMassKg ?? 1000;
  const rodFtps = options.rateOfDescentFtps ?? 28;
  const rodMps = rodFtps * FTPS_TO_MPS;
  const impactPeakG = options.impactPeakG ?? Math.max(8, rodFtps * 0.7);
  const impactTd = (options.impactDurationMs ?? 45) / 1000;
  const numCanopies = options.numCanopies ?? 1;

  const n = Math.round(duration * fs);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = i / fs;

  // Timeline (s).
  const isStatic = mode === 'static';
  const tExit = isStatic ? 0.3 : 0.5;
  const tExtractPeak = isStatic ? 0.3 : 1.0;
  const tOpen = isStatic ? 0.6 : 2.6;
  const tImpact = duration - (isStatic ? 1.0 : 1.2);
  const dropAltitude = isStatic ? 12 : 350;

  // Weight per canopy line (kN).
  const weightKN = (mass * G) / 1000;
  const extractPeakKN = isStatic ? 0 : weightKN * 2.2;
  const openingShockKN = isStatic ? 0 : (weightKN * 1.8) / numCanopies;
  const steadyTensionKN = isStatic ? 0 : weightKN / numCanopies;

  const series: NodeSeries[] = NODES.map((def) => {
    const nodeRand = mulberry32((options.seed ?? 1) * 131 + def.id.length * 17 + def.id.charCodeAt(0));
    const jitter = (nodeRand() - 0.5) * 0.004; // ±2 ms timing jitter
    const peakScale = 0.9 + nodeRand() * 0.2; // ±10% peak variation
    const swayAmp = 1.5 + nodeRand() * 2.5; // canopy sway (deg)
    const swayFreq = 0.4 + nodeRand() * 0.3; // Hz
    const offLevelImpact = 2 + nodeRand() * 4; // residual off-level at impact (deg)

    const ax = new Float64Array(n);
    const ay = new Float64Array(n);
    const az = new Float64Array(n);
    const roll = new Float64Array(n);
    const pitch = new Float64Array(n);
    const yaw = new Float64Array(n);
    const alt = new Float64Array(n);
    const vz = new Float64Array(n);
    const hasTension = def.hasTension;
    const tension = hasTension ? new Float64Array(n) : null;
    const localImpact = tImpact + jitter;

    for (let i = 0; i < n; i++) {
      const ti = t[i];
      const noise = () => (nodeRand() - 0.5) * 0.04;

      // Vertical specific force: ~1g baseline (supported), impact half-sine pulse.
      let azv = 1 + noise();
      if (def.role === 'struct' && ti >= localImpact && ti <= localImpact + impactTd) {
        azv += impactPeakG * peakScale * Math.sin((Math.PI * (ti - localImpact)) / impactTd);
      }
      az[i] = azv;

      // Lateral: small, with a transient kick at impact.
      const impactKick =
        def.role === 'struct'
          ? 0.4 * impactPeakG * peakScale * gaussianBump(ti, localImpact + impactTd / 2, impactTd / 2)
          : 0;
      ax[i] = noise() + 0.15 * impactKick * (nodeRand() - 0.5);
      ay[i] = noise() + 0.15 * impactKick * (nodeRand() - 0.5);

      // Attitude: canopy sway during descent settling toward an impact off-level.
      const descentPhase = smoothstep(tOpen, tImpact, ti);
      const sway = swayAmp * Math.sin(2 * Math.PI * swayFreq * ti) * (1 - descentPhase * 0.5);
      const settle = offLevelImpact * smoothstep(tImpact - 0.5, tImpact, ti);
      roll[i] = sway + settle * 0.7 + noise();
      pitch[i] = sway * 0.7 + settle * 0.7 + noise();
      yaw[i] = 5 * Math.sin(2 * Math.PI * 0.1 * ti);

      // Descent kinematics.
      const descending = smoothstep(tExit, tOpen, ti);
      const stopped = smoothstep(localImpact - 0.02, localImpact + 0.03, ti);
      const vzNow = -rodMps * descending * (1 - stopped);
      vz[i] = vzNow + noise() * 0.1;
      const fallen = ti <= tExit ? 0 : rodMps * (Math.min(ti, localImpact) - tExit);
      alt[i] = Math.max(0, dropAltitude - fallen);

      // Tension channels.
      if (tension) {
        let tv = 0.02 * weightKN * nodeRand();
        if (def.id === 'EXTRACT' && !isStatic) {
          // Extraction shock: rise to peak then released after opening.
          const env = gaussianBump(ti, tExtractPeak, 0.25);
          const released = 1 - smoothstep(tOpen - 0.3, tOpen, ti);
          tv += extractPeakKN * env * released;
        }
        if (def.id === 'CANOPY' && !isStatic) {
          // Opening shock spike, then steady descent tension.
          const opening = openingShockKN * gaussianBump(ti, tOpen, 0.15);
          const steady = steadyTensionKN * smoothstep(tOpen, tOpen + 0.4, ti) * (1 - stopped);
          tv += opening + steady;
        }
        tension[i] = tv;
      }
    }

    return { nodeId: def.id as NodeId, t, ax, ay, az, roll, pitch, yaw, alt, vz, tension };
  });

  return {
    mode,
    sampleRate: fs,
    series,
    simulated: true,
    source:
      options.source ??
      `Simulated airdrop (${mode}, ${mass} kg, ${rodFtps} ft/s, peak ${impactPeakG.toFixed(0)} g)`,
  };
}

export interface ExternalLiftGenOptions {
  sampleRate?: number;
  durationS?: number;
  suspendedMassKg?: number;
  pendantLengthM?: number;
  airspeedKt?: number;
  snatchDaf?: number;
  manoeuvreDaf?: number;
  swingDeg?: number;
  growing?: boolean;
  seed?: number;
  source?: string;
}

/** Generate a simulated external-lift (underslung load) dataset. */
export function generateExternalLift(options: ExternalLiftGenOptions = {}): Dataset {
  const fs = options.sampleRate ?? 100;
  const duration = options.durationS ?? 45;
  const mass = options.suspendedMassKg ?? 4000;
  const L = options.pendantLengthM ?? 6;
  const snatchDaf = options.snatchDaf ?? 1.8;
  const manoeuvreDaf = options.manoeuvreDaf ?? 1.5;
  const swingDeg = options.swingDeg ?? 6;
  const growing = options.growing ?? false;

  const n = Math.round(duration * fs);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = i / fs;

  // Pendulum natural frequency.
  const fn = (1 / (2 * Math.PI)) * Math.sqrt(G / L);
  const weightKN = (mass * G) / 1000;

  // Timeline.
  const tPick = 3;
  const tHoverStart = tPick + 2;
  const tTransitStart = tHoverStart + 3;
  const tManoeuvre = duration * 0.5;
  const tPlace = duration - 4;

  const series: NodeSeries[] = NODES.map((def) => {
    const nodeRand = mulberry32((options.seed ?? 7) * 97 + def.id.length * 13 + def.id.charCodeAt(0));
    const phase = nodeRand() * 0.5;
    const ampScale = 0.85 + nodeRand() * 0.3;

    const ax = new Float64Array(n);
    const ay = new Float64Array(n);
    const az = new Float64Array(n);
    const roll = new Float64Array(n);
    const pitch = new Float64Array(n);
    const yaw = new Float64Array(n);
    const alt = new Float64Array(n);
    const vz = new Float64Array(n);
    // Apex/hook tension on load-link nodes; CANOPY is the primary hook line.
    const tension = def.hasTension ? new Float64Array(n) : null;

    for (let i = 0; i < n; i++) {
      const ti = t[i];
      const noise = () => (nodeRand() - 0.5) * 0.02;

      // Swing amplitude envelope: zero on ground, builds through transit. A
      // growing record amplifies through the flight (unstable); a bounded one
      // gently damps. A modest mid-flight manoeuvre perturbation is added.
      const lifted = smoothstep(tPick, tHoverStart, ti);
      const transit = smoothstep(tTransitStart, tTransitStart + 4, ti);
      const trend = growing
        ? 1 + 2.0 * smoothstep(tTransitStart, tPlace, ti)
        : 1 - 0.3 * smoothstep(tTransitStart, tPlace, ti);
      let envelope = swingDeg * transit * trend;
      envelope += swingDeg * 0.25 * gaussianBump(ti, tManoeuvre, 1.5);
      const settle = 1 - smoothstep(tPlace, tPlace + 2, ti);
      envelope *= lifted * settle;

      const swing = envelope * ampScale * Math.sin(2 * Math.PI * fn * ti + phase);
      roll[i] = swing + noise();
      pitch[i] = envelope * ampScale * 0.6 * Math.cos(2 * Math.PI * fn * ti + phase) + noise();
      yaw[i] = 3 * Math.sin(2 * Math.PI * 0.05 * ti);

      // Specific force: ~1g hanging, modulated by swing dynamics.
      az[i] = 1 + 0.02 * Math.cos(2 * Math.PI * fn * ti) * lifted + noise();
      ax[i] = 0.03 * swing * (Math.PI / 180) + noise();
      ay[i] = 0.02 * swing * (Math.PI / 180) + noise();

      // Altitude: lifted to a transit height and set back down.
      alt[i] = 30 * lifted * settle + nodeRand() * 0.05;
      vz[i] = noise() * 0.05;

      if (tension) {
        // Static support once lifted.
        const support = weightKN * lifted * settle;
        // Pick-up snatch overshoot (Gaussian bump).
        const snatch = weightKN * (snatchDaf - 1) * gaussianBump(ti, tPick + 0.5, 0.4);
        // Manoeuvre tension rise.
        const man = weightKN * (manoeuvreDaf - 1) * gaussianBump(ti, tManoeuvre, 1.5);
        // Swing-induced tension modulation (always positive, ∝ swing²).
        const swingRad = (swing * Math.PI) / 180;
        const swingTension = weightKN * 0.5 * swingRad * swingRad;
        tension[i] = Math.max(0, support + snatch + man + swingTension + 0.01 * weightKN * nodeRand());
      }
    }

    return { nodeId: def.id as NodeId, t, ax, ay, az, roll, pitch, yaw, alt, vz, tension };
  });

  return {
    mode: 'ext',
    sampleRate: fs,
    series,
    simulated: true,
    source:
      options.source ??
      `Simulated external lift (${mass} kg, ${L} m pendant, fn ${fn.toFixed(3)} Hz)`,
  };
}
