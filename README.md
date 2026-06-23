# DropLab — Airdrop Data Analyser

DropLab is the analysis and export tool of the **Airdrop Data Instrumentation System (ADIS)**. It
ingests synchronised multi-node airdrop logger data, resolves the airdrop into its phases, computes
and flags the measurement objectives (accuracy, time, descent rate, impact force, extraction force,
in-flight force), and exports results. It also supports an **external-lift** (helicopter underslung
load) mode.

> **DRAFT prototype.** DropLab makes **no airworthiness determination** — all acceptance thresholds
> are operator-set, and impact-acceleration thresholds are indicative placeholders pending
> load-specific fragility data.

## Offline & local-only posture

DropLab is built for handling sensitive data on the machine, with **no data egress**:

- **No network calls at runtime.** No analytics, telemetry, error reporting, web fonts or CDN
  requests. Every dependency is bundled.
- **All processing is client-side.** CSV import, analysis, charts and exports run entirely in the
  browser. Nothing is uploaded; data never leaves the machine.
- **Offline-capable build.** `npm run build` emits static files (relative paths) that run by opening
  `dist/index.html` directly or serving `dist/` from any local static server — no internet required.
- The Vite module-preload polyfill is disabled and the app ships as a single bundle, so there is no
  runtime `fetch` of any kind.

Suitable for **OFFICIAL: SENSITIVE** handling. (The *build* step downloads npm dependencies once;
the *built app* makes no network calls.)

## Quick start

```bash
npm install        # one-time, downloads dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # static production build → dist/
npm run preview    # serve the built dist/ locally
```

To run the built app fully offline, open `dist/index.html` in a browser, or serve the folder with
any static server (e.g. `npx serve dist`). No connectivity is needed.

### Checks

```bash
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # ESLint (no `any` in committed code)
npm run test       # Vitest unit tests
npm run build      # production build
```

## Architecture

```
src/
  domain/   shared types, constants, the 11-node fit, standards text (no logic)
  engine/   pure, framework-free analysis — fully unit-tested, no React:
            filters (SAE J211 CFC filtfilt), events, metrics, generators, analyse
  io/       CSV import/validate, decimation, exporters (CSV/JSON/XLSX), download helpers
  state/    Zustand store, presets, default thresholds
  ui/       React components, tabs, charts, print report
```

The **engine is independently importable and testable** — it has no React or DOM dependencies and
could later back a CLI or a desktop (Tauri) build. The correctness-critical filter and metric code
lives there and is covered by unit tests (`src/engine/*.test.ts`).

### Tabs

Test Setup · Data · Results · Charts · A/B Compare · Export · About/Standards.

## Standards applied

- **Acceleration filtering — SAE J211-1 / ISO 6487.** A phaseless 4-pole Butterworth: a 2-pole
  low-pass applied forward then backward (`filtfilt`) for zero phase shift. Channel Frequency Classes
  60/180/600/1000 with −3 dB corners of 100/300/1000/~1667 Hz (CFC × 5⁄3). The sample rate must
  exceed 6× the corner frequency; otherwise the result is flagged and the class is disabled in the
  selector. The coefficient formulae are unit-tested against hand-computed golden values, and the
  `filtfilt` is verified to be zero-phase (a symmetric pulse stays symmetric and is not delayed).
- **Rate of descent** reported in ft/s; low-velocity cargo nominally limited to 28 ft/s.
- **External lift:** static weight `W = m·g`; dynamic amplification `DAF = peak/W`; pendulum natural
  frequency `fn = (1/2π)·√(g/L)`; swing stability from late-window vs mid-window amplitude.

## Synthetic data

Where instrumented hardware is not yet available, DropLab generates **clearly-labelled simulated**
records (airdrop and external lift) that are physically plausible and deterministic given a seed. All
such data is marked *SIMULATED* throughout the UI and exports.

## Exports

Metrics CSV · decimated time-series CSV · full-result JSON · XLSX workbook (Summary, Per-Node,
Event-Timeline, Verification-Matrix — Google-Sheets compatible) · a print-to-PDF drop report with a
DRAFT watermark (dedicated `#print` route + print stylesheet, `window.print()`, no heavy PDF
dependency).

## Stack

React + TypeScript (strict), Vite, Vitest + Testing Library, Chart.js via react-chartjs-2, SheetJS
(`xlsx`), Zustand, ESLint + Prettier. Australian English throughout.
