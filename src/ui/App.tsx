import { useEffect, useRef, useState } from 'react';
import { useStore, type TabId } from '../state/store';
import { TestSetupTab } from './tabs/TestSetup';
import { DataTab } from './tabs/DataTab';
import { ResultsTab } from './tabs/Results';
import { ChartsTab } from './tabs/Charts';
import { ABCompareTab } from './tabs/ABCompare';
import { ExportTab } from './tabs/ExportTab';
import { AboutTab } from './tabs/About';
import { PrintReport } from './print/PrintReport';
import { ErrorBoundary } from './components/ErrorBoundary';

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup', label: 'Test Setup' },
  { id: 'data', label: 'Data' },
  { id: 'results', label: 'Results' },
  { id: 'charts', label: 'Charts' },
  { id: 'compare', label: 'A/B Compare' },
  { id: 'export', label: 'Export' },
  { id: 'about', label: 'About / Standards' },
];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

export function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setTab = useStore((s) => s.setTab);
  const error = useStore((s) => s.error);
  const computing = useStore((s) => s.computing);
  const setError = useStore((s) => s.setError);
  const hash = useHashRoute();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Dedicated print route — full-page report with DRAFT watermark.
  if (hash === '#print') {
    return <PrintReport />;
  }

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div>
          <span className="brand">DropLab</span>
        </div>
        <div className="tagline">Airdrop Data Analyser · ADIS</div>
        <span className="offline-badge" title="No network calls at runtime">
          OFFLINE · LOCAL-ONLY
        </span>
        <span className="draft-badge">DRAFT</span>
      </header>

      <nav className="tabs" role="tablist" aria-label="DropLab sections">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`tab-${t.id}`}
            role="tab"
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            aria-selected={activeTab === t.id}
            aria-controls="main"
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main" id="main" role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={-1}>
        {error && (
          <div className="notice warn" role="alert" style={{ display: 'flex', gap: 12 }}>
            <span>⚠ {error}</span>
            <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}
        {computing && (
          <div className="notice info small" aria-live="polite">
            Analysing… (running off the main thread where supported)
          </div>
        )}
        <ErrorBoundary>
          {activeTab === 'setup' && <TestSetupTab />}
          {activeTab === 'data' && <DataTab />}
          {activeTab === 'results' && <ResultsTab />}
          {activeTab === 'charts' && <ChartsTab />}
          {activeTab === 'compare' && <ABCompareTab />}
          {activeTab === 'export' && <ExportTab />}
          {activeTab === 'about' && <AboutTab />}
        </ErrorBoundary>
      </main>

      <footer className="app-footer">
        DropLab is a DRAFT prototype. It makes no airworthiness determination — all thresholds are
        operator-set. All processing is local; no data leaves this machine.
      </footer>
    </div>
  );
}
