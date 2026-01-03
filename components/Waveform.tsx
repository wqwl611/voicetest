// A purely visual component to mimic the Voice Memos aesthetic
// In a real app, this would analyze the audio buffer.
export const Waveform = ({ isPlaying, isRecording }: { isPlaying: boolean; isRecording: boolean }) => {
  return (
    <div className="flex items-center justify-center space-x-[2px] h-32 w-full overflow-hidden opacity-80">
      {Array.from({ length: 60 }).map((_, i) => {
        // Randomize height for visual effect, animate if active
        const height = Math.max(10, Math.floor(Math.random() * 100));
        const animationClass = (isPlaying || isRecording) ? 'animate-pulse' : '';
        const delay = Math.random() * 1;
        
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full bg-red-500 transition-all duration-300 ${animationClass}`}
            style={{
              height: `${height}%`,
              opacity: isRecording ? 1 : 0.3, // Dim when just playing back conceptually, or bright if recording
              backgroundColor: isRecording ? '#ff3b30' : '#333',
              animationDelay: `${delay}s`
            }}
          />
        );
      })}
    </div>
  );
};