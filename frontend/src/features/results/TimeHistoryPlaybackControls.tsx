import { useAnalysisStore } from '@/stores/analysisStore';

interface TimeHistoryPlaybackControlsProps {
  totalSteps: number;
  dt: number;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export function TimeHistoryPlaybackControls({ totalSteps, dt }: TimeHistoryPlaybackControlsProps) {
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const isPlaying = useAnalysisStore((s) => s.isPlaying);
  const playbackSpeed = useAnalysisStore((s) => s.playbackSpeed);
  const setTimeStep = useAnalysisStore((s) => s.setTimeStep);
  const togglePlayback = useAnalysisStore((s) => s.togglePlayback);
  const setPlaybackSpeed = useAnalysisStore((s) => s.setPlaybackSpeed);
  const setIsPlaying = useAnalysisStore((s) => s.setIsPlaying);

  const maxStep = totalSteps > 0 ? totalSteps - 1 : 0;
  const currentTime = currentTimeStep * dt;

  const handleReset = () => {
    setIsPlaying(false);
    setTimeStep(0);
  };

  return (
    <div className="flex items-center gap-2 rounded bg-gray-800/50 px-2 py-1.5">
      {/* Play/Pause */}
      <button
        type="button"
        onClick={togglePlayback}
        className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-300 transition-colors hover:bg-gray-600"
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={handleReset}
        className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-300 transition-colors hover:bg-gray-600"
      >
        Reset
      </button>

      {/* Speed selector */}
      <select
        value={playbackSpeed}
        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
        className="rounded bg-gray-700 px-1 py-0.5 text-[10px] text-gray-300 outline-none"
      >
        {SPEED_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      {/* Time scrub slider */}
      <input
        type="range"
        min={0}
        max={maxStep}
        value={currentTimeStep}
        onChange={(e) => setTimeStep(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-gray-600 accent-yellow-500"
      />

      {/* Time display */}
      <span className="whitespace-nowrap font-mono text-[10px] text-gray-400">
        {currentTimeStep}/{maxStep} ({currentTime.toFixed(2)}s)
      </span>
    </div>
  );
}
