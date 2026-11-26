import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Send, WifiOff, RefreshCw, Zap, Phone } from 'lucide-react';
import { AssessmentResult } from '../../types';
import { runAssessment, normalizeInput, checkRedFlags } from '../../utils/assessmentEngine';
import { urgencyFor } from '../../utils/urgency';
import { LogoMark } from '../Logo';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    extractedSymptoms?: string[];
    result?: AssessmentResult;
}

interface ChatSymptomCheckerProps {
    onViewFullResult?: (result: AssessmentResult) => void;
    compact?: boolean;
}

const INITIAL_MESSAGE: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content:
        'Hi, I can help you work out how urgent your symptoms are. Tell me what you feel, in your own words. For example: "headache and fever for 2 days". I run on your device, so nothing you type here is sent anywhere.',
    timestamp: new Date(),
};

const SUGGESTION_PROMPTS = [
    'I have a headache and feel tired',
    'Cough and fever since yesterday',
    'Stomach pain and nausea',
    'Feeling dizzy and weak',
];

const ChatSymptomChecker: React.FC<ChatSymptomCheckerProps> = ({ onViewFullResult, compact = false }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll only the chat pane (not the page) when new messages arrive.
    useEffect(() => {
        if (messages.length <= 1) return;
        const el = scrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, [messages, isAnalyzing]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isAnalyzing) return;

        setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() },
        ]);
        setInput('');
        setIsAnalyzing(true);

        const extractedSymptoms = normalizeInput(text);

        // Brief pause so the reply doesn't feel abrupt.
        await new Promise((resolve) => setTimeout(resolve, 600));

        let assistantMessage: ChatMessage;

        // Safety: emergency wording must be caught even when no known symptom is extracted.
        const rawEmergency = checkRedFlags([], text).isEmergency;

        if (extractedSymptoms.length === 0 && !rawEmergency) {
            assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content:
                    'I could not pick out specific symptoms. Try naming them, like "headache", "fever", "cough" or "stomach pain". If something feels seriously wrong, do not wait: call 112.',
                timestamp: new Date(),
            };
        } else {
            const result = runAssessment({
                symptoms: extractedSymptoms,
                duration: '1-3_days',
                severity: 'moderate',
                additionalNotes: text,
            });

            const symptomList = extractedSymptoms.map((s) => s.replace(/_/g, ' ')).join(', ');
            const top = result.possibleConditions[0];
            let content = '';

            if (result.isEmergency) {
                content =
                    '**This could be an emergency.** Call 112 now (108 for an ambulance) or go to the nearest emergency room. Do not wait to see if it gets better, and do not drive yourself.';
            } else if (top) {
                content = `I picked up: **${symptomList}**\n\n**Closest match:** ${top.name} (${top.confidence.replace('_', ' ')}). ${top.description}\n\n**What to do:**\n${result.nextSteps
                    .slice(0, 2)
                    .map((s) => `• ${s}`)
                    .join('\n')}\n\nThis is guidance, not a diagnosis.`;
            } else {
                content = `I picked up: **${symptomList}**\n\nI could not match these to a specific condition. A doctor can look into it properly.`;
            }

            assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content,
                timestamp: new Date(),
                extractedSymptoms,
                result,
            };
        }

        setMessages((prev) => [...prev, assistantMessage]);
        setIsAnalyzing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            className={`card flex flex-col overflow-hidden ${compact ? 'h-[540px]' : 'h-[640px]'}`}
            role="region"
            aria-label="Symptom checker"
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper">
                <div className="flex items-center gap-3">
                    <LogoMark size={30} inverted />
                    <div>
                        <h3 className="font-display text-base font-bold leading-tight">Free symptom check</h3>
                        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-paper/60">
                            <WifiOff className="h-3 w-3" /> Runs on your device
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setMessages([INITIAL_MESSAGE])}
                    className="rounded-lg p-2 text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
                    title="Start over"
                    aria-label="Start over"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-paper p-4" aria-live="polite">
                {messages.map((message) => {
                    const isUser = message.role === 'user';
                    const urgency = message.result ? urgencyFor(message.result.riskLevel) : null;
                    return (
                        <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] ${isUser ? 'text-right' : ''}`}>
                                {urgency && message.result && (
                                    <div
                                        className={`${urgency.banner} mb-2 flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2 text-left shadow-hard-sm`}
                                    >
                                        {message.result.isEmergency && <Phone className="h-4 w-4 shrink-0" />}
                                        <div>
                                            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] opacity-75">
                                                Urgency
                                            </p>
                                            <p className="font-display text-sm font-extrabold leading-tight">
                                                {urgency.label}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div
                                    className={`rounded-2xl border-2 border-ink p-3 text-left ${
                                        isUser ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-ink'
                                    }`}
                                >
                                    <div
                                        className="whitespace-pre-wrap text-sm leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(
                                                message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                                            ),
                                        }}
                                    />
                                </div>
                                {message.result?.isEmergency && (
                                    <a href="tel:112" className="btn-signal mt-2 !px-4 !py-2">
                                        <Phone className="h-4 w-4" /> Call 112
                                    </a>
                                )}
                                {message.extractedSymptoms && message.extractedSymptoms.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {message.extractedSymptoms.map((s) => (
                                            <span key={s} className="chip !px-2 !py-0.5 !text-[10px]">
                                                {s.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {message.result && onViewFullResult && (
                                    <button
                                        onClick={() => onViewFullResult(message.result!)}
                                        className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-700 underline underline-offset-2 hover:text-brand-900"
                                    >
                                        <Zap className="h-3 w-3" /> View detailed report
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isAnalyzing && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border-2 border-ink bg-white px-4 py-3">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ink" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ink [animation-delay:0.12s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ink [animation-delay:0.24s]" />
                            <span className="sr-only">Checking your symptoms</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Suggestions */}
            {messages.length <= 2 && (
                <div className="shrink-0 border-t-2 border-ink bg-paper-2 px-4 py-3">
                    <p className="label-mono mb-2 !text-[10px]">Try one</p>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTION_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                onClick={() => {
                                    setInput(prompt);
                                    inputRef.current?.focus();
                                }}
                                className="chip transition-colors hover:bg-caution"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="shrink-0 border-t-2 border-ink bg-white p-3">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your symptoms…"
                        aria-label="Describe your symptoms"
                        className="flex-1 rounded-lg border-2 border-ink bg-paper px-4 py-3 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-caution"
                        disabled={isAnalyzing}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isAnalyzing}
                        className="btn-primary !px-4"
                        aria-label="Send"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
                <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Guidance only · Not a diagnosis · Emergency? Call 112
                </p>
            </div>
        </div>
    );
};

export default ChatSymptomChecker;
