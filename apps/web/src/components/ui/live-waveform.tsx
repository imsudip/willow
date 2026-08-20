import { useEffect, useRef } from "react";

interface LiveWaveformProps {
  /** Callback that returns the latest FFT frequency data (0-255 per bin). */
  getFrequencyData: () => Uint8Array;
  width?: number;
  height?: number;
  barCount?: number;
  barColor?: string;
  className?: string;
}

/**
 * Real-time audio waveform drawn on a canvas. Reads frequency data from the
 * mic's AnalyserNode each animation frame, so the bars react to the voice.
 * Optimized: plain fillRect per bar (no path building), stable callback via ref,
 * and devicePixelRatio-aware scaling for crisp rendering.
 */
export function LiveWaveform({
  getFrequencyData,
  width = 320,
  height = 80,
  barCount = 48,
  barColor = "var(--color-accent-strong)",
  className,
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getDataRef = useRef(getFrequencyData);
  getDataRef.current = getFrequencyData;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crisp rendering at device pixel ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const barWidth = width / barCount;
    let ranges: [number, number][] = [];

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const data = getDataRef.current();
      // Compute bar sampling ranges once, using the real FFT bin count
      if (ranges.length === 0 && data.length > 0) {
        ranges = Array.from({ length: barCount }, (_, i) => {
          const start = Math.floor((i / barCount) * data.length * 0.6);
          const end = Math.max(start + 1, Math.floor(((i + 1) / barCount) * data.length * 0.6));
          return [start, end] as [number, number];
        });
      }
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = barColor;

      for (let i = 0; i < barCount; i++) {
        const [start, end] = ranges[i] ?? [0, 1];
        let sum = 0;
        for (let j = start; j < end; j++) sum += data[j] ?? 0;
        const avg = sum / (end - start);
        const h = Math.max(2, (avg / 255) * height);
        // fillRect is much cheaper than roundRect + path per frame
        ctx.fillRect(i * barWidth + 1, (height - h) / 2, barWidth - 2, h);
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [width, height, barCount, barColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Live audio waveform"
    />
  );
}
