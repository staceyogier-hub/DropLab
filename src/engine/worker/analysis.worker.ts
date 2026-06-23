/**
 * Analysis Web Worker. Runs the pure engine off the main thread so large,
 * high-rate, multi-node files stay responsive. The engine stays pure — this is
 * only a transport shim around `analyse`.
 */
import { analyse, type AnalyseOptions } from '../analyse';
import type { AnalysisResult, Dataset } from '../../domain/types';

export interface AnalysisRequest {
  id: number;
  dataset: Dataset;
  opts: AnalyseOptions;
}

export type AnalysisResponse =
  | { id: number; ok: true; result: AnalysisResult }
  | { id: number; ok: false; error: string };

/** Minimal worker-scope type so we needn't pull in the WebWorker lib. */
interface WorkerScope {
  onmessage: ((e: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e) => {
  const { id, dataset, opts } = e.data;
  try {
    const result = analyse(dataset, opts);
    ctx.postMessage({ id, ok: true, result });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
