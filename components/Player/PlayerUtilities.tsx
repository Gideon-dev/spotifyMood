
import { NormalizedTrack } from "@/lib/Playback/types";
import { motion } from "framer-motion";
import {
Play,
Pause,
SkipForward,
SkipBack,
Repeat,
Shuffle,
Heart,
Volume2,
MonitorSmartphone,
ClipboardList
} from "lucide-react";
import { RepeatMode } from "./PlayerContainer";
import { useEffect, useMemo, useRef, useState } from "react";
import { msToTime } from "@/lib/helperFunctions";



// playback player Left

export const PlayerLeft = ({ track, liked, onLike }: { track?: NormalizedTrack | null; liked: boolean; onLike: () => void })  => {
  return (
  <div className="flex items-center gap-3 w-72">
    <div className="w-12 h-12 bg-[#222] rounded overflow-hidden flex-shrink-0">
    {track?.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={track.image_url ?? ''} alt={track.album ?? "track album"} className="w-full h-full object-cover" />
    ) : (
    <div className="w-full h-full flex items-center justify-center text-sm text-[#888]">No art</div>
    )}
    </div>
    
    
    <div className="flex flex-col min-w-0">
      <div className="text-sm font-medium truncate">{track?.track_name ?? "—"}</div>
      <div className="text-xs text-[#b3b3b3] truncate">{track?.artist ?? "—"}</div>
    </div>
    
    
    <button className="ml-auto p-2" onClick={onLike} aria-label="like">
      <motion.div whileTap={{ scale: 0.9 }}>
      <Heart className={`w-5 h-5 ${liked ? "text-[#1db954]" : "text-[#b3b3b3]"}`} />
      </motion.div>
    </button>
  </div>
  );
}







// playback player center

export function PlayerCenter({
  progressMs,
  durationMs,
  onSeek,
  isPlaying,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  shuffle,
  setShuffle,
  repeatMode,
  cycleRepeat,
  }: {
  progressMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  shuffle: boolean;
  setShuffle: (v: boolean) => void;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
  }) {

  const [localProgress, setLocalProgress] = useState(progressMs);
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  
  
  useEffect(() => {
    if (!dragging) setLocalProgress(progressMs);
  }, [progressMs, dragging]);
  
  
  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromEvent(e as unknown as PointerEvent);
  }
  
  
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    updateFromEvent(e as unknown as PointerEvent);
  }
  
  
  function handlePointerUp(e: React.PointerEvent) {
  if (!dragging) return;
  setDragging(false);
  updateFromEvent(e as unknown as PointerEvent);
  // final seek
  if (barRef.current) {
  const rect = barRef.current.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  const ms = Math.max(0, Math.min(1, pos)) * (durationMs || 0);
  onSeek(ms);
  }
  }
  
  
  function updateFromEvent(e: PointerEvent) {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ms = pos * (durationMs || 0);
    setLocalProgress(ms);
  }
  
  
  const progressPercent = useMemo(() => {
    if (!durationMs) return 0;
    return Math.min(100, (localProgress / durationMs) * 100);
  }, [localProgress, durationMs]);  
  
  
  return(
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setShuffle(!shuffle)} aria-label="shuffle" className={`p-2 ${shuffle ? "text-[#1db954]" : "text-[#b3b3b3]"}`}>
          <Shuffle className="w-4 h-4" />
        </button>
      
      
        <button onClick={onSkipPrev} aria-label="previous" className="p-2 text-[#b3b3b3]">
          <SkipBack className="w-5 h-5" />
        </button>
      
      
        <button
        onClick={onTogglePlay}
        aria-label={isPlaying ? "pause" : "play"}
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-white text-black"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
      
      
        <button onClick={onSkipNext} aria-label="next" className="p-2 text-[#b3b3b3]">
         <SkipForward className="w-5 h-5" />
        </button>
      
      
        <button onClick={cycleRepeat} aria-label="repeat" className={`p-2 ${repeatMode !== "off" ? "text-[#1db954]" : "text-[#b3b3b3]"}`}>
          <div className="relative inline-flex items-center">
            <Repeat className="w-4 h-4" />
            {repeatMode === "track" && <span className="absolute -top-2 -right-2 text-xs">1</span>}
          </div>
        </button>
      </div>
    
    
      <div className="w-full text-xs text-[#b3b3b3] flex items-center gap-3">
        <div className="w-10 text-right">{msToTime(localProgress)}</div>
        
        
          <div
          className="h-2 flex-1 rounded-full bg-[#404040] relative cursor-pointer"
          ref={barRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          >
            <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg,#1db954,#1ed760)" }} />
            <div
            className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
        </div>
      
      
        <div className="w-10">{msToTime(durationMs)}</div>
      </div>
    </div>
  );
}



// playback player right
export function PlayerRight({ volume, setVolume, onOpenDevices }: { volume: number; setVolume: (v: number) => void; onOpenDevices: () => void }) {
  const [local, setLocal] = useState(volume);
  useEffect(() => setLocal(volume), [volume]);
  
  
  function startChange(v: number) {
  setLocal(v);
  }
  function commitChange(v: number) {
  setVolume(v);
  }
  
  
  return (
  <div className="flex items-center gap-4 w-80 justify-end">
  <button className="p-2 text-[#b3b3b3]">
  <ClipboardList className="w-4 h-4" />
  </button>
  
  
  <button onClick={onOpenDevices} className="p-2 text-[#b3b3b3]">
  <MonitorSmartphone className="w-4 h-4" />
  </button>
  
  
  <div className="flex items-center gap-2 w-36">
  <Volume2 className="w-4 h-4 text-[#b3b3b3]" />
  <input
  type="range"
  min={0}
  max={100}
  value={local}
  onChange={(e) => startChange(Number(e.target.value))}
  onMouseUp={() => commitChange(local)}
  onTouchEnd={() => commitChange(local)}
  className="w-full"
  />
  </div>
  </div>
  );
}