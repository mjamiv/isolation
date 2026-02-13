import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { Viewer3D } from '../viewer-3d/Viewer3D';
import { ViewerControls } from '../controls/ViewerControls';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';

function ResizeHandle() {
  return (
    <PanelResizeHandle className="flex w-1.5 items-center justify-center bg-gray-800 transition-colors hover:bg-blue-600">
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
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2 text-xs text-gray-500">
          <p>Model tree and property editor will appear here.</p>
          <p>
            Click <span className="text-blue-400">Load Sample Model</span> in
            the toolbar to load a 3-story steel frame.
          </p>
        </div>
      </div>
      <div className="border-t border-gray-700 p-3">
        <ViewerControls />
      </div>
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex h-full flex-col bg-gray-900">
      <div className="border-b border-gray-700 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-300">Results</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2 text-xs text-gray-500">
          <p>
            Charts and analysis results will be displayed here after running an
            analysis.
          </p>
          <p>
            Response spectra, hysteresis loops, and time history plots will be
            available.
          </p>
        </div>
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

          {/* Right panel: Results & charts */}
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
