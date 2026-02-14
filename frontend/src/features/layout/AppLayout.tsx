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
    <PanelResizeHandle className="flex w-1.5 items-center justify-center bg-gray-800 transition-colors hover:bg-yellow-600">
      <div className="h-8 w-0.5 rounded-full bg-gray-600" />
    </PanelResizeHandle>
  );
}

function LeftPanel() {
  return (
    <div className="flex h-full flex-col bg-gray-900">
      <div className="border-b border-gray-700 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-300">Model Tree</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ModelEditor />
      </div>
      <div className="border-t border-gray-700 p-3">
        <ViewerControls />
      </div>
    </div>
  );
}

type RightTab = 'properties' | 'results' | 'comparison';

function RightPanel() {
  const [activeTab, setActiveTab] = useState<RightTab>('properties');

  return (
    <div className="flex h-full flex-col bg-gray-900">
      <div className="flex items-center border-b border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('properties')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'properties'
              ? 'border-b-2 border-yellow-500 text-gray-200'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Properties
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'results'
              ? 'border-b-2 border-yellow-500 text-gray-200'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Results
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('comparison')}
          className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'comparison'
              ? 'border-b-2 border-yellow-500 text-gray-200'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Compare
        </button>
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-950">
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
            <div className="h-full w-full bg-gray-950">
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
