/**
 * Industry-grade playback transport controls with custom scrubber,
 * keyboard shortcuts, loop toggle, and frame-accurate stepping.
 *
 * Shared by both the Results panel and Comparison panel.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';

// ── Props ─────────────────────────────────────────────────────────────

interface PlaybackControlsProps {
  totalSteps: number;
  dt: number;
  /** Optional: total duration override (defaults to totalSteps * dt). */
  totalTime?: number;
  /** Optional: actual time values per step for display accuracy. */
  timeAtStep?: (step: number) => number;
}

// ── Speed options ─────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

// ── SVG icon components ───────────────────────────────────────────────

function SkipBackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="3" width="2" height="10" rx="0.5" />
      <path d="M13 3.5v9a.5.5 0 0 1-.78.42l-6.5-4.5a.5.5 0 0 1 0-.84l6.5-4.5A.5.5 0 0 1 13 3.5z" />
    </svg>
  );
}

function StepBackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12 3.5v9a.5.5 0 0 1-.78.42l-7-4.5a.5.5 0 0 1 0-.84l7-4.5A.5.5 0 0 1 12 3.5z" />
      <rect x="3" y="3" width="1.5" height="10" rx="0.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11a.5.5 0 0 0 .77.42l9-5.5a.5.5 0 0 0 0-.84l-9-5.5A.5.5 0 0 0 4 2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  );
}

function StepForwardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 3.5v9a.5.5 0 0 0 .78.42l7-4.5a.5.5 0 0 0 0-.84l-7-4.5A.5.5 0 0 0 4 3.5z" />
      <rect x="11.5" y="3" width="1.5" height="10" rx="0.5" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3.5v9a.5.5 0 0 0 .78.42l6.5-4.5a.5.5 0 0 0 0-.84l-6.5-4.5A.5.5 0 0 0 3 3.5z" />
      <rect x="12" y="3" width="2" height="10" rx="0.5" />
    </svg>
  );
}

function LoopIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke={active ? '#eab308' : '#6b7280'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 1l3 3-3 3" />
      <path d="M14 4H5a3 3 0 0 0-3 3" />
      <path d="M5 15l-3-3 3-3" />
      <path d="M2 12h9a3 3 0 0 0 3-3" />
    </svg>
  );
}

// ── Transport button ──────────────────────────────────────────────────

function TransportButton({
  onClick,
  title,
  children,
  primary,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center rounded transition-colors disabled:opacity-30 ${
        primary
          ? 'h-7 w-7 bg-yellow-600 text-white hover:bg-yellow-500 active:bg-yellow-700'
          : 'h-6 w-6 text-gray-400 hover:bg-gray-700 hover:text-gray-200 active:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// ── Custom scrubber ───────────────────────────────────────────────────

function Scrubber({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const progress = max > 0 ? value / max : 0;

  const computeStep = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || max <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * max);
    },
    [max],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange(computeStep(e.clientX));
    },
    [computeStep, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      onChange(computeStep(e.clientX));
    },
    [computeStep, onChange],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={trackRef}
      className="group relative flex h-5 cursor-pointer items-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Track background */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-700 transition-all group-hover:h-2" />

      {/* Filled portion */}
      <div
        className="absolute left-0 h-1.5 rounded-full bg-yellow-500 transition-all group-hover:h-2"
        style={{ width: `${progress * 100}%` }}
      />

      {/* Thumb */}
      <div
        className="absolute -ml-1.5 h-3 w-3 rounded-full border-2 border-yellow-500 bg-gray-900 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ left: `${progress * 100}%` }}
      />
    </div>
  );
}

// ── Time formatter ────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 0) return '0.00';
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }
  return seconds.toFixed(2);
}

// ── Main component ────────────────────────────────────────────────────

export function PlaybackControls({
  totalSteps,
  dt,
  totalTime: totalTimeOverride,
  timeAtStep,
}: PlaybackControlsProps) {
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const isPlaying = useAnalysisStore((s) => s.isPlaying);
  const playbackSpeed = useAnalysisStore((s) => s.playbackSpeed);
  const loopPlayback = useAnalysisStore((s) => s.loopPlayback);
  const setTimeStep = useAnalysisStore((s) => s.setTimeStep);
  const togglePlayback = useAnalysisStore((s) => s.togglePlayback);
  const setPlaybackSpeed = useAnalysisStore((s) => s.setPlaybackSpeed);
  const setIsPlaying = useAnalysisStore((s) => s.setIsPlaying);
  const setLoopPlayback = useAnalysisStore((s) => s.setLoopPlayback);

  const containerRef = useRef<HTMLDivElement>(null);

  const maxStep = totalSteps > 0 ? totalSteps - 1 : 0;
  const currentTime = timeAtStep ? timeAtStep(currentTimeStep) : currentTimeStep * dt;
  const totalTime = totalTimeOverride ?? maxStep * dt;

  // ── Transport actions ───────────────────────────────────────────────

  const skipToStart = useCallback(() => {
    setIsPlaying(false);
    setTimeStep(0);
  }, [setIsPlaying, setTimeStep]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setTimeStep(Math.max(0, currentTimeStep - 1));
  }, [currentTimeStep, setIsPlaying, setTimeStep]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setTimeStep(Math.min(maxStep, currentTimeStep + 1));
  }, [currentTimeStep, maxStep, setIsPlaying, setTimeStep]);

  const skipToEnd = useCallback(() => {
    setIsPlaying(false);
    setTimeStep(maxStep);
  }, [maxStep, setIsPlaying, setTimeStep]);

  const handlePlay = useCallback(() => {
    // If at end and pressing play, restart from beginning
    if (!isPlaying && currentTimeStep >= maxStep) {
      setTimeStep(0);
    }
    togglePlayback();
  }, [isPlaying, currentTimeStep, maxStep, setTimeStep, togglePlayback]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond when not typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            // Jump back 10 steps
            setIsPlaying(false);
            setTimeStep(Math.max(0, currentTimeStep - 10));
          } else {
            stepBack();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Jump forward 10 steps
            setIsPlaying(false);
            setTimeStep(Math.min(maxStep, currentTimeStep + 10));
          } else {
            stepForward();
          }
          break;
        case 'Home':
          e.preventDefault();
          skipToStart();
          break;
        case 'End':
          e.preventDefault();
          skipToEnd();
          break;
        case 'l':
        case 'L':
          setLoopPlayback(!loopPlayback);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlay,
    stepBack,
    stepForward,
    skipToStart,
    skipToEnd,
    currentTimeStep,
    maxStep,
    loopPlayback,
    setIsPlaying,
    setTimeStep,
    setLoopPlayback,
  ]);

  // ── Scrubber change ─────────────────────────────────────────────────

  const handleScrub = useCallback(
    (step: number) => {
      setTimeStep(step);
    },
    [setTimeStep],
  );

  return (
    <div
      ref={containerRef}
      className="select-none rounded-lg bg-gray-800/70 p-2.5 ring-1 ring-gray-700/50"
    >
      {/* Row 1: Transport controls + time display */}
      <div className="flex items-center gap-1">
        {/* Transport buttons */}
        <TransportButton onClick={skipToStart} title="Skip to start (Home)">
          <SkipBackIcon />
        </TransportButton>

        <TransportButton onClick={stepBack} title="Step back (Left)">
          <StepBackIcon />
        </TransportButton>

        <TransportButton onClick={handlePlay} title="Play / Pause (Space)" primary>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </TransportButton>

        <TransportButton onClick={stepForward} title="Step forward (Right)">
          <StepForwardIcon />
        </TransportButton>

        <TransportButton onClick={skipToEnd} title="Skip to end (End)">
          <SkipForwardIcon />
        </TransportButton>

        {/* Loop toggle */}
        <TransportButton
          onClick={() => setLoopPlayback(!loopPlayback)}
          title={`Loop: ${loopPlayback ? 'ON' : 'OFF'} (L)`}
        >
          <LoopIcon active={loopPlayback} />
        </TransportButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Time display */}
        <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-gray-400">
          {formatTime(currentTime)}
          <span className="text-gray-600"> / </span>
          {formatTime(totalTime)}
        </span>
      </div>

      {/* Row 2: Scrubber timeline */}
      <div className="mt-1">
        <Scrubber value={currentTimeStep} max={maxStep} onChange={handleScrub} />
      </div>

      {/* Row 3: Speed pills + step counter */}
      <div className="mt-1 flex items-center justify-between">
        <div className="flex gap-0.5">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPlaybackSpeed(speed)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                playbackSpeed === speed
                  ? 'bg-yellow-600 text-white shadow-sm shadow-yellow-600/30'
                  : 'bg-gray-700/80 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <span className="text-[9px] tabular-nums text-gray-600">
          {currentTimeStep} / {maxStep}
        </span>
      </div>
    </div>
  );
}
