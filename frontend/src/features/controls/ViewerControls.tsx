import { useDisplayStore, type DisplayMode, type ForceType, type ColorMapType } from '../../stores/displayStore';

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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      {children}
    </div>
  );
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
          checked ? 'bg-blue-600' : 'bg-gray-700'
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
        className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
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

export function ViewerControls() {
  const displayMode = useDisplayStore((state) => state.displayMode);
  const showDeformed = useDisplayStore((state) => state.showDeformed);
  const scaleFactor = useDisplayStore((state) => state.scaleFactor);
  const showLabels = useDisplayStore((state) => state.showLabels);
  const showGrid = useDisplayStore((state) => state.showGrid);
  const showAxes = useDisplayStore((state) => state.showAxes);
  const forceType = useDisplayStore((state) => state.forceType);
  const colorMap = useDisplayStore((state) => state.colorMap);

  const setDisplayMode = useDisplayStore((state) => state.setDisplayMode);
  const setShowDeformed = useDisplayStore((state) => state.setShowDeformed);
  const setScaleFactor = useDisplayStore((state) => state.setScaleFactor);
  const setShowLabels = useDisplayStore((state) => state.setShowLabels);
  const setShowGrid = useDisplayStore((state) => state.setShowGrid);
  const setShowAxes = useDisplayStore((state) => state.setShowAxes);
  const setForceType = useDisplayStore((state) => state.setForceType);
  const setColorMap = useDisplayStore((state) => state.setColorMap);

  return (
    <div className="space-y-3">
      <ControlSection title="Display">
        <SelectControl
          label="Mode"
          value={displayMode}
          options={DISPLAY_MODE_OPTIONS}
          onChange={setDisplayMode}
        />
        <Toggle label="Show Grid" checked={showGrid} onChange={setShowGrid} />
        <Toggle label="Show Axes" checked={showAxes} onChange={setShowAxes} />
        <Toggle label="Show Labels" checked={showLabels} onChange={setShowLabels} />
      </ControlSection>

      <ControlSection title="Deformation">
        <Toggle
          label="Show Deformed"
          checked={showDeformed}
          onChange={setShowDeformed}
        />
        <label className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Scale Factor</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={1000}
              value={scaleFactor}
              onChange={(e) => setScaleFactor(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-blue-500"
            />
            <span className="w-8 text-right text-xs text-gray-500">
              {scaleFactor}
            </span>
          </div>
        </label>
      </ControlSection>

      <ControlSection title="Results">
        <SelectControl
          label="Forces"
          value={forceType}
          options={FORCE_TYPE_OPTIONS}
          onChange={setForceType}
        />
        <SelectControl
          label="Color Map"
          value={colorMap}
          options={COLOR_MAP_OPTIONS}
          onChange={setColorMap}
        />
      </ControlSection>
    </div>
  );
}
