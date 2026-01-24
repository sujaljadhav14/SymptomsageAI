import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioHelpers';
import LiveVisualizer from './LiveVisualizer';
import NotificationPanel from './NotificationPanel';
import OfflineAssessmentView from '../views/OfflineAssessmentView';
import NearbyFacilitiesCardSimple from './NearbyFacilitiesCardSimple';
import { Message, ConnectionStatus, ClinicalReport, Notification, NotificationType } from '../types';
import { saveChatHistory, savePatientSummary, getPatientContext, clearAllMemory, getLatestReport, getAllReports, ClinicalReportRecord } from '../utils/storage';
import { useUser, UserButton } from '@clerk/clerk-react';
import { LogOut, BookOpen, Activity, History, MessageSquare, Download, ChevronRight, Search, Clock, Home, Bell, Sparkles, ArrowRight, Zap, Heart, Sun, Moon, CloudSun, ClipboardList } from 'lucide-react';

const MODEL_NAME = 'gemini-2.0-flash-exp';
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
    const [latestReport, setLatestReport] = useState<ClinicalReport | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [activeView, setActiveView] = useState<'home' | 'consultation' | 'reports' | 'assessment'>('home');
    const [allReports, setAllReports] = useState<ClinicalReportRecord[]>([]);
    const [selectedReport, setSelectedReport] = useState<ClinicalReportRecord | null>(null);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // AI-powered features state
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [aiGreeting, setAiGreeting] = useState('');
    const [healthTips, setHealthTips] = useState<string[]>([]);
    const [isLoadingTips, setIsLoadingTips] = useState(false);

    // Audio Context Refs
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const cleanupRef = useRef(false);

    // Transcription storage
    const currentInputText = useRef('');
    const currentOutputText = useRef('');
    const messagesRef = useRef<Message[]>([]);

    const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
        if (!text.trim()) return;
        const newMessage = {
            id: Math.random().toString(36).substring(7),
            role,
            text,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
        messagesRef.current = [...messagesRef.current, newMessage];
    }, []);

    const stopAllAudio = () => {
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsAssistantSpeaking(false);
    };

    const downloadReport = (reportToDownload?: ClinicalReport) => {
        const report = reportToDownload || latestReport;
        if (!report) return;

        const content = `
SYMPTOMSAGE AI - CLINICAL TRIAGE REPORT
Generated on: ${new Date().toLocaleString()}
-------------------------------------------

SEVERITY: ${report.severity.toUpperCase()}

SUMMARY:
${report.summary}

PRECAUTIONS:
${report.precautions.map(p => `- ${p}`).join('\n')}

GENERAL TESTS:
${report.recommendedTests.map(t => `- ${t}`).join('\n')}

CLINICAL DIFFERENTIATOR:
${report.differentiation}

-------------------------------------------
DISCLAIMER: This report is AI-generated for informational purposes and does not constitute a medical diagnosis. Always seek professional medical advice.
        `.trim();

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SymptomSage_Report_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const fetchReports = useCallback(async () => {
        if (!user?.id) return;
        setIsLoadingReports(true);
        const reports = await getAllReports(user.id);
        setAllReports(reports);
        setIsLoadingReports(false);
    }, [user?.id]);

    useEffect(() => {
        if (activeView === 'reports') {
            fetchReports();
        }
    }, [activeView, fetchReports]);

    const summarizeSession = async (chatMessages: Message[]) => {
        if (chatMessages.length < 1) return;

        setIsGeneratingReport(true);
        console.log('--- DEBUG: GENERATING REPORT V4 (GEMINI 2.0 SINGLE MODEL) ---');

        try {
            const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
            if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
                console.warn('API Key not set. Skipping summarization.');
                setIsGeneratingReport(false);
                return;
            }

            const prompt = `Based on the following medical triage conversation, provide a detailed structured report.
            
            Return a valid JSON object with the following structure:
            {
              "summary": "2-sentence overview of symptoms and severity",
              "precautions": ["list", "of", "immediate", "medical", "precautions"],
              "severity": "low" | "medium" | "high" | "emergency",
              "recommendedTests": ["list", "of", "general", "medical", "tests", "that", "might", "be", "needed"],
              "differentiation": "What makes this case different or unique based on the patient's description"
            }
      
            Conversation:
            ${chatMessages.map(m => `${m.role}: ${m.text}`).join('\n')}
      
            Return ONLY the raw JSON.`;

            // Use v1beta for gemini-2.0-flash-exp
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Gemini API Error Response:', data);
                setError(`API Error: ${data.error?.message || 'Failed to connect to Gemini 2.0'}`);
                return;
            }

            const reportResultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (reportResultText && user?.id) {
                try {
                    // Extract JSON if model wraps it in markdown blocks
                    const jsonMatch = reportResultText.match(/\{[\s\S]*\}/);
                    const cleanedJson = jsonMatch ? jsonMatch[0] : reportResultText.replace(/```json\n?|\n?```/g, '').trim();
                    const report: ClinicalReport = JSON.parse(cleanedJson);

                    console.log('Successfully generated clinical report. Saving to Supabase...');
                    await savePatientSummary(user.id, report);

                    setLatestReport(report);
                    setShowReport(true);

                    const context = await getPatientContext(user.id);
                    setPatientContext(context);
                    fetchReports();
                } catch (e) {
                    console.warn('Failed to parse report JSON. Saving as raw text instead.', reportResultText);
                    // Create a pseudo-report object for raw text so UI doesn't crash
                    const fallbackReport: ClinicalReport = {
                        summary: reportResultText,
                        precautions: ["Review audio transcript for specific advice"],
                        severity: 'medium',
                        recommendedTests: [],
                        differentiation: "Non-structured report format"
                    };
                    await savePatientSummary(user.id, fallbackReport);
                    setLatestReport(fallbackReport);
                    setShowReport(true);
                    fetchReports();
                }
            } else {
                console.warn('No report content received from Gemini.');
                setError('Failed to generate clinical report. Please try again.');
            }
        } catch (e: any) {
            console.error('Failed to summarize session:', e);
            setError(`Summarization error: ${e.message || 'Unknown error'}`);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // AI Helper Functions
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return { text: 'Good Morning', icon: Sun };
        if (hour < 17) return { text: 'Good Afternoon', icon: CloudSun };
        return { text: 'Good Evening', icon: Moon };
    };

    const generateAIGreeting = useCallback(() => {
        const greeting = getTimeBasedGreeting();
        const firstName = user?.firstName || 'there';
        setAiGreeting(`${greeting.text}, ${firstName}! 👋`);
    }, [user?.firstName]);

    const generateHealthTips = useCallback(() => {
        if (isLoadingTips) return;
        setIsLoadingTips(true);

        try {
            // Use latestReport state (already fetched) to personalize tips
            if (latestReport) {
                // Generate tips based on previous report conditions
                const tips: string[] = [];
                const severity = latestReport.severity;
                const precautions = latestReport.precautions || [];

                // Add tips based on severity
                if (severity === 'high' || severity === 'emergency') {
                    tips.push("Follow up with your healthcare provider as recommended");
                } else if (severity === 'medium') {
                    tips.push("Monitor your symptoms and rest when needed");
                }

                // Add tips based on precautions (simplified from report)
                if (precautions.length > 0) {
                    const shortPrecaution = precautions[0].slice(0, 60);
                    tips.push(shortPrecaution.endsWith('.') ? shortPrecaution : shortPrecaution + '...');
                }

                // Add general wellness tip
                tips.push("Stay hydrated and get adequate rest for recovery");

                setHealthTips(tips.slice(0, 3));
            } else {
                // No previous reports - show static general health tips
                const staticTips = [
                    "Stay hydrated by drinking at least 8 glasses of water daily",
                    "Take short breaks every hour if working at a desk",
                    "Aim for 7-9 hours of quality sleep each night",
                    "Practice mindful breathing for stress relief",
                    "Regular movement helps boost energy levels",
                    "Eat a balanced diet rich in fruits and vegetables"
                ];

                // Randomly pick 3 tips for variety
                const shuffled = staticTips.sort(() => 0.5 - Math.random());
                setHealthTips(shuffled.slice(0, 3));
            }
        } catch (e) {
            console.warn('Failed to generate health tips:', e);
            setHealthTips([
                "Stay hydrated throughout the day",
                "Practice mindful breathing for stress relief",
                "Regular movement helps boost energy levels"
            ]);
        } finally {
            setIsLoadingTips(false);
        }
    }, [isLoadingTips, latestReport]);

    const generateNotifications = useCallback(() => {
        const newNotifications: Notification[] = [];

        // Add follow-up notification if there's a recent report
        if (latestReport) {
            newNotifications.push({
                id: 'follow-up-1',
                type: NotificationType.FOLLOW_UP,
                title: 'Assessment Follow-up',
                message: `Your last assessment indicated ${latestReport.severity} severity. Remember to monitor your symptoms.`,
                timestamp: new Date(),
                isRead: false
            });

            if (latestReport.precautions.length > 0) {
                newNotifications.push({
                    id: 'reminder-1',
                    type: NotificationType.REMINDER,
                    title: 'Health Reminder',
                    message: latestReport.precautions[0],
                    timestamp: new Date(),
                    isRead: false
                });
            }
        }

        // Add general health tip
        newNotifications.push({
            id: 'tip-1',
            type: NotificationType.HEALTH_TIP,
            title: 'Daily Wellness Tip',
            message: 'Regular health check-ins help you stay ahead of potential issues. Consider scheduling periodic assessments.',
            timestamp: new Date(),
            isRead: false
        });

        // Add insight if user has multiple reports
        if (allReports.length >= 2) {
            newNotifications.push({
                id: 'insight-1',
                type: NotificationType.INSIGHT,
                title: 'Health Trend',
                message: `You've completed ${allReports.length} assessments. SymptomSage is building a comprehensive view of your health.`,
                timestamp: new Date(),
                isRead: false
            });
        }

        setNotifications(newNotifications);
    }, [latestReport, allReports.length]);

    const markNotificationAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    };

    const startSession = async () => {
        try {
            cleanupRef.current = false;
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
                        console.error('Detailed Session Error:', e);
                        setStatus(ConnectionStatus.ERROR);
                        setError(`AI Error: ${e.message || 'Communication error'}`);
                    },
                    onclose: (e: any) => {
                        console.log('Session Closed Event:', e);
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
        if (cleanupRef.current) return;
        cleanupRef.current = true;

        console.log('Starting session cleanup...');
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (inputAudioContextRef.current) inputAudioContextRef.current.close();
        if (outputAudioContextRef.current) outputAudioContextRef.current.close();
        stopAllAudio();
        setStatus(ConnectionStatus.DISCONNECTED);
        sessionRef.current = null;

        // Flush any pending transcription before closing
        const finalMessages = [...messagesRef.current];
        if (currentInputText.current) {
            finalMessages.push({
                id: 'final-user',
                role: 'user',
                text: currentInputText.current,
                timestamp: new Date()
            });
            currentInputText.current = '';
        }
        if (currentOutputText.current) {
            finalMessages.push({
                id: 'final-assistant',
                role: 'assistant',
                text: currentOutputText.current,
                timestamp: new Date()
            });
            currentOutputText.current = '';
        }

        if (finalMessages.length > 0 && user?.id) {
            console.log('Finalizing session with', finalMessages.length, 'messages');
            saveChatHistory(user.id, finalMessages);
            summarizeSession(finalMessages);
        } else {
            console.warn('No messages to summarize or user not authenticated');
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
                const report = await getLatestReport(user.id);
                setLatestReport(report);
            }
        };
        loadContext();
        return () => cleanup();
    }, [user]);

    // Initialize AI features when on home view
    useEffect(() => {
        if (activeView === 'home') {
            generateAIGreeting();
            generateHealthTips();
            generateNotifications();
        }
    }, [activeView, generateAIGreeting, generateHealthTips, generateNotifications]);

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 leading-none">SymptomSage</h1>
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Medical AI</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <button
                        onClick={() => setActiveView('home')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeView === 'home'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                    >
                        <Home className={`w-5 h-5 ${activeView === 'home' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        <span className="font-semibold">Home</span>
                    </button>
                    <button
                        onClick={() => setActiveView('consultation')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeView === 'consultation'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                    >
                        <MessageSquare className={`w-5 h-5 ${activeView === 'consultation' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        <span className="font-semibold">Consultation</span>
                    </button>
                    <button
                        onClick={() => setActiveView('reports')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeView === 'reports'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                    >
                        <History className={`w-5 h-5 ${activeView === 'reports' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        <span className="font-semibold">Reports History</span>
                    </button>
                    <button
                        onClick={() => setActiveView('assessment')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeView === 'assessment'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                    >
                        <ClipboardList className={`w-5 h-5 ${activeView === 'assessment' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'}`} />
                        <span className="font-semibold">Low Network</span>
                        <span className="ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded uppercase">Offline</span>
                    </button>

                    <div className="pt-6 pb-2 px-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resources</span>
                    </div>
                    <button
                        onClick={() => setShowDocs(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 group"
                    >
                        <BookOpen className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                        <span className="font-semibold">Documentation</span>
                    </button>

                    {patientContext && (
                        <div className="mt-8 mx-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <div className="flex items-center gap-2 mb-2 text-blue-700">
                                <Activity className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Clinical Memory</span>
                            </div>
                            <p className="text-[10px] text-blue-600 leading-relaxed mb-3">
                                SymptomSage is using context from your previous 5 assessments.
                            </p>
                            <button
                                onClick={async () => {
                                    if (confirm('Clear all clinical memory?') && user?.id) {
                                        await clearAllMemory(user.id);
                                        setPatientContext('');
                                        setAllReports([]);
                                        setLatestReport(null);
                                    }
                                }}
                                className="w-full py-2 bg-white text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm"
                            >
                                Clear Clinical History
                            </button>
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <UserButton afterSignOutUrl="/" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{user?.firstName || 'User'}</p>
                            <p className="text-[10px] text-slate-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="bg-amber-50 border-b border-amber-200 p-2 text-center text-[10px] font-medium text-amber-800 sticky top-0 z-10">
                    ⚠️ IMPORTANT: AI assistant only. In case of emergency, call 911 immediately.
                </div>

                {/* Notification Panel */}
                <NotificationPanel
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    notifications={notifications}
                    onMarkAsRead={markNotificationAsRead}
                />

                {activeView === 'home' ? (
                    <>
                        {/* Home Header */}
                        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-800">SymptomSage</h1>
                                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">AI Health Assistant</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNotifications(true)}
                                className="relative p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group"
                            >
                                <Bell className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                                {notifications.filter(n => !n.isRead).length > 0 && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                )}
                            </button>
                        </header>

                        <main className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* AI Greeting */}
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-bold text-slate-800">
                                        {aiGreeting || 'Welcome back! 👋'}
                                    </h2>
                                    <p className="text-slate-500">
                                        How can SymptomSage help you today?
                                    </p>
                                </div>

                                {/* Primary & Secondary CTAs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setActiveView('consultation')}
                                        className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-200 hover:shadow-2xl hover:shadow-blue-300 transition-all active:scale-[0.98]"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                                        <div className="relative">
                                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                                                <Activity className="w-7 h-7" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">Start Health Assessment</h3>
                                            <p className="text-white/70 text-sm mb-4">
                                                Begin a voice-guided consultation with our AI triage assistant
                                            </p>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <span>Start Now</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setActiveView('reports')}
                                        className="group relative overflow-hidden bg-white border-2 border-slate-200 p-8 rounded-3xl hover:border-blue-200 hover:shadow-xl transition-all active:scale-[0.98]"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 translate-x-1/2" />
                                        <div className="relative">
                                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                                                <History className="w-7 h-7 text-slate-600 group-hover:text-blue-600" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-2">View Previous Reports</h3>
                                            <p className="text-slate-500 text-sm mb-4">
                                                Access your clinical triage history and assessments
                                            </p>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                                                <span>View All</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* AI Health Tips */}
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                            <Sparkles className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">AI Health Tips</h3>
                                            <p className="text-xs text-slate-500">Personalized wellness suggestions</p>
                                        </div>
                                    </div>
                                    {isLoadingTips ? (
                                        <div className="flex items-center gap-3 text-amber-600">
                                            <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                                            <span className="text-sm">Generating personalized tips...</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {healthTips.map((tip, index) => (
                                                <div key={index} className="bg-white/70 p-4 rounded-xl border border-amber-100/50">
                                                    <div className="flex items-start gap-2">
                                                        <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                        <p className="text-sm text-slate-700">{tip}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Quick Insights from Latest Report */}
                                {latestReport && (
                                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                                    <Heart className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">Latest Assessment</h3>
                                                    <p className="text-xs text-slate-500">Quick insights from your recent consultation</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${latestReport.severity === 'emergency' ? 'bg-red-100 text-red-700' :
                                                latestReport.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                                    latestReport.severity === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                }`}>
                                                {latestReport.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-2">
                                            {latestReport.summary}
                                        </p>
                                        <button
                                            onClick={() => setShowReport(true)}
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            View Full Report
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </main>
                    </>
                ) : activeView === 'consultation' ? (
                    <>
                        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0">
                            <h2 className="text-xl font-bold text-slate-800">Voice Consultation</h2>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${status === ConnectionStatus.CONNECTED ? 'bg-green-50 text-green-700 ring-green-200' :
                                status === ConnectionStatus.CONNECTING ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                                    status === ConnectionStatus.ERROR ? 'bg-red-50 text-red-700 ring-red-200' :
                                        'bg-slate-100 text-slate-500 ring-slate-200'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' :
                                    status === ConnectionStatus.CONNECTING ? 'bg-blue-500 animate-pulse' :
                                        status === ConnectionStatus.ERROR ? 'bg-red-500' :
                                            'bg-slate-400'
                                    }`} />
                                {status}
                            </div>
                        </header>

                        <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
                            <section className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                    <h3 className="font-semibold text-slate-700 text-sm">Real-time Transcript</h3>
                                    <div className="flex items-center gap-3">
                                        {latestReport && (
                                            <button
                                                onClick={() => setShowReport(true)}
                                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                Latest Report
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setMessages([])}
                                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
                                        >
                                            Clear Log
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                                            <div className="relative">
                                                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 animate-pulse">
                                                    <MessageSquare className="w-10 h-10" />
                                                </div>
                                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center border border-slate-100">
                                                    <Activity className="w-4 h-4 text-green-500" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to Assist</h3>
                                                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                                                    Press the button below to start your voice-guided medical triage. SymptomSage will listen and assess your symptoms.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm text-sm ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                                <span className="text-[10px] text-slate-400 mt-1.5 px-2 font-medium">
                                                    {msg.role === 'user' ? 'Patient' : 'SymptomSage AI'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                    {(currentInputText.current || currentOutputText.current) && (
                                        <div className="flex gap-2 items-center text-blue-500 px-4 py-2 bg-blue-50 rounded-full w-fit animate-pulse border border-blue-100">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                            <span className="text-xs font-bold uppercase tracking-wider">AI Processing...</span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="w-full md:w-80 flex flex-col gap-6 shrink-0">
                                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <Activity className="w-24 h-24" />
                                    </div>

                                    <div className="text-center">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Interaction</h3>
                                        <p className="text-base font-bold text-slate-800">Voice Control</p>
                                    </div>

                                    <div className="relative group">
                                        <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${isUserSpeaking ? 'border-blue-500 scale-110 shadow-2xl shadow-blue-100 bg-blue-50/30' :
                                            isAssistantSpeaking ? 'border-indigo-500 scale-110 shadow-2xl shadow-indigo-100 bg-indigo-50/30' :
                                                'border-slate-100 bg-slate-50/20'
                                            }`}>
                                            {status === ConnectionStatus.CONNECTED ? (
                                                <div className="flex flex-col items-center">
                                                    <LiveVisualizer
                                                        isActive={isUserSpeaking || isAssistantSpeaking}
                                                        color={isUserSpeaking ? 'bg-blue-500' : 'bg-indigo-500'}
                                                    />
                                                    <div className="mt-4 flex flex-col items-center">
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isUserSpeaking ? 'text-blue-600' : isAssistantSpeaking ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                            {isUserSpeaking ? 'Listening' : isAssistantSpeaking ? 'Speaking' : 'Waiting'}
                                                        </span>
                                                        <div className="flex gap-1 mt-1">
                                                            {[1, 2, 3].map(i => (
                                                                <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${isUserSpeaking || isAssistantSpeaking ? 'bg-current h-2 animate-bounce' : 'bg-slate-200'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-slate-200 group-hover:text-slate-300 transition-colors">
                                                    <Activity className="w-16 h-16 stroke-[1.5]" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        {status !== ConnectionStatus.CONNECTED ? (
                                            <button
                                                onClick={startSession}
                                                disabled={status === ConnectionStatus.CONNECTING}
                                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                                            >
                                                {status === ConnectionStatus.CONNECTING ? (
                                                    <>
                                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Initializing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                        Start Consultation
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={endSession}
                                                className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-red-100/50 flex items-center justify-center">
                                                    <div className="w-3 h-3 bg-red-600 rounded-sm" />
                                                </div>
                                                Stop Session
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-100">
                                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Patient Guidelines</h3>
                                    <ul className="text-xs space-y-4">
                                        <li className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                                            <p className="leading-relaxed text-white/90">Describe your primary symptoms clearly and concisely.</p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                                            <p className="leading-relaxed text-white/90">Mention when the symptoms started and any relevant history.</p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                                            <p className="leading-relaxed text-white/90">Answer the AI's clarifying questions to help the assessment.</p>
                                        </li>
                                    </ul>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-sm text-red-700 animate-in fade-in slide-in-from-top-4">
                                        <div className="flex items-center gap-2 font-bold mb-2">
                                            <Activity className="w-5 h-5 text-red-500" />
                                            Connection Refused
                                        </div>
                                        <p className="text-xs opacity-80 leading-relaxed mb-4">{error}</p>
                                        <button
                                            onClick={startSession}
                                            className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl transition-colors text-xs"
                                        >
                                            Try Reconnecting
                                        </button>
                                    </div>
                                )}
                            </section>
                        </main>
                    </>
                ) : activeView === 'reports' ? (
                    <>
                        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-6 flex items-center justify-between shrink-0 sticky top-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Reports History</h2>
                                <p className="text-sm text-slate-500">Access and manage your clinical triage assessments</p>
                            </div>
                            <div className="bg-blue-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-blue-100">
                                <History className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-bold text-blue-700">{allReports.length} Reports Found</span>
                            </div>
                        </header>

                        <main className="flex-1 overflow-y-auto p-8 relative">
                            {isLoadingReports ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Activity className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                                    <p className="text-slate-500 font-medium">Loading your medical history...</p>
                                </div>
                            ) : allReports.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6">
                                    <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300">
                                        <Search className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Reports Yet</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Your clinical reports will appear here after you complete a consultation session.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setActiveView('consultation')}
                                        className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all text-sm"
                                    >
                                        Start Your First Session
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {allReports.map((record) => (
                                        <div
                                            key={record.id}
                                            className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden flex flex-col"
                                        >
                                            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}>
                                                <Activity className="w-20 h-20" />
                                            </div>

                                            <div className="flex items-start justify-between mb-6">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                            {new Date(record.timestamp).toLocaleDateString(undefined, {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-slate-800 leading-tight pr-8">Triage Assessment</h4>
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${record.report.severity === 'emergency' ? 'bg-red-50 text-red-600 ring-1 ring-red-100' :
                                                    record.report.severity === 'high' ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100' :
                                                        'bg-green-50 text-green-600 ring-1 ring-green-100'
                                                    }`}>
                                                    {record.report.severity}
                                                </div>
                                            </div>

                                            <p className="text-sm text-slate-600 line-clamp-3 mb-6 flex-1 leading-relaxed">
                                                {record.report.summary}
                                            </p>

                                            <div className="flex items-center gap-2 pt-6 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        setSelectedReport(record);
                                                        setShowReport(true);
                                                        setLatestReport(record.report);
                                                    }}
                                                    className="flex-1 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                                                >
                                                    <Search className="w-3.5 h-3.5" />
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => downloadReport(record.report)}
                                                    className="p-2.5 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all border border-slate-200 active:scale-95"
                                                    title="Download Report"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </main>
                    </>
                ) : activeView === 'assessment' ? (
                    <OfflineAssessmentView />
                ) : null}
            </div>

            {/* Loading Overlay for Report Generation */}
            {isGeneratingReport && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <Activity className="absolute inset-0 m-auto w-10 h-10 text-blue-600 animate-pulse" />
                    </div>
                    <div className="mt-8 text-center">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Consultation...</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            SymptomSage is generating your clinical triage assessment. This will take just a few seconds.
                        </p>
                    </div>
                    <div className="mt-12 flex gap-4">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    </div>
                </div>
            )}

            {/* Modals & Overlays */}
            {showDocs && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">SymptomSage AI Documentation</h2>
                            <button
                                onClick={() => setShowDocs(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
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

                            <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <h3 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-widest">Medical History & Retrieval</h3>
                                <p className="text-blue-800 text-sm">SymptomSage remembers your past visits to provide better clinical context. For every assessment, our AI retrieves up to 5 previous session summaries securely stored in your history.</p>
                                <ul className="list-disc ml-5 mt-4 text-blue-800 text-[11px] space-y-2 opacity-80">
                                    <li><strong>Continuity:</strong> Your symptoms are tracked over time.</li>
                                    <li><strong>Data Privacy:</strong> All assessments are stored in your private history.</li>
                                    <li><strong>Control:</strong> You can clear your entire history at any time.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">How it Works</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="font-bold text-blue-600 mb-1 text-xs uppercase tracking-tighter">1. Voice Stream</div>
                                        <p className="text-xs">Captures your voice and streams it to Gemini for immediate response.</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="font-bold text-blue-600 mb-1 text-xs uppercase tracking-tighter">2. Triage Logic</div>
                                        <p className="text-xs">Assesses severity, urgency, and necessary precautions.</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="font-bold text-blue-600 mb-1 text-xs uppercase tracking-tighter">3. Clinical Report</div>
                                        <p className="text-xs">Generates a detailed summary and recommended tests.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="border-t border-slate-100 pt-6">
                                <p className="text-[10px] text-slate-400 italic">Disclaimer: SymptomSage is for informational purposes only. It is not a clinical tool and cannot provide official medical diagnoses.</p>
                            </section>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowDocs(false)}
                                className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 shadow-lg shadow-slate-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showReport && latestReport && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
                            <div className="flex items-center gap-3">
                                <Activity className="w-6 h-6" />
                                <h2 className="text-xl font-bold">Generated Clinical Report</h2>
                            </div>
                            <button
                                onClick={() => setShowReport(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-8">
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${latestReport.severity === 'emergency' ? 'bg-red-100 text-red-700' :
                                        latestReport.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                            latestReport.severity === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                'bg-green-100 text-green-700'
                                        }`}>
                                        Severity: {latestReport.severity}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Summary</h3>
                                <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {latestReport.summary}
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Precautions</h3>
                                    <ul className="space-y-2">
                                        {latestReport.precautions.map((item, i) => (
                                            <li key={i} className="flex gap-3 text-sm text-slate-700 bg-red-50/50 p-2.5 rounded-lg border border-red-100/50">
                                                <span className="text-red-500 font-bold">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">General Tests</h3>
                                    <ul className="space-y-2">
                                        {latestReport.recommendedTests.map((item, i) => (
                                            <li key={i} className="flex gap-3 text-sm text-slate-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                                                <span className="text-blue-500 font-bold">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>

                            <section className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                <h3 className="text-sm font-bold text-amber-800 uppercase tracking-widest mb-3">Clinical Differentiator</h3>
                                <p className="text-amber-900 text-sm italic leading-relaxed">
                                    "{latestReport.differentiation}"
                                </p>
                            </section>

                            <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 text-center uppercase tracking-tighter">
                                    DISCLAIMER: This report is AI-generated for informational purposes and does not constitute a medical diagnosis.
                                </p>
                            </section>

                            {/* Nearby Facilities */}
                            <NearbyFacilitiesCardSimple
                                recommendedTests={latestReport.recommendedTests}
                                severity={latestReport.severity}
                            />
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={downloadReport}
                                className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download (TXT)
                            </button>
                            <button
                                onClick={() => setShowReport(false)}
                                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 shadow-lg shadow-slate-200"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
