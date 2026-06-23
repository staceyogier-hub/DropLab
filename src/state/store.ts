/**
 * DropLab application store (Zustand). Holds test config, thresholds, the
 * loaded dataset and computed result, the active CFC, A/B runs and the active
 * tab. Recomputes the analysis whenever the inputs change.
 */
import { create } from 'zustand';
import type {
  AnalysisResult,
  CfcSelection,
  Dataset,
  DomainMode,
  TestConfig,
  Thresholds,
} from '../domain/types';
import { analyse } from '../engine/analyse';
import { validCfcClasses } from '../engine/filters';
import { generateAirdrop, generateExternalLift } from '../engine/generators';
import { DEFAULT_CONFIG, DEFAULT_THRESHOLDS } from './thresholds';
import { getPreset, type Preset } from './presets';

export type TabId =
  | 'setup'
  | 'data'
  | 'results'
  | 'charts'
  | 'compare'
  | 'export'
  | 'about';

export interface ComparisonRun {
  label: string;
  result: AnalysisResult;
  dataset: Dataset;
}

interface StoreState {
  config: TestConfig;
  thresholds: Thresholds;
  cfc: CfcSelection;
  dataset: Dataset | null;
  result: AnalysisResult | null;
  activeTab: TabId;
  runA: ComparisonRun | null;
  runB: ComparisonRun | null;
  notice: string | null;

  setTab: (tab: TabId) => void;
  setConfig: (patch: Partial<TestConfig>) => void;
  setThresholds: (patch: Partial<Thresholds>) => void;
  setCfc: (cfc: CfcSelection) => void;
  applyPreset: (presetId: string) => void;
  setDataset: (dataset: Dataset) => void;
  generateFromConfig: () => void;
  recompute: () => void;
  setRun: (slot: 'A' | 'B', run: ComparisonRun | null) => void;
  setNotice: (notice: string | null) => void;
}

function bestCfcFor(fs: number, current: CfcSelection): CfcSelection {
  if (current === 'unfiltered') return current;
  const valid = validCfcClasses(fs);
  if (valid.includes(current)) return current;
  // Fall back to the highest valid class, else unfiltered.
  return valid.length > 0 ? valid[valid.length - 1] : 'unfiltered';
}

function runAnalysis(
  dataset: Dataset,
  cfc: CfcSelection,
  thresholds: Thresholds,
  config: TestConfig,
): AnalysisResult {
  return analyse(dataset, {
    cfc,
    thresholds,
    suspendedMassKg: config.suspendedMassKg,
    pendantLengthM: config.pendantLengthM,
  });
}

function presetToConfig(preset: Preset, base: TestConfig): TestConfig {
  return {
    ...base,
    mode: preset.mode,
    aircraft: preset.aircraft,
    suspendedMassKg: preset.suspendedMassKg,
    riggedMassKg: preset.riggedMassKg,
    targetRateOfDescentFtps: preset.rateOfDescentFtps,
    numCanopies: preset.numCanopies,
    pendantLengthM: preset.pendantLengthM,
    airspeedKt: preset.airspeedKt,
    presetId: preset.id,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  config: DEFAULT_CONFIG,
  thresholds: DEFAULT_THRESHOLDS,
  cfc: 180,
  dataset: null,
  result: null,
  activeTab: 'setup',
  runA: null,
  runB: null,
  notice: null,

  setTab: (tab) => set({ activeTab: tab }),

  setNotice: (notice) => set({ notice }),

  setConfig: (patch) => {
    const config = { ...get().config, ...patch, presetId: null };
    set({ config });
    get().recompute();
  },

  setThresholds: (patch) => {
    const thresholds = { ...get().thresholds, ...patch };
    set({ thresholds, config: { ...get().config, presetId: null } });
    get().recompute();
  },

  setCfc: (cfc) => {
    set({ cfc });
    get().recompute();
  },

  applyPreset: (presetId) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    const config = presetToConfig(preset, get().config);
    set({ config, thresholds: { ...preset.thresholds } });
    get().recompute();
  },

  setDataset: (dataset) => {
    const { thresholds, config } = get();
    const cfc = bestCfcFor(dataset.sampleRate, get().cfc);
    const result = runAnalysis(dataset, cfc, thresholds, { ...config, mode: dataset.mode });
    set({ dataset, cfc, result, config: { ...config, mode: dataset.mode } });
  },

  generateFromConfig: () => {
    const { config } = get();
    const preset = getPreset(config.presetId);
    let dataset: Dataset;
    if (config.mode === 'ext') {
      dataset = generateExternalLift({
        suspendedMassKg: config.suspendedMassKg,
        pendantLengthM: config.pendantLengthM,
        airspeedKt: config.airspeedKt,
        snatchDaf: preset?.gen.snatchDaf,
        swingDeg: preset?.gen.swingDeg,
        source: preset ? `Simulated ${preset.label}` : undefined,
      });
    } else {
      dataset = generateAirdrop({
        mode: config.mode === 'static' ? 'static' : 'full',
        suspendedMassKg: config.suspendedMassKg,
        rateOfDescentFtps: config.targetRateOfDescentFtps,
        numCanopies: Math.max(1, config.numCanopies),
        impactPeakG: preset?.gen.impactPeakG,
        impactDurationMs: preset?.gen.impactDurationMs,
        source: preset ? `Simulated ${preset.label}` : undefined,
      });
    }
    get().setDataset(dataset);
    set({ notice: 'Simulated dataset generated — clearly labelled as simulated.' });
  },

  recompute: () => {
    const { dataset, cfc, thresholds, config } = get();
    if (!dataset) {
      set({ result: null });
      return;
    }
    const effectiveCfc = bestCfcFor(dataset.sampleRate, cfc);
    const result = runAnalysis(dataset, effectiveCfc, thresholds, config);
    set({ result, cfc: effectiveCfc });
  },

  setRun: (slot, run) => set(slot === 'A' ? { runA: run } : { runB: run }),
}));

export type { TestConfig, Thresholds, DomainMode };
