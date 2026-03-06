import { useDisplayStore, type CameraViewPreset, type DisplayMode } from '@/stores/displayStore';

const VIEWS: { value: CameraViewPreset; label: string }[] = [
  { value: 'iso', label: 'Iso' },
  { value: 'plan', label: 'Plan' },
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
];

const MODES: { value: DisplayMode; label: string }[] = [
  { value: 'wireframe', label: 'Wire' },
  { value: 'solid', label: 'Solid' },
  { value: 'extruded', label: 'Ext' },
];

export function ViewerHud() {
  const cameraView = useDisplayStore((s) => s.cameraView);
  const setCameraView = useDisplayStore((s) => s.setCameraView);
  const frameCamera = useDisplayStore((s) => s.frameCamera);
  const displayMode = useDisplayStore((s) => s.displayMode);
  const setDisplayMode = useDisplayStore((s) => s.setDisplayMode);
  const showGrid = useDisplayStore((s) => s.showGrid);
  const setShowGrid = useDisplayStore((s) => s.setShowGrid);
  const showLabels = useDisplayStore((s) => s.showLabels);
  const setShowLabels = useDisplayStore((s) => s.setShowLabels);

  return (
    <div className="viewer-hud-bar">
      {/* Camera presets */}
      <div className="viewer-hud-group">
        <button className="viewer-hud-btn" onClick={frameCamera}>
          Fit
        </button>
        <span className="viewer-hud-sep" />
        {VIEWS.map((v) => (
          <button
            key={v.value}
            className="viewer-hud-btn"
            data-active={cameraView === v.value}
            onClick={() => setCameraView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Display mode */}
      <div className="viewer-hud-group">
        {MODES.map((m) => (
          <button
            key={m.value}
            className="viewer-hud-btn"
            data-active={displayMode === m.value}
            onClick={() => setDisplayMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Layer toggles */}
      <div className="viewer-hud-group">
        <button
          className="viewer-hud-btn"
          data-active={showGrid}
          onClick={() => setShowGrid(!showGrid)}
        >
          Grid
        </button>
        <button
          className="viewer-hud-btn"
          data-active={showLabels}
          onClick={() => setShowLabels(!showLabels)}
        >
          Labels
        </button>
      </div>
    </div>
  );
}
