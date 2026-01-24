import React, { useState } from 'react';
import { WifiOff, RotateCcw, MessageCircle, ClipboardList } from 'lucide-react';
import SymptomInput from '../components/assessment/SymptomInput';
import AssessmentResult from '../components/assessment/AssessmentResult';
import ChatSymptomChecker from '../components/assessment/ChatSymptomChecker';
import { AssessmentInput, AssessmentResult as AssessmentResultType } from '../types';
import { runAssessment } from '../utils/assessmentEngine';

type Mode = 'form' | 'chat';

const OfflineAssessmentView: React.FC = () => {
    const [mode, setMode] = useState<Mode>('chat');
    const [result, setResult] = useState<AssessmentResultType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [assessmentHistory, setAssessmentHistory] = useState<AssessmentResultType[]>([]);

    const handleSubmit = (input: AssessmentInput) => {
        setIsLoading(true);

        setTimeout(() => {
            const assessmentResult = runAssessment(input);
            setResult(assessmentResult);
            setAssessmentHistory(prev => [assessmentResult, ...prev].slice(0, 5));
            setIsLoading(false);
        }, 800);
    };

    const handleReset = () => {
        setResult(null);
    };

    const handleClearHistory = () => {
        setAssessmentHistory([]);
    };

    const handleViewFullResult = (chatResult: AssessmentResultType) => {
        setResult(chatResult);
        setMode('form');
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Low Network Mode</h2>
                    <p className="text-sm text-slate-500">Offline symptom analysis • No internet required</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Mode Toggle */}
                    <div className="flex bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => { setMode('chat'); setResult(null); }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'chat'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Chat
                        </button>
                        <button
                            onClick={() => { setMode('form'); setResult(null); }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'form'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Form
                        </button>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold ring-1 ring-emerald-200">
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>Offline</span>
                    </div>
                    {mode === 'form' && assessmentHistory.length > 0 && (
                        <button
                            onClick={handleClearHistory}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Offline Info Banner */}
                    <div className="mb-6 flex items-center gap-4 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-100">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                            <WifiOff className="w-6 h-6 text-teal-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-teal-800">Works Without Internet</h3>
                            <p className="text-sm text-teal-600">
                                {mode === 'chat'
                                    ? 'Type your symptoms naturally - analysis happens on your device'
                                    : 'Select symptoms from our database - fully offline analysis'}
                            </p>
                        </div>
                        <div className="hidden md:flex flex-col items-end text-right">
                            <span className="text-xs text-teal-600 font-medium">No API calls</span>
                            <span className="text-xs text-teal-600 font-medium">100% private</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    {mode === 'chat' ? (
                        <ChatSymptomChecker onViewFullResult={handleViewFullResult} />
                    ) : result ? (
                        <AssessmentResult result={result} onReset={handleReset} />
                    ) : (
                        <SymptomInput onSubmit={handleSubmit} isLoading={isLoading} />
                    )}

                    {/* Form Mode History */}
                    {mode === 'form' && !result && assessmentHistory.length > 0 && (
                        <div className="mt-8">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-slate-400" />
                                Recent Assessments
                            </h3>
                            <div className="space-y-2">
                                {assessmentHistory.map((history, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setResult(history)}
                                        className="w-full p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${history.riskLevel === 'emergency' ? 'bg-red-100 text-red-700' :
                                                    history.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        history.riskLevel === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {history.riskLevel}
                                                </span>
                                                <span className="text-sm text-slate-700">
                                                    {history.matchedSymptoms.slice(0, 3).map(s => s.replace(/_/g, ' ')).join(', ')}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {history.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineAssessmentView;
