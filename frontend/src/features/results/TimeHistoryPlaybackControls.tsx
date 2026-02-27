import { PlaybackControls } from '@/features/playback/PlaybackControls';

interface TimeHistoryPlaybackControlsProps {
  totalSteps: number;
  dt: number;
}

export function TimeHistoryPlaybackControls({ totalSteps, dt }: TimeHistoryPlaybackControlsProps) {
  return <PlaybackControls totalSteps={totalSteps} dt={dt} />;
}
