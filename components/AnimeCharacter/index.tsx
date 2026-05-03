import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CharacterSVG from './CharacterSVG';
import './character.css';

/**
 * AnimeCharacter — Main component for "Sage-chan"
 * The interactive anime AI assistant with real-time lip-sync.
 *
 * Props:
 *  - state: Current character state (idle/listening/speaking/thinking)
 *  - outputAudioContextRef: Ref to the Gemini Live output AudioContext
 *    (used for AnalyserNode insertion to drive lip-sync)
 */

export type CharacterState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface AnimeCharacterProps {
  state: CharacterState;
  outputAudioContextRef: React.RefObject<AudioContext | null>;
}

const STATE_LABELS: Record<CharacterState, string> = {
  idle: 'Ready to help',
  listening: 'Listening...',
  speaking: 'Speaking...',
  thinking: 'Thinking...',
};

const STATE_EMOJIS: Record<CharacterState, string> = {
  idle: '💙',
  listening: '👂',
  speaking: '🗣️',
  thinking: '💭',
};

const AnimeCharacter: React.FC<AnimeCharacterProps> = ({
  state,
  outputAudioContextRef,
}) => {
  const [volume, setVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // ── Set up AnalyserNode when speaking begins ──────────────────────────
  useEffect(() => {
    if (state !== 'speaking') {
      // Stop animation loop and reset volume
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setVolume(0);
      return;
    }

    const ctx = outputAudioContextRef.current;
    if (!ctx) return;

    // Create analyser if not already done for this context
    if (!analyserRef.current) {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        // Connect analyser to destination so it intercepts all audio
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Expose on the context object so Dashboard can connect sources to it
        (ctx as any).__sageAnalyser = analyser;
      } catch (e) {
        console.warn('[AnimeCharacter] AnalyserNode setup failed:', e);
        return;
      }
    }

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current!;

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);

      // RMS volume calculation
      let sumSq = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / dataArray.length);
      // Amplify and clamp — typical speech RMS is very low (0.02–0.15)
      setVolume(Math.min(1, rms * 5));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state, outputAudioContextRef]);

  // Clean up analyser when context changes
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Disconnect analyser cleanly
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch (_) {}
        analyserRef.current = null;
      }
    };
  }, []);

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  return (
    <div className="flex flex-col items-center select-none">
      {/* ── Character container with aura ── */}
      <motion.div
        className={`sage-character state-${state}`}
        style={{ width: 220, height: 280, position: 'relative' }}
        animate={{
          filter: isSpeaking
            ? 'drop-shadow(0 0 18px rgba(99,179,237,0.55))'
            : isListening
            ? 'drop-shadow(0 0 12px rgba(52,211,153,0.45))'
            : isThinking
            ? 'drop-shadow(0 0 10px rgba(196,181,253,0.4))'
            : 'drop-shadow(0 0 4px rgba(100,130,200,0.15))',
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* Aura glow ring behind character */}
        <motion.div
          className="sage-aura"
          animate={{
            opacity: isSpeaking ? 0.6 : isListening ? 0.35 : 0.15,
            scale: isSpeaking ? [1, 1.08, 1] : 1,
          }}
          transition={
            isSpeaking
              ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.5 }
          }
          style={{
            position: 'absolute',
            inset: -24,
            borderRadius: '50%',
            background: isSpeaking
              ? 'radial-gradient(ellipse, rgba(99,179,237,0.25) 0%, transparent 70%)'
              : isListening
              ? 'radial-gradient(ellipse, rgba(52,211,153,0.2) 0%, transparent 70%)'
              : isThinking
              ? 'radial-gradient(ellipse, rgba(196,181,253,0.18) 0%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(99,130,200,0.1) 0%, transparent 70%)',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Character SVG */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
          <CharacterSVG
            volume={volume}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isThinking={isThinking}
            characterState={state}
          />
        </div>
      </motion.div>

      {/* ── Status pill label ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          className={`sage-status-pill pill-${state}`}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.9 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ marginTop: 12 }}
        >
          <span className="sage-status-dot" />
          <span>{STATE_EMOJIS[state]}</span>
          <span>{STATE_LABELS[state]}</span>
        </motion.div>
      </AnimatePresence>

      {/* ── Volume bar (visible when speaking) ── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            style={{
              marginTop: 8,
              width: 160,
              height: 4,
              borderRadius: 999,
              background: 'rgba(99,179,237,0.15)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              animate={{ width: `${Math.round(volume * 100)}%` }}
              transition={{ duration: 0.06 }}
              style={{
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #63b3ed, #3182ce)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Character name tag ── */}
      <p style={{
        marginTop: 6,
        fontSize: 10,
        color: 'rgba(148,163,184,0.7)',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        Sage-chan · AI Medical Assistant
      </p>
    </div>
  );
};

export default AnimeCharacter;
