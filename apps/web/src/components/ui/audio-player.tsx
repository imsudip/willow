import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "../../lib/utils";

interface AudioPlayerProps {
  src: string;
  /** Known duration in ms (e.g. from entry.audioDurationMs) — shows the ending time immediately. */
  durationHintMs?: number;
  className?: string;
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Custom audio player: play/pause, seekable progress, volume, time. No native controls. */
export function AudioPlayer({ src, durationHintMs, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Sync the duration hint once the entry loads (state init only runs on mount)
  useEffect(() => {
    if (durationHintMs && durationHintMs > 0) {
      setDuration(durationHintMs / 1000);
    }
  }, [durationHintMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
    setPlaying(!playing);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  }

  function changeVolume(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    audio.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3", className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play recording"}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm transition-transform active:scale-95"
      >
        {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        {/* Progress bar (click to seek, drag supported) */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="range-slider w-full"
          style={{
            background: `linear-gradient(to right, var(--color-accent-strong) ${progress}%, var(--color-surface-2) ${progress}%)`,
          }}
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-[var(--muted-foreground)]">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-foreground)] active:bg-[var(--muted)]"
        >
          {muted || volume === 0 ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          aria-label="Volume"
          className="range-slider hidden w-20 sm:block"
          style={{
            background: `linear-gradient(to right, var(--color-accent-strong) ${(muted ? 0 : volume) * 100}%, var(--color-surface-2) ${(muted ? 0 : volume) * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}
