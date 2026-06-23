import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { DEFAULT_CONFIG, DEFAULT_THRESHOLDS } from './thresholds';

function reset() {
  useStore.setState({
    config: { ...DEFAULT_CONFIG },
    thresholds: { ...DEFAULT_THRESHOLDS },
    cfc: 180,
    dataset: null,
    result: null,
    runA: null,
    runB: null,
  });
}

describe('store — load → analyse flow', () => {
  beforeEach(reset);

  it('applies a preset, generates and computes a result', () => {
    const s = useStore.getState();
    s.applyPreset('a22-lv');
    expect(useStore.getState().config.suspendedMassKg).toBe(1000);
    useStore.getState().generateFromConfig();
    const { dataset, result } = useStore.getState();
    expect(dataset).not.toBeNull();
    expect(dataset!.simulated).toBe(true);
    expect(result).not.toBeNull();
    expect(result!.summary.peakImpactAccelG).toBeGreaterThan(0);
  });

  it('switches to external-lift analysis for an EL preset', () => {
    useStore.getState().applyPreset('el-medium');
    expect(useStore.getState().config.mode).toBe('ext');
    useStore.getState().generateFromConfig();
    const { result } = useStore.getState();
    expect(result!.external).not.toBeNull();
    expect(result!.external!.daf).toBeGreaterThan(1);
  });

  it('clamps the CFC to one valid for the sample rate', () => {
    useStore.getState().applyPreset('a22-lv');
    useStore.getState().generateFromConfig();
    // Generator default fs = 2000 Hz; CFC600 is invalid → clamped down.
    useStore.getState().setCfc(600);
    expect(useStore.getState().cfc).not.toBe(600);
  });

  it('recomputing with a lower CFC does not increase the peak', () => {
    useStore.getState().applyPreset('a22-hv');
    useStore.getState().generateFromConfig();
    useStore.getState().setCfc(180);
    const hi = useStore.getState().result!.summary.peakImpactAccelG;
    useStore.getState().setCfc(60);
    const lo = useStore.getState().result!.summary.peakImpactAccelG;
    expect(lo).toBeLessThanOrEqual(hi + 1e-9);
  });
});
