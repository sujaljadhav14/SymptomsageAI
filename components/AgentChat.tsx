/**
 * AgentChat.tsx
 *
 * Full-featured streaming chat UI wired to the SymptomSage multi-agent backend.
 * Features:
 *  - Streams tokens in real time (no waiting for full response)
 *  - Live tool activity indicators (tool_start / tool_end events)
 *  - HITL follow-up: agent pauses → asks question → user answers → resumes
 *  - Agent health check banner (warns when backend is down)
 *  - Multi-turn: same session_id persists across messages
 *  - Image upload support (forwarded to vision_agent)
 *  - Emergency 🚨 styling for red-flag responses
 *  - New session / clear chat
 */

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useId,
} from 'react';
import DOMPurify from 'dompurify';
import {
    Send, Bot, User, AlertTriangle, RefreshCw, Zap,
    Loader2, Wrench, CheckCircle2, XCircle, Image,
    Stethoscope, MessageSquare, X, WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    streamChatWithAgent,
    resumeWithAnswer,
    checkAgentHealth,
} from '../utils/agentService';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'followup-question';

interface ToolEvent {
    tool: string;
    status: 'running' | 'done' | 'error';
    result?: string;
}

interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;            // Accumulated text (streams in)
    isStreaming?: boolean;
    toolEvents?: ToolEvent[];
    imageUrl?: string;          // Base64 preview for user-uploaded images
    isEmergency?: boolean;
}

interface AgentChatProps {
    userId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEmergencyContent(text: string): boolean {
    return /🚨|call\s+(emergency|911|112|108)|life[- ]threatening/i.test(text);
}

function renderMarkdown(text: string): string {
    return DOMPurify.sanitize(
        text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^#{1,3}\s(.+)$/gm, '<strong>$1</strong>')
            .replace(/^[-•]\s(.+)$/gm, '• $1')
            .replace(/\n/g, '<br/>'),
    );
}

function newSessionId(): string {
    return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TOOL_LABELS: Record<string, string> = {
    check_red_flags: 'Checking for emergencies',
    recall_patient_history: 'Recalling your history',
    ask_followup: 'Preparing clarifying question',
    generate_triage_report: 'Generating triage report',
    save_session_summary: 'Saving session summary',
    find_nearby_facilities: 'Finding nearby facilities',
    analyze_medical_image: 'Analysing medical image',
    email_report: 'Sending email report',
};

const SUGGESTED_PROMPTS = [
    'I have a headache and mild fever since yesterday',
    'I have severe chest pain and trouble breathing',
    'My throat has been sore for 3 days, any advice?',
    'What can you help me with?',
];

// ── Component ─────────────────────────────────────────────────────────────────

const AgentChat: React.FC<AgentChatProps> = ({ userId = 'anonymous' }) => {
    const uid = useId();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string>(newSessionId);
    const [agentOnline, setAgentOnline] = useState<boolean | null>(null); // null = checking
    const [pendingFollowup, setPendingFollowup] = useState<string | null>(null);
    const [followupAnswer, setFollowupAnswer] = useState('');
    const [selectedImage, setSelectedImage] = useState<{ base64: string; preview: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const stopStreamRef = useRef<(() => void) | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Health check on mount ────────────────────────────────────────────────
    useEffect(() => {
        checkAgentHealth().then(setAgentOnline);
    }, []);

    // ── Auto-scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [messages]);

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => { stopStreamRef.current?.(); };
    }, []);

    // ── Send message ─────────────────────────────────────────────────────────
    const sendMessage = useCallback(
        (text: string, imageBase64?: string) => {
            if (!text.trim() || isStreaming) return;

            const userMsgId = `${uid}-u-${Date.now()}`;
            const assistantMsgId = `${uid}-a-${Date.now()}`;

            // Add user message
            setMessages(prev => [
                ...prev,
                {
                    id: userMsgId,
                    role: 'user',
                    content: text.trim(),
                    imageUrl: selectedImage?.preview,
                },
            ]);

            // Add empty streaming placeholder for assistant
            setMessages(prev => [
                ...prev,
                {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: '',
                    isStreaming: true,
                    toolEvents: [],
                },
            ]);

            setInput('');
            setSelectedImage(null);
            setIsStreaming(true);

            const stop = streamChatWithAgent(
                text.trim(),
                sessionId,
                userId,
                {
                    onToken(tokenText, _node) {
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, content: m.content + tokenText }
                                    : m,
                            ),
                        );
                    },
                    onToolStart(tool, _args, _node) {
                        setMessages(prev =>
                            prev.map(m => {
                                if (m.id !== assistantMsgId) return m;
                                const existing = m.toolEvents ?? [];
                                // Avoid duplicate entries for the same tool
                                if (existing.some(e => e.tool === tool && e.status === 'running')) return m;
                                return {
                                    ...m,
                                    toolEvents: [...existing, { tool, status: 'running' }],
                                };
                            }),
                        );
                    },
                    onToolEnd(tool, result, _node) {
                        setMessages(prev =>
                            prev.map(m => {
                                if (m.id !== assistantMsgId) return m;
                                return {
                                    ...m,
                                    toolEvents: (m.toolEvents ?? []).map(e =>
                                        e.tool === tool
                                            ? { ...e, status: 'done', result }
                                            : e,
                                    ),
                                };
                            }),
                        );
                    },
                    onFollowup(question, _sid) {
                        // Agent hit an interrupt — pause and ask user
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, isStreaming: false }
                                    : m,
                            ),
                        );
                        setPendingFollowup(question);
                        setIsStreaming(false);
                    },
                    onDone(answer, _sid, _msgs) {
                        setMessages(prev =>
                            prev.map(m => {
                                if (m.id !== assistantMsgId) return m;
                                const finalContent = answer || m.content;
                                return {
                                    ...m,
                                    content: finalContent,
                                    isStreaming: false,
                                    isEmergency: isEmergencyContent(finalContent),
                                };
                            }),
                        );
                        setIsStreaming(false);
                    },
                    onError(msg) {
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === assistantMsgId
                                    ? {
                                        ...m,
                                        content: m.content || `⚠️ Error: ${msg}`,
                                        isStreaming: false,
                                    }
                                    : m,
                            ),
                        );
                        setIsStreaming(false);
                    },
                },
                imageBase64,
            );

            stopStreamRef.current = stop;
        },
        [isStreaming, sessionId, userId, selectedImage, uid],
    );

    // ── Submit follow-up answer (HITL resume) ─────────────────────────────────
    const submitFollowupAnswer = useCallback(async () => {
        if (!followupAnswer.trim()) return;
        const answer = followupAnswer.trim();
        setFollowupAnswer('');
        setPendingFollowup(null);

        const assistantMsgId = `${uid}-resume-${Date.now()}`;
        setMessages(prev => [
            ...prev,
            { id: `${uid}-fu-user-${Date.now()}`, role: 'user', content: answer },
            { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true, toolEvents: [] },
        ]);
        setIsStreaming(true);

        try {
            const result = await resumeWithAnswer(sessionId, answer);
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            content: result.answer || '(No response from agent.)',
                            isStreaming: false,
                            isEmergency: isEmergencyContent(result.answer),
                        }
                        : m,
                ),
            );
        } catch (err) {
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantMsgId
                        ? { ...m, content: `⚠️ Resume failed: ${err}`, isStreaming: false }
                        : m,
                ),
            );
        } finally {
            setIsStreaming(false);
        }
    }, [followupAnswer, sessionId, uid]);

    // ── Image handling ────────────────────────────────────────────────────────
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target?.result as string;
            const base64 = dataUrl.split('base64,')[1];
            setSelectedImage({ base64, preview: dataUrl });
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // ── New session ───────────────────────────────────────────────────────────
    const startNewSession = () => {
        stopStreamRef.current?.();
        setMessages([]);
        setSessionId(newSessionId());
        setIsStreaming(false);
        setPendingFollowup(null);
        setSelectedImage(null);
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input, selectedImage?.base64);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold">AI Agent Chat</h3>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    agentOnline === null ? 'bg-yellow-300 animate-pulse' :
                                    agentOnline ? 'bg-green-300' : 'bg-red-400'
                                }`} />
                                <p className="text-xs text-white/70">
                                    {agentOnline === null ? 'Connecting…' :
                                     agentOnline ? 'Multi-agent backend online' :
                                     'Backend offline — check services/agent'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={startNewSession}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Start new session"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Offline warning banner */}
            {agentOnline === false && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
                    <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                        Agent backend is not reachable. Run{' '}
                        <code className="font-mono bg-amber-100 px-1 rounded">
                            uv run uvicorn app.main:app --reload --port 8000
                        </code>{' '}
                        in <code className="font-mono bg-amber-100 px-1 rounded">services/agent</code>.
                    </p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {/* Welcome state */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-12 gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                            <Stethoscope className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center max-w-sm">
                            <h4 className="text-lg font-bold text-slate-800 mb-1">SymptomSage Agent</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Describe your symptoms and our multi-agent AI will triage them, check for emergencies,
                                and produce a clinical report — all in one conversation.
                            </p>
                        </div>
                        <div className="w-full max-w-sm grid grid-cols-1 gap-2">
                            {SUGGESTED_PROMPTS.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(p)}
                                    className="text-left px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message list */}
                <AnimatePresence initial={false}>
                    {messages.map(message => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                message.role === 'user'
                                    ? 'bg-blue-600'
                                    : message.isEmergency
                                    ? 'bg-red-600'
                                    : 'bg-indigo-600'
                            }`}>
                                {message.role === 'user'
                                    ? <User className="w-4 h-4 text-white" />
                                    : <Bot className="w-4 h-4 text-white" />}
                            </div>

                            <div className={`max-w-[80%] flex flex-col gap-1.5 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {/* Uploaded image preview */}
                                {message.imageUrl && (
                                    <img
                                        src={message.imageUrl}
                                        alt="Uploaded"
                                        className="max-h-40 max-w-xs rounded-xl border border-slate-200 object-cover"
                                    />
                                )}

                                {/* Tool activity strip */}
                                {message.role === 'assistant' && (message.toolEvents?.length ?? 0) > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {message.toolEvents!.map((te, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                                                    te.status === 'running'
                                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                        : 'bg-green-50 border-green-200 text-green-700'
                                                }`}
                                            >
                                                {te.status === 'running'
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <CheckCircle2 className="w-3 h-3" />}
                                                <Wrench className="w-3 h-3 opacity-60" />
                                                {TOOL_LABELS[te.tool] ?? te.tool}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Message bubble */}
                                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                    message.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-md'
                                        : message.isEmergency
                                        ? 'bg-red-50 border-2 border-red-300 text-red-900 rounded-bl-md shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                }`}>
                                    {message.isEmergency && (
                                        <div className="flex items-center gap-1.5 mb-2 text-red-700 font-bold text-xs uppercase tracking-wide">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Emergency detected
                                        </div>
                                    )}
                                    {message.content ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                        />
                                    ) : message.isStreaming ? null : (
                                        <span className="italic text-slate-400 text-xs">(No response)</span>
                                    )}
                                    {/* Streaming cursor */}
                                    {message.isStreaming && (
                                        <span className="inline-block w-2 h-4 ml-0.5 bg-blue-400 rounded-sm animate-pulse align-middle" />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <div ref={messagesEndRef} />
            </div>

            {/* Follow-up answer panel */}
            <AnimatePresence>
                {pendingFollowup && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="border-t border-amber-200 bg-amber-50 px-4 py-3 shrink-0"
                    >
                        <div className="flex items-start gap-2 mb-2">
                            <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-amber-800">Agent is asking:</p>
                        </div>
                        <p className="text-sm text-amber-900 mb-3 pl-6">{pendingFollowup}</p>
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                type="text"
                                value={followupAnswer}
                                onChange={e => setFollowupAnswer(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitFollowupAnswer(); }}
                                placeholder="Your answer…"
                                className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            />
                            <button
                                onClick={submitFollowupAnswer}
                                disabled={!followupAnswer.trim()}
                                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 transition-colors"
                            >
                                Reply
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image preview bar */}
            {selectedImage && (
                <div className="px-4 py-2 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2">
                    <img
                        src={selectedImage.preview}
                        alt="Selected"
                        className="h-10 w-10 rounded-lg object-cover border border-slate-200"
                    />
                    <span className="text-xs text-slate-500 flex-1">Image ready to send</span>
                    <button onClick={() => setSelectedImage(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            )}

            {/* Input bar */}
            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                <div className="flex gap-2">
                    {/* Image attach */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isStreaming}
                        className="p-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-40"
                        title="Attach image"
                    >
                        <Image className="w-4 h-4 text-slate-500" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                    />

                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isStreaming ? 'Agent is thinking…' : 'Describe your symptoms…'}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        disabled={isStreaming || !!pendingFollowup}
                    />

                    <button
                        onClick={() => sendMessage(input, selectedImage?.base64)}
                        disabled={(!input.trim() && !selectedImage) || isStreaming || !!pendingFollowup}
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                            (input.trim() || selectedImage) && !isStreaming && !pendingFollowup
                                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {isStreaming
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2">
                    Multi-agent AI · Not a medical diagnosis · Emergency? Call 112 or 108
                </p>
            </div>
        </div>
    );
};

export default AgentChat;
