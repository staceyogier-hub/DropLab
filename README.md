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
- The Vite module-preload polyfill is disabled, so the built bundle contains **no `fetch`,
  `XMLHttpRequest` or `sendBeacon`** and no external endpoints (audited on each build). The only
  same-origin asset loaded at runtime is an optional analysis **Web Worker** script; when it can't be
  loaded (e.g. opening from `file://`), analysis falls back to the main thread automatically.

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

## Desktop build (optional, Tauri)

A native desktop target wraps the **same** frontend (no engine or UI changes) into a small binary
with native file open/save dialogs, via Tauri v2.

```bash
npm run tauri:dev     # run the desktop app against the dev server
npm run tauri:build   # produce a native binary + installers
```

The web app detects the Tauri shell at runtime (`window.__TAURI__`) and uses native Save/Open
dialogs; in a browser it falls back to ordinary downloads and a file input. No Tauri code is bundled
into the web build.

**Prerequisites:** the Rust toolchain plus the platform webview libraries. On Debian/Ubuntu:
`webkit2gtk-4.1` and `librsvg2-dev` (see <https://v2.tauri.app/start/prerequisites/>). Run
`npx tauri icon src-tauri/icons/icon.png` to regenerate the full icon set (the committed icons are
plain placeholders). The desktop binary is **not** built in CI here, as those system libraries are
environment-specific.

## Performance & robustness

- **Off the main thread.** Filtering and metric computation run in a Web Worker (`runAnalysis`), so
  large, high-rate, multi-node files stay responsive. The engine stays pure and worker-callable, and
  there is an automatic in-thread fallback.
- **Friendly errors.** Malformed CSVs produce clear, line-aware messages; oversized files are
  rejected with guidance; a React error boundary keeps one bad component from blanking the app. No
  error is reported anywhere — local console only.
- **Accessibility.** Keyboard-navigable tabs (arrow/Home/End) with `tablist`/`tab`/`tabpanel` roles,
  a skip-to-content link, labelled inputs, `aria-live` status for analysis, and the navy/steel
  palette chosen for contrast.

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
