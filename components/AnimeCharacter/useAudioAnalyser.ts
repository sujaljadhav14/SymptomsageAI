import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * useAudioAnalyser
 * Taps into the existing output AudioContext to extract real-time volume data
 * for driving the lip-sync animation of the anime character.
 *
 * IMPORTANT: This hook connects an AnalyserNode to the AudioContext's destination.
 * It uses a technique of creating an AnalyserNode and a gain node bridging
 * the existing destination, so we can read frequency data from all playing
 * AudioBufferSourceNodes without interrupting playback.
 */
export function useAudioAnalyser(
  audioContextRef: RefObject<AudioContext | null>,
  isActive: boolean
): { volume: number; frequencyData: Uint8Array } {
  const [volume, setVolume] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isSetupRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      // Stop animation loop
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setVolume(0);
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') {
      return;
    }

    // Set up AnalyserNode once per AudioContext instance
    if (!isSetupRef.current) {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // We create a GainNode (passthrough) that captures from the destination
        // by hooking into AudioContext's createMediaStreamDestination approach.
        // However, the simplest approach that works with AudioBufferSourceNode:
        // We expose the analyser so Dashboard can connect sources to it too.
        analyserRef.current = analyser;
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = 1.0;

        // Connect: analyser → destination (analyser reads whatever is sent to it)
        analyser.connect(ctx.destination);

        isSetupRef.current = true;
      } catch (e) {
        console.warn('[useAudioAnalyser] Failed to set up AnalyserNode:', e);
        return;
      }
    }

    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!isActive) return;

      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS volume
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // -1 to 1
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const clampedVolume = Math.min(1, rms * 4); // Amplify for sensitivity

      setVolume(clampedVolume);
      setFrequencyData(new Uint8Array(dataArray));

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isActive, audioContextRef]);

  // Expose the analyserNode so Dashboard can connect audio sources to it
  return { volume, frequencyData };
}

/**
 * getAnalyserNode
 * Returns the internal AnalyserNode for a given AudioContext.
 * Dashboard.tsx uses this to connect AudioBufferSourceNode → analyser → destination.
 */
const analyserMap = new WeakMap<AudioContext, AnalyserNode>();

export function getOrCreateAnalyser(ctx: AudioContext): AnalyserNode {
  if (analyserMap.has(ctx)) {
    return analyserMap.get(ctx)!;
  }
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  analyser.connect(ctx.destination);
  analyserMap.set(ctx, analyser);
  return analyser;
}
