import { Memo, PlaybackMode } from '../types';
import { 
  PlayIcon, PauseIcon, 
  RepeatIcon, RepeatOneIcon, SequentialIcon,
  Rewind15Icon, Forward15Icon,
  NextIcon, PrevIcon
} from './Icons';
import { formatDuration } from '../utils';

interface PlayerControlsProps {
  currentTrack: Memo | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRewind15: () => void;
  onForward15: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  mode: PlaybackMode;
  onToggleMode: () => void;
  playbackRate: number;
  onToggleSpeed: () => void;
}

const PlayerControls = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onRewind15,
  onForward15,
  currentTime,
  duration,
  onSeek,
  mode,
  onToggleMode,
  playbackRate,
  onToggleSpeed
}: PlayerControlsProps) => {
  const getModeIcon = () => {
    switch (mode) {
      case PlaybackMode.LOOP_ONE: return <RepeatOneIcon size={16} className="text-blue-500" />;
      case PlaybackMode.LOOP_ALL: return <RepeatIcon size={16} className="text-blue-500" />;
      default: return <SequentialIcon size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="w-full px-6">
      {/* Slider */}
      <div className="mb-3 w-full">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none accent-blue-500"
          disabled={!currentTrack}
        />
         <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-1 font-mono">
            <span>{formatDuration(currentTime)}</span>
            <span>-{formatDuration(duration - currentTime)}</span>
         </div>
      </div>

      {/* Buttons Row */}
      <div className="flex items-center justify-between">
          {/* Left: Speed & Mode */}
          <div className="flex items-center space-x-2 w-20">
             <button 
                onClick={onToggleSpeed}
                className="text-[10px] font-bold text-blue-500 bg-blue-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-blue-100"
             >
                {playbackRate}x
             </button>
             <button 
                onClick={onToggleMode}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
             >
                {getModeIcon()}
             </button>
          </div>

          {/* Center: Play Controls */}
          <div className="flex items-center space-x-4">
              <button onClick={onPrev} className="text-gray-800 hover:text-blue-600 transition-colors" disabled={!currentTrack}>
                  <PrevIcon size={24} />
              </button>
              <button onClick={onRewind15} className="text-gray-800 hover:text-blue-600 transition-colors" disabled={!currentTrack}>
                  <Rewind15Icon size={26} />
              </button>
              
              <button 
                onClick={onPlayPause}
                className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 hover:scale-105 transition-all active:scale-95"
                disabled={!currentTrack}
              >
                  {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} className="ml-1" />}
              </button>

              <button onClick={onForward15} className="text-gray-800 hover:text-blue-600 transition-colors" disabled={!currentTrack}>
                  <Forward15Icon size={26} />
              </button>
              <button onClick={onNext} className="text-gray-800 hover:text-blue-600 transition-colors" disabled={!currentTrack}>
                  <NextIcon size={24} />
              </button>
          </div>

          {/* Right: Spacer */}
          <div className="w-20 flex justify-end"></div>
      </div>
    </div>
  );
};

export default PlayerControls;