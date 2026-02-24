import {
  useDisplayStore,
  type DisplayMode,
  type EnvironmentPreset,
  type ForceType,
  type ColorMapType,
} from '../../stores/displayStore';

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreset; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'dark', label: 'Dark' },
  { value: 'blueprint', label: 'Blueprint' },
];

const DISPLAY_MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'extruded', label: 'Extruded' },
  { value: 'solid', label: 'Solid' },
];

const FORCE_TYPE_OPTIONS: { value: ForceType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'moment', label: 'Moment' },
  { value: 'shear', label: 'Shear' },
  { value: 'axial', label: 'Axial' },
];

const COLOR_MAP_OPTIONS: { value: ColorMapType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'demandCapacity', label: 'D/C Ratio' },
  { value: 'displacement', label: 'Displacement' },
  { value: 'stress', label: 'Stress' },
];

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-700/60" />;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 rounded-full transition-colors ${
          checked ? 'bg-yellow-600' : 'bg-gray-700'
        }`}
      >
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (v: number) => string;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer accent-yellow-500"
        />
        <span className="w-10 text-right text-xs text-gray-500">
          {formatValue ? formatValue(value) : String(value)}
        </span>
      </div>
    </label>
  );
}

export function ViewerControls() {
  const environment = useDisplayStore((state) => state.environment);
  const setEnvironment = useDisplayStore((state) => state.setEnvironment);

  const displayMode = useDisplayStore((state) => state.displayMode);
  const showGrid = useDisplayStore((state) => state.showGrid);
  const showAxes = useDisplayStore((state) => state.showAxes);
  const showLabels = useDisplayStore((state) => state.showLabels);
  const showMassLabels = useDisplayStore((state) => state.showMassLabels);
  const showStiffnessLabels = useDisplayStore((state) => state.showStiffnessLabels);

  const setDisplayMode = useDisplayStore((state) => state.setDisplayMode);
  const setShowGrid = useDisplayStore((state) => state.setShowGrid);
  const setShowAxes = useDisplayStore((state) => state.setShowAxes);
  const setShowLabels = useDisplayStore((state) => state.setShowLabels);
  const setShowMassLabels = useDisplayStore((state) => state.setShowMassLabels);
  const setShowStiffnessLabels = useDisplayStore((state) => state.setShowStiffnessLabels);

  const showDeformed = useDisplayStore((state) => state.showDeformed);
  const scaleFactor = useDisplayStore((state) => state.scaleFactor);
  const setShowDeformed = useDisplayStore((state) => state.setShowDeformed);
  const setScaleFactor = useDisplayStore((state) => state.setScaleFactor);

  const showForces = useDisplayStore((state) => state.showForces);
  const forceType = useDisplayStore((state) => state.forceType);
  const forceScale = useDisplayStore((state) => state.forceScale);
  const colorMap = useDisplayStore((state) => state.colorMap);
  const showBearingDisplacement = useDisplayStore((state) => state.showBearingDisplacement);
  const showComparisonOverlay = useDisplayStore((state) => state.showComparisonOverlay);

  const setShowForces = useDisplayStore((state) => state.setShowForces);
  const setForceType = useDisplayStore((state) => state.setForceType);
  const setForceScale = useDisplayStore((state) => state.setForceScale);
  const setColorMap = useDisplayStore((state) => state.setColorMap);
  const setShowBearingDisplacement = useDisplayStore((state) => state.setShowBearingDisplacement);
  const setShowComparisonOverlay = useDisplayStore((state) => state.setShowComparisonOverlay);

  return (
    <div className="space-y-3">
      {/* Scene: environment is the outermost context — comes first */}
      <ControlSection title="Scene">
        <SelectControl
          label="Environment"
          value={environment}
          options={ENVIRONMENT_OPTIONS}
          onChange={setEnvironment}
        />
      </ControlSection>

      <Divider />

      {/* Display: geometry representation + viewport helpers */}
      <ControlSection title="Display">
        <SelectControl
          label="Mode"
          value={displayMode}
          options={DISPLAY_MODE_OPTIONS}
          onChange={setDisplayMode}
        />
        <Toggle label="Grid" checked={showGrid} onChange={setShowGrid} />
        <Toggle label="Axes" checked={showAxes} onChange={setShowAxes} />
        <Toggle label="Node / Element Labels" checked={showLabels} onChange={setShowLabels} />
      </ControlSection>

      <Divider />

      {/* Element Properties: annotation overlays tied to the undeformed model */}
      <ControlSection title="Element Properties">
        <Toggle label="Mass Labels" checked={showMassLabels} onChange={setShowMassLabels} />
        <Toggle
          label="Stiffness Labels"
          checked={showStiffnessLabels}
          onChange={setShowStiffnessLabels}
        />
      </ControlSection>

      <Divider />

      {/* Deformation: result-dependent — deformed shape + scale */}
      <ControlSection title="Deformation">
        <Toggle label="Show Deformed Shape" checked={showDeformed} onChange={setShowDeformed} />
        <SliderControl
          label="Scale Factor"
          min={1}
          max={1000}
          value={scaleFactor}
          onChange={setScaleFactor}
          formatValue={(v) => String(v)}
        />
      </ControlSection>

      <Divider />

      {/* Results: all post-processing overlays grouped together */}
      <ControlSection title="Results">
        <Toggle label="Force Diagrams" checked={showForces} onChange={setShowForces} />
        <SelectControl
          label="Force Type"
          value={forceType}
          options={FORCE_TYPE_OPTIONS}
          onChange={setForceType}
        />
        <SliderControl
          label="Force Scale"
          min={0.1}
          max={4}
          step={0.1}
          value={forceScale}
          onChange={setForceScale}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />
        <SelectControl
          label="Color Map"
          value={colorMap}
          options={COLOR_MAP_OPTIONS}
          onChange={setColorMap}
        />
        <Toggle
          label="Bearing Displacement"
          checked={showBearingDisplacement}
          onChange={setShowBearingDisplacement}
        />
        <Toggle
          label="Comparison Overlay"
          checked={showComparisonOverlay}
          onChange={setShowComparisonOverlay}
        />
      </ControlSection>
    </div>
  );
}
