import { useEffect, useState } from 'react';
import { useStore, type TabId } from '../state/store';
import { TestSetupTab } from './tabs/TestSetup';
import { DataTab } from './tabs/DataTab';
import { ResultsTab } from './tabs/Results';
import { ChartsTab } from './tabs/Charts';
import { ABCompareTab } from './tabs/ABCompare';
import { ExportTab } from './tabs/ExportTab';
import { AboutTab } from './tabs/About';
import { PrintReport } from './print/PrintReport';

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
  const hash = useHashRoute();

  // Dedicated print route — full-page report with DRAFT watermark.
  if (hash === '#print') {
    return <PrintReport />;
  }

  return (
    <div className="app">
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

      <nav className="tabs" aria-label="Main tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {activeTab === 'setup' && <TestSetupTab />}
        {activeTab === 'data' && <DataTab />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'charts' && <ChartsTab />}
        {activeTab === 'compare' && <ABCompareTab />}
        {activeTab === 'export' && <ExportTab />}
        {activeTab === 'about' && <AboutTab />}
      </main>

      <footer className="app-footer">
        DropLab is a DRAFT prototype. It makes no airworthiness determination — all thresholds are
        operator-set. All processing is local; no data leaves this machine.
      </footer>
    </div>
  );
}
