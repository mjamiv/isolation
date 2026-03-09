import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useShallow } from 'zustand/react/shallow';
import {
  useDisplayStore,
  type DisplayMode,
  type ForceType,
  type ColorMapType,
} from '../../stores/displayStore';

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
        <Accordion.Trigger className="group flex w-full items-center gap-2 bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-3">
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-white/40 transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-yellow-500/60" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
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
      <span className="text-[10px] text-white/60">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
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
      <span className="text-[10px] text-white/60">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="rounded border border-white/[0.06] bg-surface-3 px-1.5 py-0.5 text-[10px] text-white/80 outline-none transition-colors duration-150 focus:border-yellow-500/50 focus:ring-0"
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
      <span className="text-[10px] text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-4 w-16 cursor-pointer"
          style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
        />
        <span className="w-9 text-right font-mono text-[9px] text-white/45">
          {formatValue ? formatValue(value) : String(value)}
        </span>
      </div>
    </label>
  );
}

export function ViewerControls() {
  const display = useDisplayStore(
    useShallow((s) => ({
      displayMode: s.displayMode,
      showGrid: s.showGrid,
      showAxes: s.showAxes,
      showLabels: s.showLabels,
      showMassLabels: s.showMassLabels,
      showStiffnessLabels: s.showStiffnessLabels,
      showDiaphragms: s.showDiaphragms,
      showConstraintLinks: s.showConstraintLinks,
      showDeformed: s.showDeformed,
      hideUndeformed: s.hideUndeformed,
      scaleFactor: s.scaleFactor,
      showForces: s.showForces,
      forceType: s.forceType,
      forceScale: s.forceScale,
      colorMap: s.colorMap,
      showBearingDisplacement: s.showBearingDisplacement,
      bearingVerticalScale: s.bearingVerticalScale,
      showBaseShearLabels: s.showBaseShearLabels,
      showComparisonOverlay: s.showComparisonOverlay,
    })),
  );
  const setters = useDisplayStore(
    useShallow((s) => ({
      setDisplayMode: s.setDisplayMode,
      setShowGrid: s.setShowGrid,
      setShowAxes: s.setShowAxes,
      setShowLabels: s.setShowLabels,
      setShowMassLabels: s.setShowMassLabels,
      setShowStiffnessLabels: s.setShowStiffnessLabels,
      setShowDiaphragms: s.setShowDiaphragms,
      setShowConstraintLinks: s.setShowConstraintLinks,
      setShowDeformed: s.setShowDeformed,
      setHideUndeformed: s.setHideUndeformed,
      setScaleFactor: s.setScaleFactor,
      setShowForces: s.setShowForces,
      setForceType: s.setForceType,
      setForceScale: s.setForceScale,
      setColorMap: s.setColorMap,
      setShowBearingDisplacement: s.setShowBearingDisplacement,
      setBearingVerticalScale: s.setBearingVerticalScale,
      setShowBaseShearLabels: s.setShowBaseShearLabels,
      setShowComparisonOverlay: s.setShowComparisonOverlay,
    })),
  );

  return (
    <Accordion.Root type="multiple" defaultValue={['display']} className="space-y-1">
      <ControlSection value="display" title="Display">
        <SelectControl
          label="Mode"
          value={display.displayMode}
          options={DISPLAY_MODE_OPTIONS}
          onChange={setters.setDisplayMode}
        />
        <Toggle label="Grid" checked={display.showGrid} onChange={setters.setShowGrid} />
        <Toggle label="Axes" checked={display.showAxes} onChange={setters.setShowAxes} />
        <Toggle
          label="Diaphragms"
          checked={display.showDiaphragms}
          onChange={setters.setShowDiaphragms}
        />
        <Toggle
          label="Constraint Links"
          checked={display.showConstraintLinks}
          onChange={setters.setShowConstraintLinks}
        />
        <Toggle
          label="Node / Element Labels"
          checked={display.showLabels}
          onChange={setters.setShowLabels}
        />
      </ControlSection>

      <ControlSection value="element-properties" title="Element Properties">
        <Toggle
          label="Mass Labels"
          checked={display.showMassLabels}
          onChange={setters.setShowMassLabels}
        />
        <Toggle
          label="Stiffness Labels"
          checked={display.showStiffnessLabels}
          onChange={setters.setShowStiffnessLabels}
        />
      </ControlSection>

      <ControlSection value="deformation" title="Deformation">
        <Toggle
          label="Show Deformed Shape"
          checked={display.showDeformed}
          onChange={setters.setShowDeformed}
        />
        <Toggle
          label="Deformed Only"
          checked={display.hideUndeformed}
          onChange={setters.setHideUndeformed}
        />
        <SliderControl
          label="Scale Factor"
          min={1}
          max={1000}
          value={display.scaleFactor}
          onChange={setters.setScaleFactor}
        />
      </ControlSection>

      <ControlSection value="results" title="Results">
        <Toggle
          label="Force Diagrams"
          checked={display.showForces}
          onChange={setters.setShowForces}
        />
        <SelectControl
          label="Force Type"
          value={display.forceType}
          options={FORCE_TYPE_OPTIONS}
          onChange={setters.setForceType}
        />
        <SliderControl
          label="Force Scale"
          min={0.1}
          max={4}
          step={0.1}
          value={display.forceScale}
          onChange={setters.setForceScale}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />
        <SelectControl
          label="Color Map"
          value={display.colorMap}
          options={COLOR_MAP_OPTIONS}
          onChange={setters.setColorMap}
        />
        <Toggle
          label="Base Shear Arrows"
          checked={display.showBaseShearLabels}
          onChange={setters.setShowBaseShearLabels}
        />
        <Toggle
          label="Bearing Displacement"
          checked={display.showBearingDisplacement}
          onChange={setters.setShowBearingDisplacement}
        />
        <SliderControl
          label="Bearing Vert Scale"
          min={0.5}
          max={3}
          step={0.1}
          value={display.bearingVerticalScale}
          onChange={setters.setBearingVerticalScale}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />
        <Toggle
          label="Comparison Overlay"
          checked={display.showComparisonOverlay}
          onChange={setters.setShowComparisonOverlay}
        />
      </ControlSection>
    </Accordion.Root>
  );
}
