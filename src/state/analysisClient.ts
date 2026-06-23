/**
 * Client for the analysis Web Worker, with an automatic in-thread fallback.
 *
 * Heavy filtering/metrics run in a worker so the UI thread stays responsive.
 * If a worker cannot be created or fails to load (for example when the built
 * app is opened directly from `file://`, where module workers are commonly
 * blocked), every request transparently falls back to running the pure engine
 * synchronously on the main thread. Either way the result is identical.
 */
import { analyse, type AnalyseOptions } from '../engine/analyse';
import type { AnalysisResult, Dataset } from '../domain/types';
import type { AnalysisRequest, AnalysisResponse } from '../engine/worker/analysis.worker';

interface Pending {
  resolve: (r: AnalysisResult) => void;
  reject: (e: Error) => void;
  dataset: Dataset;
  opts: AnalyseOptions;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

/** Workers are skipped under jsdom (tests) and where unsupported. */
function workerEnabled(): boolean {
  if (workerBroken) return false;
  if (typeof Worker === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent ?? '')) return false;
  return true;
}

function disableWorker(): void {
  workerBroken = true;
  const entries = [...pending.values()];
  pending.clear();
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
  // Resolve anything in flight on the main thread so callers never hang.
  for (const p of entries) {
    try {
      p.resolve(analyse(p.dataset, p.opts));
    } catch (e) {
      p.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

function getWorker(): Worker | null {
  if (!workerEnabled()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../engine/worker/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      const msg = e.data;
      const h = pending.get(msg.id);
      if (!h) return;
      pending.delete(msg.id);
      if (msg.ok) h.resolve(msg.result);
      else h.reject(new Error(msg.error));
    };
    worker.onerror = (ev) => {
      ev.preventDefault?.();
      disableWorker();
    };
  } catch {
    worker = null;
    workerBroken = true;
  }
  return worker;
}

/** Run the analysis, off-thread when possible, else in-thread. */
export function runAnalysis(dataset: Dataset, opts: AnalyseOptions): Promise<AnalysisResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(analyse(dataset, opts));
  const req: AnalysisRequest = { id: nextId++, dataset, opts };
  return new Promise<AnalysisResult>((resolve, reject) => {
    pending.set(req.id, { resolve, reject, dataset, opts });
    try {
      w.postMessage(req);
    } catch {
      pending.delete(req.id);
      resolve(analyse(dataset, opts));
    }
  });
}

/** True when analysis currently runs off the main thread. */
export function isOffThread(): boolean {
  return workerEnabled();
}
