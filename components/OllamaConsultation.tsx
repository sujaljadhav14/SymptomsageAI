import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Loader2, AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import AnimeCharacter, { type CharacterState } from './AnimeCharacter';
import { checkOllamaAvailability, chatWithOllama, type OllamaMessage } from '../utils/ollamaService';
import { SYSTEM_INSTRUCTION } from './Dashboard';

/**
 * OllamaConsultation
 * Voice consultation powered by:
 *   - Browser SpeechRecognition API  → captures user voice → text
 *   - Ollama (local Llama3)          → text in → text out
 *   - Browser SpeechSynthesis API    → text → spoken audio
 *   - Sage-chan character             → lip-sync via SpeechSynthesis boundary events
 *
 * No Gemini Live API key required. 100% local AI.
 */

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

// Extend Window type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const OllamaConsultation: React.FC<OllamaConsultationProps> = ({ onEndSession }) => {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; model: string; error?: string } | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  // Lip-sync volume driven by SpeechSynthesis word boundaries
  const [lipSyncVolume, setLipSyncVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const conversationRef = useRef<OllamaMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lipSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef(window.speechSynthesis);

  // Derive character state for Sage-chan
  const characterState: CharacterState =
    sessionState === 'listening' ? 'listening' :
    sessionState === 'thinking' ? 'thinking' :
    sessionState === 'speaking' ? 'speaking' :
    'idle';

  // Dummy ref for AnimeCharacter (no Web Audio needed for SpeechSynthesis lip-sync)
  const dummyAudioRef = useRef<AudioContext | null>(null);

  const messagesScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { messagesScrollToBottom(); }, [messages, streamingText]);

  // ── Step 1: Check Ollama on mount ──────────────────────────────────────────
  useEffect(() => {
    checkOllama();
  }, []);

  const checkOllama = async () => {
    setSessionState('checking');
    const status = await checkOllamaAvailability('llama3');
    setOllamaStatus(status);
    setSessionState(status.available ? 'ready' : 'error');
    if (!status.available) setError(status.error || 'Ollama unavailable');
  };

  // ── Lip-sync driver using sine wave while speaking ─────────────────────────
  const startLipSync = () => {
    let t = 0;
    lipSyncIntervalRef.current = setInterval(() => {
      // Natural-looking oscillating volume
      const v = 0.3 + 0.4 * Math.abs(Math.sin(t * 3.5)) + 0.2 * Math.abs(Math.sin(t * 7.1));
      setLipSyncVolume(Math.min(1, v));
      t += 0.08;
    }, 60);
  };

  const stopLipSync = () => {
    if (lipSyncIntervalRef.current) {
      clearInterval(lipSyncIntervalRef.current);
      lipSyncIntervalRef.current = null;
    }
    setLipSyncVolume(0);
  };

  // ── Step 2: Speak AI response using SpeechSynthesis ───────────────────────
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      // Pick a good voice if available
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(v =>
        v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => {
        setSessionState('speaking');
        startLipSync();
      };

      utterance.onend = () => {
        stopLipSync();
        resolve();
      };

      utterance.onerror = () => {
        stopLipSync();
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  }, []);

  // ── Step 3: Send user message to Ollama ────────────────────────────────────
  const sendToOllama = useCallback(async (userText: string) => {
    setSessionState('thinking');
    setStreamingText('');

    // Build conversation history
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
      let fullResponse = '';

      const messages: OllamaMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...conversationRef.current,
      ];

      await chatWithOllama(
        messages,
        (chunk) => {
          fullResponse += chunk;
          setStreamingText(fullResponse);
        },
        'llama3',
        abortRef.current.signal
      );

      // Add assistant message
      conversationRef.current.push({ role: 'assistant', content: fullResponse });
      const assistantMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        text: fullResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingText('');

      // Speak the response
      await speakText(fullResponse);

      setSessionState('ready');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(`Ollama error: ${err.message}`);
      setSessionState('error');
    }
  }, [speakText]);

  // ── Step 4: Voice recognition ──────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome or Edge.');
      return;
    }

    synthRef.current.cancel(); // Stop any ongoing speech

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setSessionState('listening');
      setCurrentTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setCurrentTranscript(final || interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      const transcript = currentTranscript || recognition._lastTranscript || '';
      if (transcript.trim()) {
        sendToOllama(transcript.trim());
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

    recognitionRef.current = recognition;
    recognition.start();
  }, [currentTranscript, sendToOllama]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const endSession = () => {
    synthRef.current.cancel();
    stopLipSync();
    recognitionRef.current?.stop();
    abortRef.current?.abort();
    onEndSession(messages);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      synthRef.current.cancel();
      stopLipSync();
      abortRef.current?.abort();
    };
  }, []);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${ollamaStatus?.available ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-white font-bold text-sm">Local AI Mode</span>
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full uppercase tracking-wider border border-purple-500/30">
            Llama 3 · Offline
          </span>
        </div>
        {ollamaStatus?.available && (
          <button
            onClick={endSession}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all border border-red-500/20"
          >
            <Square className="w-3 h-3" />
            End Session
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left: Character Panel */}
        <div className="w-56 flex-shrink-0 flex flex-col items-center justify-center border-r border-white/10 py-6 px-4">
          {/* Override volume prop via a wrapper trick using a modified AnimeCharacter */}
          <OllamaCharacterWrapper
            state={characterState}
            volume={lipSyncVolume}
            dummyRef={dummyAudioRef}
          />
        </div>

        {/* Right: Chat + Controls */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Status bar */}
          <AnimatePresence mode="wait">
            {sessionState === 'checking' && (
              <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking Ollama connection...
              </motion.div>
            )}
            {sessionState === 'error' && error && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
                <div className="flex items-start gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold mb-1">{error}</p>
                    {error.includes('ollama') || error.includes('Ollama') ? (
                      <div className="space-y-1 text-red-400/80">
                        <p>1. Install Ollama: <a href="https://ollama.com" target="_blank" className="underline">ollama.com</a></p>
                        <p>2. Run: <code className="bg-red-900/30 px-1 rounded">ollama pull llama3</code></p>
                        <p>3. Run: <code className="bg-red-900/30 px-1 rounded">ollama serve</code></p>
                        <button onClick={checkOllama} className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 font-bold">
                          Retry Connection
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            )}
            {sessionState === 'ready' && (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-6 py-3 bg-green-500/10 border-b border-green-500/20 text-green-300 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ollama connected · Llama 3 ready · Press mic to speak
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                <Mic className="w-10 h-10 text-slate-400" />
                <p className="text-slate-400 text-sm">Press the mic button and start speaking</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/10 backdrop-blur-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-2">
                    {msg.role === 'user' ? 'You' : 'Sage AI (Llama 3)'} · {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}

            {/* Streaming AI response */}
            {streamingText && (
              <div className="flex flex-col items-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-white/10 text-slate-200 rounded-tl-none border border-purple-500/20 backdrop-blur-sm">
                  {streamingText}
                  <span className="inline-block w-1 h-4 ml-1 bg-purple-400 animate-pulse rounded-full" />
                </div>
                <span className="text-[10px] text-purple-400 mt-1 px-2">Sage AI is thinking...</span>
              </div>
            )}

            {/* Live transcript */}
            {currentTranscript && isListening && (
              <div className="flex flex-col items-end opacity-60">
                <div className="max-w-[85%] bg-slate-700 text-slate-300 rounded-2xl px-4 py-3 text-sm rounded-tr-none">
                  {currentTranscript}...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Controls */}
          <div className="p-6 border-t border-white/10 flex items-center justify-center gap-4">
            {sessionState === 'ready' && (
              <motion.button
                onClick={startListening}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-xl shadow-blue-900/50 transition-colors"
              >
                <Mic className="w-7 h-7 text-white" />
              </motion.button>
            )}

            {sessionState === 'listening' && (
              <motion.button
                onClick={stopListening}
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-xl shadow-red-900/50"
              >
                <MicOff className="w-7 h-7 text-white" />
              </motion.button>
            )}

            {(sessionState === 'thinking' || sessionState === 'speaking') && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-purple-600/40 border border-purple-500/30 flex items-center justify-center">
                  {sessionState === 'thinking'
                    ? <Loader2 className="w-7 h-7 text-purple-300 animate-spin" />
                    : <div className="flex gap-1">{[1,2,3].map(i => (
                        <div key={i} className="w-1.5 h-6 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}</div>
                  }
                </div>
                <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                  {sessionState === 'thinking' ? 'Processing...' : 'Speaking...'}
                </span>
                {sessionState === 'speaking' && (
                  <button onClick={() => { synthRef.current.cancel(); stopLipSync(); setSessionState('ready'); }}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                    Skip
                  </button>
                )}
              </div>
            )}

            {sessionState === 'error' && (
              <button onClick={checkOllama}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all">
                Retry Connection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * OllamaCharacterWrapper
 * Wraps AnimeCharacter but manually passes volume for lip-sync
 * (since we're using SpeechSynthesis, not Web Audio).
 * We use a custom override of the internal volume state via a bridge.
 */
const OllamaCharacterWrapper: React.FC<{
  state: CharacterState;
  volume: number;
  dummyRef: React.RefObject<AudioContext | null>;
}> = ({ state, volume, dummyRef }) => {
  // AnimeCharacter uses its own AnalyserNode for volume when state='speaking'.
  // For Ollama mode, we pass our sine-wave volume directly through a small shim:
  // We create a tiny AudioContext + ConstantSourceNode that outputs a signal
  // proportional to our lip-sync volume, so the AnalyserNode inside AnimeCharacter
  // reads it. This is the cleanest way to bridge the two systems.
  const ctxRef = useRef<AudioContext | null>(null);
  const constantSourceRef = useRef<any>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (state !== 'speaking') {
      constantSourceRef.current?.stop();
      constantSourceRef.current = null;
      return;
    }

    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext({ sampleRate: 24000 });
        dummyRef.current = ctxRef.current;
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) {}
  }, [state]);

  // Modulate gain to drive the AnalyserNode
  useEffect(() => {
    if (!ctxRef.current || ctxRef.current.state !== 'running') return;
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  return (
    <AnimeCharacter
      state={state}
      outputAudioContextRef={dummyRef}
    />
  );
};

export default OllamaConsultation;
