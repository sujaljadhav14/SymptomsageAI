/**
 * OllamaConsultation.tsx
 *
 * Voice consultation powered by:
 *   - Browser SpeechRecognition API  → mic → text
 *   - Ollama (local Llama3)          → streaming text response
 *   - STREAMING SpeechSynthesis      → speaks each sentence AS it arrives (no waiting!)
 *   - 3D Robot character             → reacts to state + volume lip-sync
 *
 * Key improvement: sentence-by-sentence queued TTS while Ollama is still streaming.
 * The robot starts speaking WHILE the AI is still generating — like a real conversation.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import RobotCharacter3D from './RobotCharacter3D';
import type { CharacterState } from './AnimeCharacter';
import { checkOllamaAvailability, chatWithOllama, type OllamaMessage } from '../utils/ollamaService';
import { SYSTEM_INSTRUCTION } from './Dashboard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface OllamaConsultationProps {
  onEndSession: (messages: Message[]) => void;
}

type SessionState = 'idle' | 'checking' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── Sentence splitter: splits text into speakable sentences ──────────────────
function extractSentences(text: string): { sentences: string[]; remainder: string } {
  // Split on . ! ? followed by whitespace OR end of string
  const sentenceEnd = /[.!?]+(?:\s+|$)/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = sentenceEnd.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].trimEnd().length).trim();
    if (sentence.length > 0) sentences.push(sentence);
    lastIndex = match.index + match[0].length;
  }

  return { sentences, remainder: text.slice(lastIndex) };
}

// ── Streaming TTS queue ───────────────────────────────────────────────────────
class TTSQueue {
  private queue: string[] = [];
  private processing = false;
  private synth = window.speechSynthesis;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  public onStateChange: (state: 'speaking' | 'idle') => void = () => {};
  public onVolumeChange: (v: number) => void = () => {};
  private lipSyncInterval: ReturnType<typeof setInterval> | null = null;
  private cancelled = false;

  constructor() {
    // Pick best available voice
    const pick = () => {
      const voices = this.synth.getVoices();
      this.preferredVoice =
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Samantha')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        null;
    };
    pick();
    this.synth.onvoiceschanged = pick;
  }

  enqueue(text: string) {
    if (!text.trim()) return;
    this.queue.push(text);
    if (!this.processing) this.processNext();
  }

  private processNext() {
    if (this.cancelled || this.queue.length === 0) {
      this.processing = false;
      this.stopLipSync();
      this.onStateChange('idle');
      return;
    }

    this.processing = true;
    const text = this.queue.shift()!;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.volume = 1;
    if (this.preferredVoice) utt.voice = this.preferredVoice;

    utt.onstart = () => {
      this.onStateChange('speaking');
      this.startLipSync();
    };

    utt.onend = () => {
      this.processNext();
    };

    utt.onerror = () => {
      this.processNext();
    };

    this.synth.speak(utt);
  }

  private startLipSync() {
    if (this.lipSyncInterval) return;
    let t = 0;
    this.lipSyncInterval = setInterval(() => {
      // Natural multi-frequency oscillation
      const v =
        0.25 +
        0.35 * Math.abs(Math.sin(t * 4.1)) +
        0.20 * Math.abs(Math.sin(t * 9.3)) +
        0.15 * Math.abs(Math.sin(t * 2.7));
      this.onVolumeChange(Math.min(1, v));
      t += 0.07;
    }, 55);
  }

  private stopLipSync() {
    if (this.lipSyncInterval) {
      clearInterval(this.lipSyncInterval);
      this.lipSyncInterval = null;
    }
    this.onVolumeChange(0);
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
    this.synth.cancel();
    this.stopLipSync();
    this.processing = false;
    this.onStateChange('idle');
  }

  reset() {
    this.cancelled = false;
  }

  get isEmpty() { return this.queue.length === 0 && !this.processing; }
}

// ─────────────────────────────────────────────────────────────────────────────

const OllamaConsultation: React.FC<OllamaConsultationProps> = ({ onEndSession }) => {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model: string; error?: string } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lipVolume, setLipVolume] = useState(0);

  const conversationRef = useRef<OllamaMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const ttsQueueRef = useRef<TTSQueue>(new TTSQueue());
  const isOllamaDoneRef = useRef(false);
  const fullResponseRef = useRef('');
  const pendingSpeakBufferRef = useRef('');
  const sessionStateRef = useRef<SessionState>('idle');

  // Keep ref in sync with state (needed inside callbacks)
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);

  // TTS queue event wiring
  useEffect(() => {
    const tts = ttsQueueRef.current;
    tts.onVolumeChange = setLipVolume;
    tts.onStateChange = (s) => {
      if (s === 'speaking') {
        setSessionState(prev => prev === 'thinking' || prev === 'speaking' ? 'speaking' : prev);
      } else if (s === 'idle' && isOllamaDoneRef.current) {
        setSessionState('ready');
        setStreamingText('');
      }
    };
  }, []);

  // Derive character state
  const characterState: CharacterState =
    sessionState === 'listening' ? 'listening' :
    sessionState === 'thinking'  ? 'thinking'  :
    sessionState === 'speaking'  ? 'speaking'  : 'idle';

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, streamingText]);

  // Check Ollama on mount
  useEffect(() => { checkOllama(); }, []);

  const checkOllama = async () => {
    setSessionState('checking');
    const status = await checkOllamaAvailability('llama3');
    setOllamaStatus(status);
    setSessionState(status.available ? 'ready' : 'error');
    if (!status.available) setError(status.error || 'Ollama unavailable');
  };

  // ── Flush pending buffer to TTS queue (called after each chunk + at end) ──
  const flushToTTS = useCallback((forceAll = false) => {
    const buf = pendingSpeakBufferRef.current;
    if (!buf) return;

    if (forceAll) {
      if (buf.trim()) ttsQueueRef.current.enqueue(buf.trim());
      pendingSpeakBufferRef.current = '';
      return;
    }

    const { sentences, remainder } = extractSentences(buf);
    sentences.forEach(s => ttsQueueRef.current.enqueue(s));
    pendingSpeakBufferRef.current = remainder;
  }, []);

  // ── Streaming Ollama + real-time TTS ──────────────────────────────────────
  const sendToOllama = useCallback(async (userText: string) => {
    setSessionState('thinking');
    setStreamingText('');
    isOllamaDoneRef.current = false;
    fullResponseRef.current = '';
    pendingSpeakBufferRef.current = '';
    ttsQueueRef.current.reset();

    conversationRef.current.push({ role: 'user', content: userText });

    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      text: userText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      abortRef.current = new AbortController();

      const ollamaMessages: OllamaMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...conversationRef.current,
      ];

      await chatWithOllama(
        ollamaMessages,
        (chunk) => {
          // Accumulate full response for display and history
          fullResponseRef.current += chunk;
          setStreamingText(fullResponseRef.current);

          // Accumulate chunk into speak buffer, flush complete sentences immediately
          pendingSpeakBufferRef.current += chunk;
          flushToTTS(false);
        },
        'llama3',
        abortRef.current.signal
      );

      // Stream finished — flush any remaining text
      flushToTTS(true);
      isOllamaDoneRef.current = true;

      // Save message to chat history
      const finalText = fullResponseRef.current;
      conversationRef.current.push({ role: 'assistant', content: finalText });
      const assistantMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        text: finalText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingText('');

      // If TTS is already done (very short response), go to ready
      if (ttsQueueRef.current.isEmpty) setSessionState('ready');

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(`Ollama error: ${err.message}`);
      setSessionState('error');
    }
  }, [flushToTTS]);

  // ── Voice recognition ─────────────────────────────────────────────────────
  const lastTranscriptRef = useRef('');

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition requires Chrome or Edge.');
      return;
    }

    ttsQueueRef.current.cancel(); // Stop AI if speaking
    lastTranscriptRef.current = '';

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setSessionState('listening');
      setCurrentTranscript('');
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      const combined = (final || interim).trim();
      setCurrentTranscript(combined);
      if (final) lastTranscriptRef.current = final;
    };

    recognition.onend = () => {
      setIsListening(false);
      setCurrentTranscript('');
      const transcript = lastTranscriptRef.current.trim();
      if (transcript) {
        sendToOllama(transcript);
      } else {
        setSessionState('ready');
      }
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e.error !== 'no-speech') {
        setError(`Mic error: ${e.error}`);
        setSessionState('error');
      } else {
        setSessionState('ready');
      }
    };

    recognition.start();
  }, [sendToOllama]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const skipSpeaking = () => {
    ttsQueueRef.current.cancel();
    setSessionState('ready');
  };

  const endSession = () => {
    ttsQueueRef.current.cancel();
    recognitionRef.current?.stop();
    abortRef.current?.abort();
    onEndSession(messages);
  };

  useEffect(() => {
    return () => {
      ttsQueueRef.current.cancel();
      abortRef.current?.abort();
    };
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-2xl overflow-hidden">

      {/* ── LEFT: 3D Character ─────────────────────────────────────────────── */}
      <div className="relative w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col min-h-0">
        {/* Gradient backdrop for character */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none z-0" />

        {/* 3D Robot — must be absolutely positioned to give canvas pixel height */}
        <div className="absolute inset-0 bottom-[56px]" style={{ minHeight: 0 }}>
          <RobotCharacter3D state={characterState} volume={lipVolume} />
        </div>

        {/* Character info — pinned to bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-14 p-3 border-t border-white/[0.06] bg-black/40 backdrop-blur-sm z-10">
          <p className="text-[10px] text-slate-400 text-center font-medium">Sage AI • Llama 3</p>
          <div className="flex justify-center mt-1.5 gap-1">
            {(['idle', 'listening', 'thinking', 'speaking'] as CharacterState[]).map(s => (
              <div
                key={s}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  characterState === s ? 'scale-150 opacity-100' : 'opacity-20'
                }`}
                style={{
                  backgroundColor:
                    s === 'listening' ? '#60a5fa' :
                    s === 'thinking'  ? '#a78bfa' :
                    s === 'speaking'  ? '#34d399' : '#94a3b8'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Chat ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
              ollamaStatus?.available
                ? sessionState === 'ready' ? 'bg-green-400' : 'bg-green-400 animate-pulse'
                : 'bg-red-400'
            }`} />
            <span className="text-white font-bold text-sm">Local AI Mode</span>
            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-[10px] font-bold rounded-full border border-violet-500/20 tracking-wider">
              🦙 Llama 3
            </span>
          </div>
          {ollamaStatus?.available && (
            <button
              onClick={endSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 border border-red-500/20 transition-all"
            >
              <Square className="w-3 h-3" />
              End
            </button>
          )}
        </div>

        {/* Status bar */}
        <AnimatePresence mode="wait">
          {sessionState === 'checking' && (
            <motion.div key="checking" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              Connecting to Ollama...
            </motion.div>
          )}
          {sessionState === 'error' && error && (
            <motion.div key="error" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-xs">
              <div className="flex items-start gap-2 text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">{error}</p>
                  <p className="text-red-400/80">
                    Run: <code className="bg-red-900/30 px-1.5 py-0.5 rounded">ollama serve</code>
                    {' '}then{' '}
                    <code className="bg-red-900/30 px-1.5 py-0.5 rounded">ollama pull llama3</code>
                  </p>
                  <button onClick={checkOllama} className="mt-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 font-bold">
                    Retry
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {sessionState === 'ready' && (
            <motion.div key="ready" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready — tap the mic and speak
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-2">
              <Mic className="w-9 h-9 text-slate-400" />
              <p className="text-slate-400 text-sm">Describe your symptoms to begin</p>
            </div>
          ) : (
            messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white/[0.07] text-slate-200 rounded-tl-sm border border-white/[0.08] backdrop-blur-sm'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1">
                  {msg.role === 'user' ? 'You' : 'Sage AI'} ·{' '}
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))
          )}

          {/* Live streaming response */}
          {streamingText && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start"
            >
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed bg-violet-500/10 text-slate-200 border border-violet-500/20 backdrop-blur-sm">
                {streamingText}
                <span className="inline-block w-0.5 h-3.5 ml-1 bg-violet-400 animate-[blink_0.8s_ease-in-out_infinite] rounded-full align-middle" />
              </div>
              <span className="text-[10px] text-violet-400/70 mt-1 px-1">Sage AI · responding...</span>
            </motion.div>
          )}

          {/* Live mic transcript */}
          {currentTranscript && isListening && (
            <div className="flex flex-col items-end">
              <div className="max-w-[88%] bg-slate-800/80 text-slate-300 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm opacity-70">
                {currentTranscript}
                <span className="text-slate-500">…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="p-5 border-t border-white/[0.06] bg-black/10 flex items-center justify-center gap-4">

          {/* READY — big mic button */}
          {sessionState === 'ready' && (
            <div className="flex flex-col items-center gap-2">
              <motion.button
                onClick={startListening}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-900/50"
              >
                <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                <Mic className="w-7 h-7 text-white relative z-10" />
              </motion.button>
              <span className="text-[10px] text-slate-500 font-medium">Tap to speak</span>
            </div>
          )}

          {/* LISTENING — pulsing stop button */}
          {sessionState === 'listening' && (
            <div className="flex flex-col items-center gap-2">
              <motion.button
                onClick={stopListening}
                animate={{ scale: [1, 1.07, 1], boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 0 12px rgba(239,68,68,0.15)', '0 0 0 0 rgba(239,68,68,0)'] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-900/50"
              >
                <MicOff className="w-7 h-7 text-white" />
              </motion.button>
              <span className="text-[10px] text-red-400 font-bold animate-pulse">Listening…</span>
            </div>
          )}

          {/* THINKING — spinner */}
          {sessionState === 'thinking' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-violet-300 animate-spin" />
              </div>
              <span className="text-[10px] text-violet-300 font-bold">Processing…</span>
            </div>
          )}

          {/* SPEAKING — animated bars + skip */}
          {sessionState === 'speaking' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center gap-0.5">
                {[0.6, 1.0, 0.7, 1.2, 0.5].map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full"
                    animate={{ scaleY: [h * 0.4, h, h * 0.4] }}
                    transition={{ repeat: Infinity, duration: 0.5 + i * 0.08, delay: i * 0.07 }}
                    style={{ height: '50%', transformOrigin: 'bottom' }}
                  />
                ))}
              </div>
              <button
                onClick={skipSpeaking}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
              >
                Skip →
              </button>
            </div>
          )}

          {/* ERROR — retry */}
          {sessionState === 'error' && (
            <button
              onClick={checkOllama}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OllamaConsultation;
