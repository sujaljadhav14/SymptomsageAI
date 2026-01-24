
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioHelpers';
import LiveVisualizer from './LiveVisualizer';
import { Message, ConnectionStatus } from '../types';
import { saveChatHistory, savePatientSummary, getPatientContext, clearAllMemory } from '../utils/storage';
import { useUser, UserButton, SignOutButton } from '@clerk/clerk-react';
import { LogOut, BookOpen, Activity } from 'lucide-react';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const SYSTEM_INSTRUCTION = `
You are SymptomSage, a professional and empathetic medical triage assistant. 
Your goal is to help users understand their symptoms and determine the urgency of seeking medical care.

Guidelines:
1. MANDATORY DISCLAIMER: At the start of every session, clearly state that you are an AI assistant, not a doctor, and this conversation is for informational purposes and not a clinical diagnosis.
2. TRIAGE FOCUS: Ask clarifying questions about onset, duration, severity, and associated symptoms (e.g., "When did this start?", "On a scale of 1-10, how bad is the pain?").
3. RED FLAGS: If the user describes life-threatening symptoms (chest pain, difficulty breathing, severe bleeding), urge them to call emergency services (911) immediately.
4. TONE: Professional, calm, and supportive.
5. CONCISENESS: Since this is a voice conversation, keep responses relatively brief and ask one question at a time.
`;

const Dashboard: React.FC = () => {
    const { user } = useUser();
    const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [patientContext, setPatientContext] = useState<string>('');
    const [showDocs, setShowDocs] = useState(false);

    // Audio Context Refs
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    // Transcription storage
    const currentInputText = useRef('');
    const currentOutputText = useRef('');

    const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role,
            text,
            timestamp: new Date()
        }]);
    }, []);

    const stopAllAudio = () => {
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsAssistantSpeaking(false);
    };

    const summarizeSession = async (chatMessages: Message[]) => {
        if (chatMessages.length < 2) return;

        try {
            const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
            if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
                console.warn('API Key not set. Skipping summarization.');
                return;
            }

            const prompt = `Based on the following medical triage conversation, provide a VERY BRIEF summary (max 2 sentences) of the patient's symptoms, reported severity, and any critical information (allergies, medications) disclosed. This summary will be used as context for the next time the patient visits.
      
      Conversation:
      ${chatMessages.map(m => `${m.role}: ${m.text}`).join('\n')}
      
      Summary:`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (summary && user?.id) {
                await savePatientSummary(user.id, summary);
                const context = await getPatientContext(user.id);
                setPatientContext(context); // Refresh context
            }
        } catch (e) {
            console.error('Failed to summarize session', e);
        }
    };

    const startSession = async () => {
        try {
            setStatus(ConnectionStatus.CONNECTING);
            setError(null);

            const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || '' });

            // Initialize Audio Contexts
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isSecure = window.isSecureContext;
                throw new Error(
                    !isSecure
                        ? 'Camera/Microphone access requires a secure context (HTTPS or localhost). Please check your URL.'
                        : 'Your browser does not support audio capture or it is disabled.'
                );
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const sessionPromise = ai.live.connect({
                model: MODEL_NAME,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION + (patientContext ? `\n\nPAST PATIENT CONTEXT (USE THIS TO REMEMBER PREVIOUS INTERACTIONS):\n${patientContext}` : ''),
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        setStatus(ConnectionStatus.CONNECTED);
                        console.log('Live Session Opened');

                        // Stream microphone to model
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);

                            const volume = inputData.reduce((acc, val) => acc + Math.abs(val), 0) / inputData.length;
                            setIsUserSpeaking(volume > 0.01);

                            sessionPromise.then(session => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputText.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputText.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            if (currentInputText.current) addMessage('user', currentInputText.current);
                            if (currentOutputText.current) addMessage('assistant', currentOutputText.current);
                            currentInputText.current = '';
                            currentOutputText.current = '';
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            setIsAssistantSpeaking(true);
                            const ctx = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                            const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);

                            source.onended = () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) setIsAssistantSpeaking(false);
                            };

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            stopAllAudio();
                        }
                    },
                    onerror: (e) => {
                        console.error('Session Error:', e);
                        setStatus(ConnectionStatus.ERROR);
                        setError('Communication error with the medical AI.');
                    },
                    onclose: () => {
                        console.log('Session Closed');
                        cleanup();
                    }
                }
            });

            sessionRef.current = await sessionPromise;

        } catch (err: any) {
            console.error('Start Session Failed:', err);
            setStatus(ConnectionStatus.ERROR);
            setError(err.message || 'Failed to initialize session.');
        }
    };

    const cleanup = () => {
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (inputAudioContextRef.current) inputAudioContextRef.current.close();
        if (outputAudioContextRef.current) outputAudioContextRef.current.close();
        stopAllAudio();
        setStatus(ConnectionStatus.DISCONNECTED);
        sessionRef.current = null;

        if (messages.length > 0 && user?.id) {
            saveChatHistory(user.id, messages);
            summarizeSession(messages);
        }
    };

    const endSession = () => {
        if (sessionRef.current) {
            sessionRef.current.close();
        }
        cleanup();
    };

    useEffect(() => {
        const loadContext = async () => {
            if (user?.id) {
                const context = await getPatientContext(user.id);
                setPatientContext(context);
            }
        };
        loadContext();
        return () => cleanup();
    }, [user]);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 p-2 text-center text-xs font-medium text-amber-800">
                ⚠️ IMPORTANT: This is an AI assistant, not a doctor. In case of emergency, call 911 immediately.
            </div>

            {patientContext && (
                <div className="bg-blue-600 text-white px-4 py-2 text-xs flex justify-between items-center">
                    <span className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        SymptomSage has context from your previous visits.
                    </span>
                    <button
                        onClick={async () => {
                            if (confirm('Clear all session memory?') && user?.id) {
                                await clearAllMemory(user.id);
                                setPatientContext('');
                            }
                        }}
                        className="hover:underline font-bold"
                    >
                        Clear Memory
                    </button>
                </div>
            )}

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">SymptomSage AI</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${status === ConnectionStatus.CONNECTED ? 'bg-green-100 text-green-700' :
                        status === ConnectionStatus.CONNECTING ? 'bg-blue-100 text-blue-700' :
                            status === ConnectionStatus.ERROR ? 'bg-red-100 text-red-700' :
                                'bg-slate-200 text-slate-600'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' :
                            status === ConnectionStatus.CONNECTING ? 'bg-blue-500 animate-pulse' :
                                status === ConnectionStatus.ERROR ? 'bg-red-500' :
                                    'bg-slate-400'
                            }`} />
                        {status}
                    </div>
                    <button
                        onClick={() => setShowDocs(true)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        title="Documentation"
                    >
                        <BookOpen className="w-6 h-6" />
                    </button>
                    <div className="pl-2 border-l border-slate-200">
                        <UserButton afterSignOutUrl="/" />
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 max-w-7xl mx-auto w-full overflow-hidden">
                <section className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="font-semibold text-slate-700">Live Consultation Transcript</h2>
                        <button
                            onClick={() => setMessages([])}
                            className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            Clear Log
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-slate-800">No session active</h3>
                                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                        Press "Start Voice Triage" to begin describing your symptoms through voice.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-slate-100 text-slate-800 rounded-tl-none'
                                        }`}>
                                        {msg.text}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                        {msg.role === 'user' ? 'You' : 'SymptomSage'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                        {(currentInputText.current || currentOutputText.current) && (
                            <div className="opacity-60 italic text-sm animate-pulse text-slate-500">
                                Typing...
                            </div>
                        )}
                    </div>
                </section>

                <section className="w-full md:w-80 flex flex-col gap-6 shrink-0">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center space-y-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Voice Interaction</h3>

                        <div className="relative">
                            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isUserSpeaking ? 'border-blue-500 scale-105 shadow-lg shadow-blue-100' :
                                isAssistantSpeaking ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-100' :
                                    'border-slate-100'
                                }`}>
                                {status === ConnectionStatus.CONNECTED ? (
                                    <div className="flex flex-col items-center">
                                        <LiveVisualizer
                                            isActive={isUserSpeaking || isAssistantSpeaking}
                                            color={isUserSpeaking ? 'bg-blue-500' : 'bg-indigo-500'}
                                        />
                                        <span className="text-[10px] mt-2 font-bold uppercase tracking-tighter text-slate-400">
                                            {isUserSpeaking ? 'User Listening' : isAssistantSpeaking ? 'AI Speaking' : 'Idle'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-slate-300">
                                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            {status !== ConnectionStatus.CONNECTED ? (
                                <button
                                    onClick={startSession}
                                    disabled={status === ConnectionStatus.CONNECTING}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {status === ConnectionStatus.CONNECTING ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Connecting...
                                        </span>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Start Voice Triage
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={endSession}
                                    className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                                    </svg>
                                    End Consultation
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">How to use</h3>
                        <ul className="text-sm text-slate-600 space-y-2.5">
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">1.</span>
                                Speak naturally about what's bothering you.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">2.</span>
                                Mention when symptoms started and their severity.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">3.</span>
                                Listen for follow-up questions from the AI.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">4.</span>
                                The AI will provide a triage assessment.
                            </li>
                        </ul>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 animate-in fade-in slide-in-from-top-4">
                            <div className="flex gap-2 font-bold mb-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Error
                            </div>
                            {error}
                            <button
                                onClick={startSession}
                                className="block mt-2 font-bold underline hover:no-underline"
                            >
                                Try Reconnecting
                            </button>
                        </div>
                    )}
                </section>
            </main>

            <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-[10px] text-slate-400 shrink-0">
                &copy; {new Date().getFullYear()} SymptomSage AI. Powering conversational triage with Gemini 2.5 Native Audio.
                Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
            </footer>

            {showDocs && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">SymptomSage AI Documentation</h2>
                            <button
                                onClick={() => setShowDocs(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6 text-slate-600 leading-relaxed">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Introduction</h3>
                                <p>SymptomSage AI is a state-of-the-art medical triage assistant powered by Gemini 2.5. It uses real-time audio to interact with users, helping them understand their health symptoms and directing them to the appropriate level of care.</p>
                            </section>

                            <section className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h3 className="text-lg font-bold text-blue-900 mb-2 font-mono uppercase text-sm tracking-widest">Training & Memory</h3>
                                <p className="text-blue-800 text-sm">SymptomSage features a local "memory" system. After each session, the AI generates a concise summary of the conversation. These summaries are stored securely in your browser's local storage.</p>
                                <ul className="list-disc ml-5 mt-2 text-blue-800 text-sm space-y-1">
                                    <li><strong>Continuity:</strong> The next time you call, SymptomSage reads these summaries to remember your past symptoms and medical history.</li>
                                    <li><strong>Privacy:</strong> All data stays on your device. Clearing browser data or clicking "Clear Memory" removes everything.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">How it Works</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <div className="font-bold text-blue-600 mb-1">1. Audio Stream</div>
                                        <p className="text-xs">Captures your voice and streams it to Gemini for immediate response.</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <div className="font-bold text-blue-600 mb-1">2. Triage Logic</div>
                                        <p className="text-xs">Follows clinical triage guidelines to assess severity and urgency.</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <div className="font-bold text-blue-600 mb-1">3. Summarization</div>
                                        <p className="text-xs">Distills the conversation into actionable medical context for future visits.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="border-t pt-4">
                                <p className="text-xs text-slate-400">Disclaimer: SymptomSage is for informational purposes only. It is not a clinical tool and cannot provide official medical diagnoses.</p>
                            </section>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowDocs(false)}
                                className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
