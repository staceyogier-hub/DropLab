# CLAUDE.md — DropLab Airdrop Data Analyser

## What this is
DropLab is the analysis & export tool of the Airdrop Data Instrumentation System (ADIS). It ingests
synchronised multi-node airdrop logger data, resolves the airdrop into its phases, computes and
flags the measurement objectives (accuracy, time, descent rate, impact force, extraction force,
in-flight force), and exports results. It also supports an external-lift (helicopter underslung
load) mode.

## Hard constraints (do not violate)
- **No network at runtime.** No analytics, telemetry, error reporting, fonts, or CDN calls. Bundle
  every dependency. The built app must run fully offline and handle sensitive data locally only.
- **All processing is client-side.** No backend, no uploads. Data never leaves the machine.
- **Offline-capable build.** `npm run build` produces static files that run by opening locally or
  serving from a local static server — no internet required at build-run time.
- Australian English throughout the UI and docs.

## Stack
- React + TypeScript (strict), Vite, Vitest + Testing Library.
- Charts: Chart.js via react-chartjs-2 (decimate large series for display).
- Excel export: SheetJS (`xlsx`). PDF: a dedicated print route + print stylesheet (no heavy dep).
- State: a small store (Zustand) — no Redux. No router needed; tabs via state.
- Lint/format: ESLint + Prettier. No `any` in committed code; model the domain with types.

## Commands
- `npm run dev` — dev server
- `npm run build` — production static build to `dist/`
- `npm run test` / `npm run test:watch` — unit tests
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint`

## Architecture
- `src/engine/` — pure, framework-free analysis (filters, events, metrics, generators). Fully unit-tested. No React imports here.
- `src/io/` — CSV import/validate, exporters (CSV/JSON/XLSX), print-report builder.
- `src/state/` — store, presets, thresholds.
- `src/ui/` — components and tabs.
- `src/domain/` — shared types and constants (nodes, schema, standards text).
- Keep the engine independently importable and testable (it could later back a CLI or a Tauri app).

## Domain glossary
- ADIS = system; ADR = a node; DropLab = this software.
- Node roles: `struct` (platform corners, load corners, centre-top), `canopy` (mains), `extract` (extraction parachute).
- Standard 11-node fit: 4 platform corners, 4 load corners, 1 load centre-top, 1 canopy, 1 extraction.
- Domains/modes: airdrop `full` (full-scale), airdrop `static` (tower/crane), and `ext` (external lift / underslung load).

## CSV schema (one row per sample, per node)
`node_id, t_s, ax_g, ay_g, az_g, roll_deg, pitch_deg, yaw_deg, alt_m, vz_mps, tension_kN`
- t_s on the common synchronised (GNSS/UTC) timebase; vz negative for descent; tension_kN blank for non-load-link nodes.
- Node ids: PLT-FL/FR/RL/RR, LOAD-FL/FR/RL/RR, LOAD-CT, CANOPY, EXTRACT.

## SAE J211 / ISO 6487 acceleration filter (correctness-critical)
- 4-pole **phaseless** Butterworth = a 2-pole low-pass applied forward then backward (filtfilt → zero phase).
- Channel Frequency Classes (CFC): 60, 180, 600, 1000. −3 dB corner = CFC × 5/3 → 100, 300, 1000, 1650 Hz.
- Sample rate must be > 6 × corner frequency (warn the user otherwise).
- Coefficients (T = 1/fs):
  - `wd = 2π·CFC·2.0775`; `wa = tan(wd·T/2)`; `den = 1 + √2·wa + wa²`
  - `a0 = wa²/den`; `a1 = 2·a0`; `a2 = a0`
  - `b1 = −2·(wa²−1)/den`; `b2 = (−1 + √2·wa − wa²)/den`
  - `y[i] = a0·x[i] + a1·x[i−1] + a2·x[i−2] + b1·y[i−1] + b2·y[i−2]`, then reverse / filter / reverse.
- Unit test the coefficients and that filtfilt is zero-phase (a symmetric input stays symmetric; a known sine is attenuated correctly).

## Metrics (airdrop)
Per structural node, from the CFC-filtered resultant acceleration:
- Peak resultant g (filtered); pulse width (window where filtered resultant > 1g + 20%·(peak−1));
  onset rate (g/ms to peak); rate of descent at impact (mean |vz| in the 0.05–0.6 s before impact, report ft/s);
  impact kinetic energy ½·m·v² (kJ, suspended mass); in-flight max g (between opening and impact);
  attitude at impact (roll, pitch; off-level = √(roll²+pitch²)).
- From load-link nodes: peak extraction force (EXTRACT), peak opening shock (CANOPY).
- Event detection: exit/extraction (load-link onset), canopy opening (peak canopy tension before impact),
  ground/water impact (global peak structural resultant).
- Traffic-light each result against operator thresholds: green ≤ pass, amber ≤ marginal, red beyond.

## Metrics (external lift, mode = ext)
- Static weight W = m·g (kN); peak sling/hook tension (kN); DAF = peak/W; peak load swing
  = max √(roll²+pitch²) over load nodes; oscillation period ≈ 2π·√(L/g) (and/or from data);
  stability = bounded vs growing (compare swing amplitude late-window vs mid-window).
- Pendulum natural frequency fn = (1/2π)·√(g/L), L = effective pendant length.

## Presets (auto-fill mass, rate of descent, thresholds — all editable)
Grounded figures: low-velocity cargo rate of descent capped at 28 ft/s; CDS A-22 is 250–2,200 lb;
CH-47F centre hook 26,000 lb (11.8 t). Impact-g thresholds are INDICATIVE placeholders pending
fragility data; flag them as such.
- Airdrop: CDS A-22 low-velocity (~1,000 kg, 28 ft/s); CDS A-22 high-velocity (ring slot, ~80 ft/s);
  Type V ~8,000 kg; Type V ~16,000 kg.
- External lift: light ~1,000 kg (UH-60M class); medium ~4,000 kg (CH-47F class);
  heavy ~9,000 kg (CH-47F centre hook). EL thresholds: tension vs hook rating, swing-angle limit.

## Synthetic data
Provide a generator so the app is usable before hardware exists, producing physically-plausible
records: airdrop (exit → extraction shock → canopy opening → steady descent → ground impact) and
external lift (ground → pick-up snatch → hover → transit oscillation → manoeuvre → placement).
Clearly label generated data as simulated.

## Export
- CSV (metrics), CSV (time-series, decimated), JSON (full result set), XLSX (sheets: Summary,
  Per-Node, Event-Timeline, Verification-Matrix — Google-Sheets compatible), and a print-to-PDF drop
  report with a DRAFT watermark.

## Theme & UX
- Navy/steel ADF palette: navy #0B2545, steel #134074, ice #DCE7F3, green #1B9E4B, amber #E8A317,
  red #CC2B2B. Clean, professional, minimal. Mark prototype builds "DRAFT".
- Tabs: Test Setup · Data · Results · Charts · A/B Compare · Export · About/Standards.
- The app makes no airworthiness determination; thresholds are operator-set. State this in About.

## Definition of done (each feature)
Types model the data; engine code has unit tests; `npm run typecheck`, `npm run test`,
`npm run lint` and `npm run build` all pass; no runtime network calls; Australian English.
