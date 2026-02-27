import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Viewer3D } from '../viewer-3d/Viewer3D';
import { ViewerControls } from '../controls/ViewerControls';
import { ModelEditor } from '../model-editor/ModelEditor';
import { PropertyInspector } from '../property-inspector/PropertyInspector';
import { ResultsPanel } from '../results/ResultsPanel';
import { ComparisonPanel } from '../comparison/ComparisonPanel';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';

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
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
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

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="relative flex items-center border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`relative flex-1 px-3 py-2.5 text-[11px] font-semibold transition-colors duration-150 ${
              activeTab === tab.value ? 'text-yellow-400' : 'text-white/30 hover:text-white/50'
            }`}
          >
            {tab.label}
            {activeTab === tab.value && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400" />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'results' && <ResultsPanel />}
        {activeTab === 'comparison' && <ComparisonPanel />}
        {activeTab === 'properties' && <PropertyInspector />}
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-0">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main 3-panel layout */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="isovis-layout">
          {/* Left panel: Model tree & controls */}
          <Panel defaultSize={20} minSize={15} maxSize={35}>
            <LeftPanel />
          </Panel>

          <ResizeHandle />

          {/* Center panel: 3D Viewer */}
          <Panel defaultSize={60} minSize={30}>
            <div className="h-full w-full bg-surface-0">
              <Viewer3D />
            </div>
          </Panel>

          <ResizeHandle />

          {/* Right panel: Properties / Results / Comparison */}
          <Panel defaultSize={20} minSize={15} maxSize={35}>
            <RightPanel />
          </Panel>
        </PanelGroup>
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  );
}
