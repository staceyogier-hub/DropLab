/**
 * DropLab application store (Zustand). Holds test config, thresholds, the
 * loaded dataset and computed result, the active CFC, A/B runs and the active
 * tab. Recomputes the analysis (off the main thread when possible) whenever the
 * inputs change.
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
import { validCfcClasses } from '../engine/filters';
import { generateAirdrop, generateExternalLift } from '../engine/generators';
import { runAnalysis } from './analysisClient';
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
  error: string | null;
  computing: boolean;

  setTab: (tab: TabId) => void;
  setConfig: (patch: Partial<TestConfig>) => Promise<void>;
  setThresholds: (patch: Partial<Thresholds>) => Promise<void>;
  setCfc: (cfc: CfcSelection) => Promise<void>;
  applyPreset: (presetId: string) => Promise<void>;
  setDataset: (dataset: Dataset) => Promise<void>;
  generateFromConfig: () => Promise<void>;
  recompute: () => Promise<void>;
  setRun: (slot: 'A' | 'B', run: ComparisonRun | null) => void;
  setNotice: (notice: string | null) => void;
  setError: (error: string | null) => void;
}

// Monotonic token so stale (superseded) async results are discarded.
let recomputeToken = 0;

function bestCfcFor(fs: number, current: CfcSelection): CfcSelection {
  if (current === 'unfiltered') return current;
  const valid = validCfcClasses(fs);
  if (valid.includes(current)) return current;
  return valid.length > 0 ? valid[valid.length - 1] : 'unfiltered';
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
  error: null,
  computing: false,

  setTab: (tab) => set({ activeTab: tab }),
  setNotice: (notice) => set({ notice }),
  setError: (error) => set({ error }),

  setConfig: async (patch) => {
    set({ config: { ...get().config, ...patch, presetId: null } });
    await get().recompute();
  },

  setThresholds: async (patch) => {
    set({
      thresholds: { ...get().thresholds, ...patch },
      config: { ...get().config, presetId: null },
    });
    await get().recompute();
  },

  setCfc: async (cfc) => {
    set({ cfc });
    await get().recompute();
  },

  applyPreset: async (presetId) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    set({ config: presetToConfig(preset, get().config), thresholds: { ...preset.thresholds } });
    await get().recompute();
  },

  setDataset: async (dataset) => {
    const cfc = bestCfcFor(dataset.sampleRate, get().cfc);
    set({ dataset, cfc, config: { ...get().config, mode: dataset.mode } });
    await get().recompute();
  },

  generateFromConfig: async () => {
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
    set({ notice: 'Simulated dataset generated — clearly labelled as simulated.', error: null });
    await get().setDataset(dataset);
  },

  recompute: async () => {
    const { dataset, cfc, thresholds, config } = get();
    if (!dataset) {
      set({ result: null });
      return;
    }
    const effectiveCfc = bestCfcFor(dataset.sampleRate, cfc);
    const token = ++recomputeToken;
    set({ computing: true, error: null, cfc: effectiveCfc });
    try {
      const result = await runAnalysis(dataset, {
        cfc: effectiveCfc,
        thresholds,
        suspendedMassKg: config.suspendedMassKg,
        pendantLengthM: config.pendantLengthM,
      });
      if (token !== recomputeToken) return; // superseded by a newer request
      set({ result, computing: false });
    } catch (e) {
      if (token !== recomputeToken) return;
      set({
        error: e instanceof Error ? e.message : 'Analysis failed.',
        computing: false,
      });
    }
  },

  setRun: (slot, run) => set(slot === 'A' ? { runA: run } : { runB: run }),
}));

export type { TestConfig, Thresholds, DomainMode };
