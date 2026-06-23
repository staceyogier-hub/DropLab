import { STANDARDS_TEXT } from '../../domain/constants';
import { Card } from '../components/common';

export function AboutTab() {
  return (
    <>
      <Card title="About DropLab">
        <p>
          DropLab is the analysis and export tool of the Airdrop Data Instrumentation System (ADIS).
          It ingests synchronised multi-node airdrop logger data, resolves the airdrop into its
          phases, computes and flags the measurement objectives, and exports results. It also
          supports an external-lift (helicopter underslung load) mode.
        </p>
        <p className="muted small">
          This is a DRAFT prototype. Where instrumented hardware is not yet available, the app can
          generate clearly-labelled <strong>simulated</strong> data.
        </p>
      </Card>

      <Card title="No airworthiness determination">
        <div className="notice warn">{STANDARDS_TEXT.disclaimer}</div>
        <p className="small muted">
          Acceptance thresholds are entered by the operator in Test Setup and shown as traffic
          lights: green = within pass, amber = within marginal, red = beyond. They are decision aids,
          not certification limits.
        </p>
      </Card>

      <Card title="Applied standards">
        <h3>Acceleration filtering — SAE J211-1 / ISO 6487</h3>
        <p className="small">{STANDARDS_TEXT.filter}</p>
        <ul className="small">
          <li>Phaseless 4-pole Butterworth (2-pole forward + backward, filtfilt → zero phase).</li>
          <li>
            Channel Frequency Classes: CFC 60, 180, 600, 1000 with −3&nbsp;dB corners of 100, 300,
            1000 and ~1667&nbsp;Hz (CFC × 5/3).
          </li>
          <li>Sample rate must exceed 6× the corner frequency, or the result is flagged.</li>
        </ul>
        <h3>Rate of descent</h3>
        <p className="small">{STANDARDS_TEXT.rateOfDescent}</p>
        <h3>External lift</h3>
        <p className="small">
          Static weight W = m·g; dynamic amplification factor DAF = peak tension ÷ W; pendulum
          natural frequency fn = (1/2π)·√(g/L) for effective pendant length L; swing stability is
          assessed by comparing late-window against mid-window swing amplitude.
        </p>
      </Card>

      <Card title="Offline & data handling">
        <div className="notice info">{STANDARDS_TEXT.offline}</div>
        <p className="small muted">
          The build produces static files that run by opening locally or serving from a local static
          server. No analytics, telemetry, fonts or CDN calls are made. Suitable for handling
          OFFICIAL: SENSITIVE data locally.
        </p>
      </Card>
    </>
  );
}
