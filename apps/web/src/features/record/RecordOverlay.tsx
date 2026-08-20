import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, AudioWaveform, Loader2 } from "lucide-react";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { createRecorder, enforceMaxDuration, type RecorderHandle } from "../../lib/audio";
import { RECORDING_PHRASES, PROCESSING_PHRASES, CLEANING_PHRASES } from "../../lib/phrases";
import { client } from "../../lib/api";
import { db, saveAudio } from "../../lib/db";
import { MAX_RECORDING_MS, type Entry } from "@willow/shared";
import { WordRotate } from "../../components/ui/word-rotate";
import { NoiseTexture } from "../../components/ui/noise-texture";

type Phase = "idle" | "recording" | "processing" | "cleaning";

function useRotatingPhrase(list: readonly string[], active: boolean, intervalMs = 4500) {
  const [phrase, setPhrase] = useState(() => list[0]);
  useEffect(() => {
    if (!active) return;
    setPhrase(list[Math.floor(Math.random() * list.length)]);
    const t = setInterval(() => {
      setPhrase(list[Math.floor(Math.random() * list.length)]);
    }, intervalMs);
    return () => clearInterval(t);
  }, [list, active, intervalMs]);
  return phrase;
}

export function RecordOverlay() {
  const navigate = useNavigate();
  const recorderRef = useRef<RecorderHandle | null>(null);
  const [recorder, setRecorder] = useState<RecorderHandle | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processingPhrase = useRotatingPhrase(PROCESSING_PHRASES, phase === "processing", 3200);
  const cleaningPhrase = useRotatingPhrase(CLEANING_PHRASES, phase === "cleaning", 3200);

  // Timer for elapsed duration
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed(recorderRef.current?.getDurationMs() ?? 0), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Wake lock while recording
  useEffect(() => {
    if (phase !== "recording") return;
    let cancelled = false;
    navigator.wakeLock?.request("screen").then((lock) => {
      if (cancelled) void lock.release();
      else wakeLockRef.current = lock;
    }).catch(() => {});
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [phase]);

  async function start() {
    setError(null);
    try {
      const recorder = await createRecorder();
      recorderRef.current = recorder;
      setRecorder(recorder);
      await recorder.start();
      setPhase("recording");
      enforceMaxDuration(recorder);
    } catch {
      setError("Mic access was denied. Enable the microphone in your browser settings, then try again.");
    }
  }

  async function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setPhase("processing");
    const blob = await recorder.stop();
    const durationMs = recorder.getDurationMs();

    // Create the local entry first (offline-safe, source of truth)
    const now = new Date();
    const id = crypto.randomUUID();
    const entry: Entry = {
      id,
      recordedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      audioPresent: true,
      audioDurationMs: durationMs,
      rawTranscript: "",
      cleanedBody: "",
      title: "",
      mood: null,
      tags: [],
      status: "transcribing",
      errorMessage: null,
      dirty: true,
      deleted: false,
      serverAudioUrl: null,
    };
    await saveAudio(id, blob);
    await db.entries.put(entry);

    // Upload + transcribe
    try {
      const { transcript } = await client.transcribe(blob);
      await db.entries.update(id, { rawTranscript: transcript, status: "cleaning", dirty: true });
      setPhase("cleaning");

      try {
        const cleaned = await client.cleanup(transcript);
        await db.entries.update(id, {
          cleanedBody: cleaned.body,
          title: cleaned.title,
          mood: (cleaned.mood as Entry["mood"]) ?? null,
          tags: cleaned.tags,
          status: "ready",
          dirty: true,
        });
      } catch {
        // Keep transcript; cleanup can be retried from the review screen
        await db.entries.update(id, { status: "ready", dirty: true });
      }

      navigate(`/entries/${id}/review`, { replace: true });
    } catch (err) {
      await db.entries.update(id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Transcription failed",
        dirty: true,
      });
      setError(
        "Couldn't transcribe right now. Your recording is saved — it will transcribe when you're back online.",
      );
      setPhase("idle");
    }
  }

  function cancel() {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    navigate(-1);
  }

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flood fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden px-6 pb-[max(env(safe-area-inset-bottom),2.5rem)] pt-[max(env(safe-area-inset-top),2.5rem)]">
      <NoiseTexture className="opacity-30" noiseOpacity={0.4} />
      <div className="relative z-10 w-full">
        <p className="text-center text-xs font-medium uppercase tracking-widest tabular-nums text-muted">
          {phase === "recording" ? fmt(elapsed) : phase === "processing" || phase === "cleaning" ? "A moment" : ""}
        </p>
      </div>

      {phase === "idle" && (
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <button
            onClick={start}
            aria-label="Start recording"
            className="flex h-28 w-28 items-center justify-center rounded-full bg-accent-strong text-[#fdf7ea] shadow-xl shadow-accent/40 transition-transform active:scale-95"
          >
            <Mic className="h-12 w-12" strokeWidth={1.6} aria-hidden />
          </button>
          <p className="font-serif text-2xl">Tap to ramble</p>
          <p className="max-w-xs text-sm text-muted">
            Take a breath. Nothing you say has to be perfect.
          </p>
          <button
            onClick={cancel}
            className="mt-4 min-h-11 min-w-28 rounded-xl border border-line/60 px-5 text-sm font-medium text-muted active:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      )}

      {phase === "recording" && recorder && (
        <div className="relative z-10 flex w-full flex-col items-center gap-4">
          {/* LiveKit shader aura — reacts to the mic volume, GPU-rendered (fast) */}
          <div className="flex max-h-[42dvh] w-full items-center justify-center overflow-hidden">
            <AgentAudioVisualizerAura
              audioTrack={recorder.liveKitTrack}
              state="speaking"
              color="#ff8c42"
              themeMode="light"
              size="xl"
              className="h-full"
            />
          </div>
          <WordRotate
            words={[...RECORDING_PHRASES]}
            duration={3500}
            className="font-serif text-xl"
          />
          <button
            onClick={stop}
            aria-label="Stop recording"
            className="mt-2 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-night text-[#fdf7ea] shadow-lg transition-transform active:scale-95"
          >
            <Square className="h-8 w-8 fill-current" aria-hidden />
          </button>
        </div>
      )}

      {(phase === "processing" || phase === "cleaning") && (
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent-strong" aria-hidden />
          <AudioWaveform className="h-8 w-8 text-accent" strokeWidth={1.4} aria-hidden />
          <p className="font-serif text-xl">
            {phase === "processing" ? processingPhrase : cleaningPhrase}
          </p>
        </div>
      )}

      {error && (
        <div className="relative z-10 w-full rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
          {phase === "idle" && (
            <button
              onClick={() => navigate(-1)}
              className="mt-3 inline-flex min-h-11 min-w-28 items-center justify-center rounded-xl border border-line/60 px-5 text-sm font-medium text-muted active:bg-surface-2"
            >
              Back
            </button>
          )}
        </div>
      )}

      <div className="relative z-10 w-full text-center">
        <p className="text-xs text-muted">
          {phase === "recording" ? "Recording stays on your device until you save it." : ""}
        </p>
      </div>
    </div>
  );
}
