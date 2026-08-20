import { MAX_RECORDING_MS } from "@willow/shared";
import { LocalAudioTrack } from "livekit-client";

export interface RecorderHandle {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  cancel: () => void;
  getDurationMs: () => number;
  onLevel: (cb: (level: number) => void) => void;
  /** Raw FFT frequency data (0-255 per bin), updated live — for the visualizer. */
  getFrequencyData: () => Uint8Array;
  /** The underlying MediaRecorder. */
  mediaRecorder: MediaRecorder;
  /** The mic's LocalAudioTrack, for LiveKit's BarVisualizer. */
  liveKitTrack: LocalAudioTrack;
}

/**
 * MediaRecorder-based capture with a live AnalyserNode for visualization.
 * Always produces a playable blob (webm/opus preferred, mp4 fallback on Safari).
 */
export async function createRecorder(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Live analyser (drives both the level meter and the visualizer)
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  let levelCb: ((level: number) => void) | null = null;
  const meter = setInterval(() => {
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) sum += freqData[i];
    const avg = sum / freqData.length / 255;
    levelCb?.(avg);
  }, 80);

  const startedAt = Date.now();

  // Wrap the mic track as a LiveKit LocalAudioTrack for the BarVisualizer
  const liveKitTrack = new LocalAudioTrack(stream.getAudioTracks()[0]);

  return {
    async start() {
      recorder.start(1000);
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          clearInterval(meter);
          audioCtx.close().catch(() => {});
          liveKitTrack.stop();
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mimeType ?? "audio/webm" }));
        };
        try {
          recorder.stop();
        } catch (err) {
          reject(err as Error);
        }
      });
    },
    cancel() {
      clearInterval(meter);
      audioCtx.close().catch(() => {});
      liveKitTrack.stop();
      stream.getTracks().forEach((t) => t.stop());
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    },
    getDurationMs() {
      return Date.now() - startedAt;
    },
    onLevel(cb) {
      levelCb = cb;
    },
    getFrequencyData() {
      return freqData;
    },
    mediaRecorder: recorder,
    liveKitTrack,
  };
}

export function enforceMaxDuration(recorder: RecorderHandle, onMax?: () => void) {
  return setTimeout(() => {
    onMax?.();
  }, MAX_RECORDING_MS);
}
