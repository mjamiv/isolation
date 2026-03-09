import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAnalysisStore } from '@/stores/analysisStore';
import { Viewer3D } from '../viewer-3d/Viewer3D';
import { ViewerControls } from '../controls/ViewerControls';
import { ModelEditor } from '../model-editor/ModelEditor';
import { PropertyInspector } from '../property-inspector/PropertyInspector';
import { ResultsPanel } from '../results/ResultsPanel';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';

const ComparisonPanel = lazy(() =>
  import('../comparison/ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })),
);

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-1.5 items-center justify-center transition-colors">
      <div className="absolute inset-0 bg-surface-0" />
      <div className="relative z-10 h-8 w-0.5 rounded-full bg-white/[0.06] transition-all duration-200 group-hover:h-12 group-hover:bg-yellow-500/60 group-hover:shadow-glow-gold group-data-[resize-handle-active]:h-16 group-data-[resize-handle-active]:bg-yellow-400" />
    </PanelResizeHandle>
  );
}

function LeftPanel() {
  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="border-b border-white/[0.06] px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
          Model Tree
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ModelEditor />
        <div className="border-t border-white/[0.06] p-3">
          <ViewerControls />
        </div>
      </div>
    </div>
  );
}

type RightTab = 'properties' | 'results' | 'comparison';

const TABS: { value: RightTab; label: string }[] = [
  { value: 'properties', label: 'Properties' },
  { value: 'results', label: 'Results' },
  { value: 'comparison', label: 'Compare' },
];

function RightPanel() {
  const [activeTab, setActiveTab] = useState<RightTab>('properties');
  const analysisStatus = useAnalysisStore((s) => s.status);

  useEffect(() => {
    if (analysisStatus === 'complete') {
      setActiveTab('results');
    }
  }, [analysisStatus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TABS.findIndex((t) => t.value === activeTab);
      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      else return;
      e.preventDefault();
      const next = TABS[nextIndex]!;
      setActiveTab(next.value);
      document.getElementById(`tab-${next.value}`)?.focus();
    },
    [activeTab],
  );

  const activeIndex = TABS.findIndex((t) => t.value === activeTab);

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div
        role="tablist"
        aria-label="Inspector tabs"
        className="relative flex items-center border-b border-white/[0.06]"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            id={`tab-${tab.value}`}
            role="tab"
            tabIndex={activeTab === tab.value ? 0 : -1}
            aria-selected={activeTab === tab.value}
            aria-controls={`right-panel-${tab.value}`}
            onClick={() => setActiveTab(tab.value)}
            className={`relative flex-1 px-3 py-2.5 text-[11px] font-semibold transition-colors duration-150 ${
              activeTab === tab.value ? 'text-yellow-400' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="absolute -bottom-px h-[2px] rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-200 ease-out-expo"
          style={{
            left: `calc(${String(activeIndex)} * ${String(100 / TABS.length)}% + 12px)`,
            width: `calc(${String(100 / TABS.length)}% - 24px)`,
          }}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div
          id="right-panel-properties"
          role="tabpanel"
          aria-labelledby="tab-properties"
          hidden={activeTab !== 'properties'}
        >
          <PropertyInspector />
        </div>
        <div
          id="right-panel-results"
          role="tabpanel"
          aria-labelledby="tab-results"
          hidden={activeTab !== 'results'}
        >
          <ResultsPanel />
        </div>
        <div
          id="right-panel-comparison"
          role="tabpanel"
          aria-labelledby="tab-comparison"
          hidden={activeTab !== 'comparison'}
        >
          {activeTab === 'comparison' && (
            <Suspense
              fallback={
                <div className="flex h-32 items-center justify-center text-ui-sm text-white/40">
                  Loading...
                </div>
              }
            >
              <ComparisonPanel />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

type MobileTab = 'model' | 'viewer' | 'inspect';

const MOBILE_TABS: { value: MobileTab; label: string }[] = [
  { value: 'model', label: 'Model' },
  { value: 'viewer', label: '3D View' },
  { value: 'inspect', label: 'Inspect' },
];

function MobileLayout() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('viewer');
  const analysisStatus = useAnalysisStore((s) => s.status);

  useEffect(() => {
    if (analysisStatus === 'complete') setMobileTab('inspect');
  }, [analysisStatus]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden md:hidden">
      <div
        role="tablist"
        aria-label="Mobile navigation"
        className="flex border-b border-white/[0.06] bg-surface-1"
      >
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab.value}
            aria-controls={`mobile-panel-${tab.value}`}
            onClick={() => setMobileTab(tab.value)}
            className={`relative flex-1 px-3 py-2 text-[11px] font-semibold transition-colors duration-150 ${
              mobileTab === tab.value ? 'text-yellow-400' : 'text-white/30 hover:text-white/50'
            }`}
          >
            {tab.label}
            {mobileTab === tab.value && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400" />
            )}
          </button>
        ))}
      </div>
      <div
        id="mobile-panel-model"
        role="tabpanel"
        aria-labelledby="tab-model"
        hidden={mobileTab !== 'model'}
        className="flex-1 overflow-y-auto"
      >
        <LeftPanel />
      </div>
      <div
        id="mobile-panel-viewer"
        role="tabpanel"
        aria-labelledby="tab-viewer"
        hidden={mobileTab !== 'viewer'}
        className="flex-1"
      >
        <div className="h-full w-full">
          <Viewer3D />
        </div>
      </div>
      <div
        id="mobile-panel-inspect"
        role="tabpanel"
        aria-labelledby="tab-inspect"
        hidden={mobileTab !== 'inspect'}
        className="flex-1 overflow-y-auto"
      >
        <RightPanel />
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-0">
      <a
        href="#viewer-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-yellow-500 focus:px-3 focus:py-1.5 focus:text-[11px] focus:font-semibold focus:text-surface-0"
      >
        Skip to 3D Viewer
      </a>

      <header>
        <Toolbar />
      </header>

      <main className="hidden flex-1 overflow-hidden md:block">
        <PanelGroup direction="horizontal" autoSaveId="isovis-layout">
          <Panel defaultSize={20} minSize={15} maxSize={35} id="left-panel" order={1}>
            <nav aria-label="Model tree" className="h-full">
              <LeftPanel />
            </nav>
          </Panel>

          <ResizeHandle />

          <Panel id="viewer-panel" order={2} defaultSize={60} minSize={30}>
            <div className="h-full w-full" role="region" aria-label="3D Viewer">
              <Viewer3D />
            </div>
          </Panel>

          <ResizeHandle />

          <Panel defaultSize={20} minSize={15} maxSize={35} id="right-panel" order={3}>
            <aside aria-label="Inspector" className="h-full">
              <RightPanel />
            </aside>
          </Panel>
        </PanelGroup>
      </main>
      <MobileLayout />

      <footer>
        <StatusBar />
      </footer>
    </div>
  );
}
