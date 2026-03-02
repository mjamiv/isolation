import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
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

function ControlSection({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="overflow-hidden rounded border border-white/[0.06]">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center gap-2 bg-surface-2 px-2.5 py-1.5 text-left">
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-white/35 transition-transform group-data-[state=open]:rotate-180" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
            {title}
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
        <div className="space-y-1.5 p-2">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
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
    <label className="flex cursor-pointer items-center justify-between py-0.5">
      <span className="text-[10px] text-white/55">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-track"
      >
        <div className="toggle-thumb" />
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
    <label className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/55">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-white/[0.06] bg-surface-3 px-1.5 py-0.5 text-[10px] text-white/70 outline-none transition-colors duration-150 focus:border-yellow-500/50 focus:ring-0"
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
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <label className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/55">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-4 w-16 cursor-pointer"
          style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
        />
        <span className="w-9 text-right font-mono text-[9px] text-white/35">
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
  const showDiaphragms = useDisplayStore((state) => state.showDiaphragms);
  const showConstraintLinks = useDisplayStore((state) => state.showConstraintLinks);

  const setDisplayMode = useDisplayStore((state) => state.setDisplayMode);
  const setShowGrid = useDisplayStore((state) => state.setShowGrid);
  const setShowAxes = useDisplayStore((state) => state.setShowAxes);
  const setShowLabels = useDisplayStore((state) => state.setShowLabels);
  const setShowMassLabels = useDisplayStore((state) => state.setShowMassLabels);
  const setShowStiffnessLabels = useDisplayStore((state) => state.setShowStiffnessLabels);
  const setShowDiaphragms = useDisplayStore((state) => state.setShowDiaphragms);
  const setShowConstraintLinks = useDisplayStore((state) => state.setShowConstraintLinks);

  const showDeformed = useDisplayStore((state) => state.showDeformed);
  const hideUndeformed = useDisplayStore((state) => state.hideUndeformed);
  const scaleFactor = useDisplayStore((state) => state.scaleFactor);
  const setShowDeformed = useDisplayStore((state) => state.setShowDeformed);
  const setHideUndeformed = useDisplayStore((state) => state.setHideUndeformed);
  const setScaleFactor = useDisplayStore((state) => state.setScaleFactor);

  const showForces = useDisplayStore((state) => state.showForces);
  const forceType = useDisplayStore((state) => state.forceType);
  const forceScale = useDisplayStore((state) => state.forceScale);
  const colorMap = useDisplayStore((state) => state.colorMap);
  const showBearingDisplacement = useDisplayStore((state) => state.showBearingDisplacement);
  const bearingVerticalScale = useDisplayStore((state) => state.bearingVerticalScale);
  const showBaseShearLabels = useDisplayStore((state) => state.showBaseShearLabels);
  const showComparisonOverlay = useDisplayStore((state) => state.showComparisonOverlay);

  const setShowBaseShearLabels = useDisplayStore((state) => state.setShowBaseShearLabels);
  const setShowForces = useDisplayStore((state) => state.setShowForces);
  const setForceType = useDisplayStore((state) => state.setForceType);
  const setForceScale = useDisplayStore((state) => state.setForceScale);
  const setColorMap = useDisplayStore((state) => state.setColorMap);
  const setShowBearingDisplacement = useDisplayStore((state) => state.setShowBearingDisplacement);
  const setBearingVerticalScale = useDisplayStore((state) => state.setBearingVerticalScale);
  const setShowComparisonOverlay = useDisplayStore((state) => state.setShowComparisonOverlay);

  return (
    <Accordion.Root type="multiple" defaultValue={[]} className="space-y-1">
      <ControlSection value="scene" title="Scene">
        <SelectControl
          label="Environment"
          value={environment}
          options={ENVIRONMENT_OPTIONS}
          onChange={setEnvironment}
        />
      </ControlSection>

      <ControlSection value="display" title="Display">
        <SelectControl
          label="Mode"
          value={displayMode}
          options={DISPLAY_MODE_OPTIONS}
          onChange={setDisplayMode}
        />
        <Toggle label="Grid" checked={showGrid} onChange={setShowGrid} />
        <Toggle label="Axes" checked={showAxes} onChange={setShowAxes} />
        <Toggle label="Diaphragms" checked={showDiaphragms} onChange={setShowDiaphragms} />
        <Toggle
          label="Constraint Links"
          checked={showConstraintLinks}
          onChange={setShowConstraintLinks}
        />
        <Toggle label="Node / Element Labels" checked={showLabels} onChange={setShowLabels} />
      </ControlSection>

      <ControlSection value="element-properties" title="Element Properties">
        <Toggle label="Mass Labels" checked={showMassLabels} onChange={setShowMassLabels} />
        <Toggle
          label="Stiffness Labels"
          checked={showStiffnessLabels}
          onChange={setShowStiffnessLabels}
        />
      </ControlSection>

      <ControlSection value="deformation" title="Deformation">
        <Toggle label="Show Deformed Shape" checked={showDeformed} onChange={setShowDeformed} />
        <Toggle label="Deformed Only" checked={hideUndeformed} onChange={setHideUndeformed} />
        <SliderControl
          label="Scale Factor"
          min={1}
          max={1000}
          value={scaleFactor}
          onChange={setScaleFactor}
          formatValue={(v) => String(v)}
        />
      </ControlSection>

      <ControlSection value="results" title="Results">
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
          label="Base Shear Arrows"
          checked={showBaseShearLabels}
          onChange={setShowBaseShearLabels}
        />
        <Toggle
          label="Bearing Displacement"
          checked={showBearingDisplacement}
          onChange={setShowBearingDisplacement}
        />
        <SliderControl
          label="Bearing Vert Scale"
          min={0.5}
          max={3}
          step={0.1}
          value={bearingVerticalScale}
          onChange={setBearingVerticalScale}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />
        <Toggle
          label="Comparison Overlay"
          checked={showComparisonOverlay}
          onChange={setShowComparisonOverlay}
        />
      </ControlSection>
    </Accordion.Root>
  );
}
