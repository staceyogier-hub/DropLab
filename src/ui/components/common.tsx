/** Small shared presentational components. */
import type { ReactNode } from 'react';
import type { TrafficLight } from '../../domain/types';
import { flagText } from '../format';

export function Light({ flag }: { flag: TrafficLight }) {
  return <span className={`light ${flag}`} aria-label={flagText(flag)} title={flagText(flag)} />;
}

export function Pill({ flag, children }: { flag: TrafficLight; children?: ReactNode }) {
  return <span className={`pill ${flag}`}>{children ?? flagText(flag)}</span>;
}

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card">
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  flag,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  flag?: TrafficLight;
}) {
  return (
    <div className={`stat ${flag ?? ''}`}>
      <div className="label">{label}</div>
      <div>
        <span className="value">{value}</span> {unit && <span className="unit">{unit}</span>}
        {flag && (
          <span style={{ float: 'right' }}>
            <Light flag={flag} />
          </span>
        )}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
