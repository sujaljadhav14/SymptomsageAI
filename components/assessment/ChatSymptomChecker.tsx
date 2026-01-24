import React, { useState, useRef, useEffect } from 'react';
import { Send, WifiOff, Bot, User, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { AssessmentResult } from '../../types';
import { runAssessment, normalizeInput, getCommonSymptoms } from '../../utils/assessmentEngine';

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
    content: "Hi! I'm SymptomSage's Low Network Mode assistant. Tell me about your symptoms in your own words, and I'll analyze them locally on your device. For example: \"I have a headache and fever for 2 days\"",
    timestamp: new Date(),
};

const SUGGESTION_PROMPTS = [
    "I have a headache and feel tired",
    "Cough and fever since yesterday",
    "Stomach pain and nausea",
    "Feeling dizzy and weak",
];

const ChatSymptomChecker: React.FC<ChatSymptomCheckerProps> = ({ onViewFullResult, compact = false }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isAnalyzing) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsAnalyzing(true);

        // Extract symptoms from natural language
        const extractedSymptoms = normalizeInput(input.trim());

        // Simulate brief processing for UX
        await new Promise(resolve => setTimeout(resolve, 800));

        let assistantMessage: ChatMessage;

        if (extractedSymptoms.length === 0) {
            assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I couldn't identify specific symptoms from your message. Could you describe your symptoms more clearly? For example: \"headache\", \"fever\", \"cough\", \"stomach pain\", etc.",
                timestamp: new Date(),
            };
        } else {
            // Run assessment
            const result = runAssessment({
                symptoms: extractedSymptoms,
                duration: '1-3_days',
                severity: 'moderate',
                additionalNotes: input.trim(),
            });

            const symptomList = extractedSymptoms.map(s => s.replace(/_/g, ' ')).join(', ');
            const topCondition = result.possibleConditions[0];

            let responseContent = '';

            if (result.isEmergency) {
                responseContent = `🚨 **EMERGENCY DETECTED**\n\nBased on your symptoms, you should seek immediate medical attention. Please call emergency services (911) or go to the nearest emergency room immediately.`;
            } else if (topCondition) {
                const riskEmoji = result.riskLevel === 'high' ? '⚠️' : result.riskLevel === 'moderate' ? '⚡' : '✅';
                responseContent = `I identified these symptoms: **${symptomList}**\n\n${riskEmoji} **Risk Level: ${result.riskLevel.toUpperCase()}**\n\n**Most likely:** ${topCondition.name} (${topCondition.confidence.replace('_', ' ')})\n\n${topCondition.description}\n\n**Recommended next steps:**\n${result.nextSteps.slice(0, 2).map(s => `• ${s}`).join('\n')}\n\n⚕️ *This is not a medical diagnosis. Consult a healthcare provider for proper evaluation.*`;
            } else {
                responseContent = `I identified: **${symptomList}**\n\nI couldn't match these to specific conditions in my database. Please consult a healthcare provider for a proper evaluation.`;
            }

            assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseContent,
                timestamp: new Date(),
                extractedSymptoms,
                result,
            };
        }

        setMessages(prev => [...prev, assistantMessage]);
        setIsAnalyzing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
        inputRef.current?.focus();
    };

    const handleReset = () => {
        setMessages([INITIAL_MESSAGE]);
    };

    return (
        <div className={`flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${compact ? 'h-[500px]' : 'h-[600px]'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-4 text-white shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <WifiOff className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold">Low Network Mode</h3>
                            <p className="text-xs text-white/70">Chat-based symptom analysis • Works offline</p>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Start new chat"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-blue-600' : 'bg-teal-600'
                            }`}>
                            {message.role === 'user' ? (
                                <User className="w-4 h-4 text-white" />
                            ) : (
                                <Bot className="w-4 h-4 text-white" />
                            )}
                        </div>
                        <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                            <div className={`p-3 rounded-2xl ${message.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-md'
                                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                }`}>
                                <div className={`text-sm whitespace-pre-wrap ${message.role === 'assistant' ? 'prose prose-sm' : ''}`}
                                    dangerouslySetInnerHTML={{
                                        __html: message.content
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\n/g, '<br/>')
                                    }}
                                />
                            </div>
                            {message.extractedSymptoms && message.extractedSymptoms.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {message.extractedSymptoms.map((s, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-medium">
                                            {s.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {message.result && onViewFullResult && (
                                <button
                                    onClick={() => onViewFullResult(message.result!)}
                                    className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                                >
                                    <Zap className="w-3 h-3" />
                                    View detailed report
                                </button>
                            )}
                            <p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}

                {isAnalyzing && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-md shadow-sm">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                                <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="ml-2">Analyzing locally...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            {messages.length <= 2 && (
                <div className="px-4 py-2 border-t border-slate-100 bg-white shrink-0">
                    <p className="text-[10px] text-slate-400 mb-2">Try these examples:</p>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTION_PROMPTS.map((prompt, i) => (
                            <button
                                key={i}
                                onClick={() => handleSuggestionClick(prompt)}
                                className="px-3 py-1 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 rounded-full text-xs font-medium transition-colors"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your symptoms..."
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        disabled={isAnalyzing}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isAnalyzing}
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${input.trim() && !isAnalyzing
                            ? 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2">
                    100% offline • No data sent • Works without internet
                </p>
            </div>
        </div>
    );
};

export default ChatSymptomChecker;
