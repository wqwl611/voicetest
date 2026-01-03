import { MouseEvent } from 'react';
import { Memo } from '../types';
import { PlayIcon, MusicIcon, TrashIcon } from './Icons';
import { formatDuration, formatDate } from '../utils';

interface TrackListProps {
  tracks: Memo[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelect: (track: Memo) => void;
  onRemove: (e: MouseEvent, id: string) => void;
}

const TrackList = ({ 
  tracks, 
  currentTrackId, 
  isPlaying, 
  onSelect,
  onRemove 
}: TrackListProps) => {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-8 text-center">
        <div className="mb-4 opacity-20"><MusicIcon size={48} /></div>
        <p className="text-sm">No recordings found</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 pb-40">
      {tracks.map((track) => {
        const isActive = track.id === currentTrackId;
        return (
          <li 
            key={track.id}
            onClick={() => onSelect(track)}
            className={`
              px-5 py-4 cursor-pointer transition-colors flex items-center justify-between group
              ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
            `}
          >
            <div className="flex-1 min-w-0 mr-4">
              <div className={`font-semibold text-base mb-1 truncate ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                {track.title}
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-500 font-medium">
                <span>{formatDate(track.createdAt)}</span>
                <span>{formatDuration(track.duration)}</span>
                {isActive && isPlaying && (
                    <span className="flex space-x-[2px] items-end h-3">
                      <span className="w-0.5 bg-blue-500 animate-[bounce_1s_infinite] h-2"></span>
                      <span className="w-0.5 bg-blue-500 animate-[bounce_1.2s_infinite] h-3"></span>
                      <span className="w-0.5 bg-blue-500 animate-[bounce_0.8s_infinite] h-2"></span>
                    </span>
                )}
              </div>
            </div>

            <button 
                onClick={(e) => onRemove(e, track.id)}
                className={`p-2 rounded-full transition-colors ${isActive ? 'text-blue-300 hover:text-red-500 hover:bg-blue-100' : 'text-gray-300 hover:text-red-500 hover:bg-gray-100'}`}
                aria-label="Delete"
              >
                <TrashIcon size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default TrackList;