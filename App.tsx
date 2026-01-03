import { useState, useRef, useEffect, useMemo, MouseEvent } from 'react';
import { Memo, PlaybackMode, PLAYBACK_SPEEDS, SortOption, SortDirection } from './types';
import { PlusIcon, FilterIcon, LoadingIcon } from './components/Icons';
import { Waveform } from './components/Waveform';
import TrackList from './components/TrackList';
import PlayerControls from './components/PlayerControls';
import FilterPanel from './components/FilterPanel';
import { formatDuration } from './utils';
import { initDB, saveMemoToDB, getMemosFromDB, deleteMemoFromDB } from './db';

export default function App() {
  // --- Loading State ---
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- Data State ---
  const [memos, setMemos] = useState<Memo[]>([]);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);

  // --- Filter & Sort State ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- View State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // --- Playback State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(PlaybackMode.LOOP_ALL);

  // --- Refs ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // --- Initialization ---
  useEffect(() => {
    const loadData = async () => {
      try {
        await initDB();
        const savedMemos = await getMemosFromDB();
        setMemos(savedMemos);
      } catch (e) {
        console.error("Failed to load memos from DB", e);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // --- Audio Event Listeners ---
  useEffect(() => {
    const audio = audioRef.current;
    
    const updateTime = () => setPlaybackTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => handlePlaybackEnded();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [memos, activeMemoId, playbackMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // --- Logic: Playback Control ---
  const handlePlaybackEnded = () => {
    if (playbackMode === PlaybackMode.LOOP_ONE) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      // Use filtered list for playback order
      const currentIndex = filteredMemos.findIndex(m => m.id === activeMemoId);
      if (currentIndex === -1) return;

      if (playbackMode === PlaybackMode.SEQUENTIAL) {
        if (currentIndex < filteredMemos.length - 1) {
          playMemo(filteredMemos[currentIndex + 1]);
        } else {
          setIsPlaying(false);
        }
      } else if (playbackMode === PlaybackMode.LOOP_ALL) {
        const nextIndex = (currentIndex + 1) % filteredMemos.length;
        playMemo(filteredMemos[nextIndex]);
      }
    }
  };

  const playMemo = (memo: Memo) => {
    if (activeMemoId === memo.id) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    } else {
      setActiveMemoId(memo.id);
      audioRef.current.src = memo.url;
      audioRef.current.load();
      audioRef.current.play().catch(e => console.error("Play failed", e));
    }
  };

  const skipTime = (seconds: number) => {
    const newTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
    audioRef.current.currentTime = newTime;
  };

  const handleSeek = (time: number) => {
    audioRef.current.currentTime = time;
    setPlaybackTime(time);
  };

  const togglePlaybackMode = () => {
    const modes = [PlaybackMode.LOOP_ALL, PlaybackMode.LOOP_ONE, PlaybackMode.SEQUENTIAL];
    const nextIndex = (modes.indexOf(playbackMode) + 1) % modes.length;
    setPlaybackMode(modes[nextIndex]);
  };

  const toggleSpeed = () => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackRate(next);
  };

  const deleteMemo = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        await deleteMemoFromDB(id);
        setMemos(prev => prev.filter(m => m.id !== id));
        if (activeMemoId === id) {
            setActiveMemoId(null);
            audioRef.current.pause();
            audioRef.current.src = '';
        }
    } catch (err) {
        console.error("Failed to delete", err);
    }
  };

  const updateTitle = async (id: string, newTitle: string) => {
    const memo = memos.find(m => m.id === id);
    if (!memo) return;
    
    const updatedMemo = { ...memo, title: newTitle };
    // Optimistic update
    setMemos(prev => prev.map(m => m.id === id ? updatedMemo : m));
    
    // Save to DB
    try {
        await saveMemoToDB(updatedMemo);
    } catch (err) {
        console.error("Failed to update title", err);
    }
  };

  // --- Logic: Recording ---
  
  // Helper to detect supported MIME type for iOS/Safari vs Others
  const getSupportedMimeType = () => {
    const types = [
      'audio/mp4',      // iOS Safari prefer this often
      'audio/webm;codecs=opus', 
      'audio/webm',     // Chrome/Firefox
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Let browser decide
  };

  const startRecording = async () => {
    setIsRecording(true);
    audioRef.current.pause();
    setIsPlaying(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Use the mime type determined at start, or fallback to webm if none was explicit (though audioChunks usually have type)
        // Note: iOS might produce audio/mp4 even if requested webm if strictly not supported, but usually isTypeSupported handles it.
        const finalType = mimeType || (audioChunksRef.current[0]?.type) || 'audio/webm';
        
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        const url = URL.createObjectURL(blob);
        const newMemo: Memo = {
          id: Date.now().toString(),
          title: `New Recording ${memos.length + 1}`,
          url, // This URL is ephemeral, used for immediate playback
          duration: recordingTime,
          createdAt: Date.now(),
          blob
        };

        // Save to DB first
        try {
            await saveMemoToDB(newMemo);
            setMemos(prev => [newMemo, ...prev]);
            
            // Auto-play
            setActiveMemoId(newMemo.id);
            audioRef.current.src = newMemo.url;
        } catch (err) {
            console.error("Failed to save recording", err);
            // Don't alert aggressively, maybe the user is in private mode where IDB is restricted
            alert("Could not save recording to storage. It will be lost on refresh. " + (err instanceof Error ? err.message : String(err)));
            // Still add to local list so they can hear it now
            setMemos(prev => [newMemo, ...prev]);
            setActiveMemoId(newMemo.id);
            audioRef.current.src = newMemo.url;
        }
        
        setRecordingTime(0);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      const startTime = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((Date.now() - startTime) / 1000);
      }, 100);

    } catch (err) {
      console.error("Mic error:", err);
      alert("Microphone access is required.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // --- Logic: Filtering & Sorting ---
  const filteredMemos = useMemo(() => {
    let result = [...memos];
    
    // Search
    if (searchQuery) {
      result = result.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Date Range
    if (startDate) {
      const start = new Date(startDate).setHours(0,0,0,0);
      result = result.filter(m => m.createdAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23,59,59,999);
      result = result.filter(m => m.createdAt <= end);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date': cmp = a.createdAt - b.createdAt; break;
        case 'name': cmp = a.title.localeCompare(b.title); break;
        case 'duration': cmp = a.duration - b.duration; break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [memos, searchQuery, sortBy, sortDirection, startDate, endDate]);

  const activeMemo = memos.find(m => m.id === activeMemoId);

  // --- Render ---
  
  if (!isDataLoaded) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center text-gray-400">
        <LoadingIcon size={32} />
        <span className="mt-4 text-xs font-medium tracking-wide">LOADING LIBRARY...</span>
      </div>
    );
  }

  // 1. Recording Overlay
  if (isRecording) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-between py-12 px-6 animate-in slide-in-from-bottom duration-300">
         <div className="w-full text-center">
            <h2 className="text-gray-400 font-medium tracking-wide text-sm uppercase">Recording</h2>
         </div>
         <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
            <div className="text-7xl font-light font-mono mb-12 tracking-tighter">
              {formatDuration(recordingTime)}
            </div>
            <div className="w-full h-32 mb-8">
               <Waveform isPlaying={false} isRecording={true} />
            </div>
            <div className="text-red-500 font-medium animate-pulse tracking-wider">REC</div>
         </div>
         <div className="w-full max-w-xs flex items-center justify-center">
            <button 
              onClick={stopRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-red-500 rounded-md" />
            </button>
         </div>
      </div>
    );
  }

  // 2. Main App
  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 overflow-hidden">
      
      {/* Header */}
      <div className="flex-none bg-[#fbfbfd] border-b border-gray-200 z-10">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight">Recordings</h1>
            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{filteredMemos.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`p-2 rounded-full transition-colors ${isFilterOpen ? 'text-blue-600 bg-blue-50' : 'text-blue-500 hover:bg-blue-50'}`}
            >
                <FilterIcon />
            </button>
            <button 
              onClick={startRecording}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors active:scale-95"
            >
               <PlusIcon size={26} />
            </button>
          </div>
        </div>

        {/* Filter Panel (Collapsible) */}
        {isFilterOpen && (
          <FilterPanel 
            isOpen={isFilterOpen}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={setSortBy}
            onDirectionToggle={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-white relative">
        <TrackList 
           tracks={filteredMemos}
           currentTrackId={activeMemoId}
           isPlaying={isPlaying}
           onSelect={playMemo}
           onRemove={deleteMemo}
        />
      </div>

      {/* Player Panel */}
      {activeMemo && (
        <div className="flex-none bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20 pb-safe">
            <div className="max-w-3xl mx-auto pt-4 pb-2">
                {/* Visuals & Title (Above controls) */}
                <div className="px-6 flex flex-col items-center mb-2">
                   <input 
                        value={activeMemo.title}
                        onChange={(e) => updateTitle(activeMemo.id, e.target.value)}
                        className="text-lg font-bold text-center w-full bg-transparent border-none focus:ring-0 focus:underline text-gray-900 mb-2 truncate"
                    />
                    <div className="w-full h-12 flex items-center justify-center opacity-60">
                        <Waveform isPlaying={isPlaying} isRecording={false} />
                    </div>
                </div>

                {/* Controls Component */}
                <PlayerControls 
                   currentTrack={activeMemo}
                   isPlaying={isPlaying}
                   currentTime={playbackTime}
                   duration={duration}
                   mode={playbackMode}
                   playbackRate={playbackRate}
                   onPlayPause={() => isPlaying ? audioRef.current.pause() : audioRef.current.play()}
                   onNext={() => {
                     const idx = filteredMemos.findIndex(m => m.id === activeMemo.id);
                     const next = filteredMemos[(idx + 1) % filteredMemos.length];
                     playMemo(next);
                   }}
                   onPrev={() => {
                     const idx = filteredMemos.findIndex(m => m.id === activeMemo.id);
                     const prev = filteredMemos[(idx - 1 + filteredMemos.length) % filteredMemos.length];
                     playMemo(prev);
                   }}
                   onRewind15={() => skipTime(-15)}
                   onForward15={() => skipTime(15)}
                   onSeek={handleSeek}
                   onToggleMode={togglePlaybackMode}
                   onToggleSpeed={toggleSpeed}
                />
            </div>
        </div>
      )}
    </div>
  );
}
