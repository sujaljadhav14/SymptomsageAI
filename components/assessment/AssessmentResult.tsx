import React from 'react';
import {
    AlertTriangle,
    Shield,
    Activity,
    Beaker,
    ChevronRight,
    AlertCircle,
    CheckCircle,
    Lightbulb,
    Phone,
    RefreshCw,
    Download
} from 'lucide-react';
import { AssessmentResult as AssessmentResultType, ConditionMatch, TestSuggestion } from '../../types';
import NearbyFacilitiesCard from '../NearbyFacilitiesCard';
import { urgencyFor } from '../../utils/urgency';

interface AssessmentResultProps {
    result: AssessmentResultType;
    onReset: () => void;
}

const getRiskBadge = (riskLevel: string) => {
    const u = urgencyFor(riskLevel);
    switch (riskLevel) {
        case 'emergency':
            return { bg: 'bg-signal', text: 'text-white', icon: Phone, label: 'EMERGENCY', action: u.action };
        case 'high':
            return { bg: 'bg-orange-400', text: 'text-ink', icon: AlertTriangle, label: 'SEE A DOCTOR WITHIN 24H', action: u.action };
        case 'moderate':
            return { bg: 'bg-caution', text: 'text-ink', icon: AlertCircle, label: 'SEE A DOCTOR THIS WEEK', action: u.action };
        default:
            return { bg: 'bg-leaf', text: 'text-ink', icon: CheckCircle, label: 'HOME CARE FOR NOW', action: u.action };
    }
};

const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
        case 'very_likely':
            return 'bg-blue-100 text-blue-700';
        case 'likely':
            return 'bg-blue-100 text-blue-700';
        default:
            return 'bg-slate-100 text-slate-600';
    }
};

const getCostBadge = (cost: string) => {
    switch (cost) {
        case 'high':
            return 'bg-red-50 text-red-600';
        case 'medium':
            return 'bg-amber-50 text-amber-600';
        default:
            return 'bg-blue-50 text-blue-600';
    }
};

const ConditionCard: React.FC<{ condition: ConditionMatch; rank: number }> = ({ condition, rank }) => {
    const riskColors = {
        'high': 'border-l-orange-500 bg-orange-50',
        'moderate': 'border-l-caution bg-caution-soft',
        'low': 'border-l-brand-600 bg-brand-50'
    };

    return (
        <div className={`p-4 rounded-xl border-l-4 ${riskColors[condition.riskLevel]} border border-slate-100`}>
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                        {rank}
                    </span>
                    <h4 className="font-bold text-slate-800">{condition.name}</h4>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getConfidenceBadge(condition.confidence)}`}>
                    {condition.confidence.replace('_', ' ')}
                </span>
            </div>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">{condition.description}</p>
            <div className="flex flex-wrap gap-1">
                {condition.matchedSymptoms.map((symptom) => (
                    <span
                        key={symptom}
                        className="px-2 py-0.5 bg-white/80 border border-slate-200 rounded-full text-[10px] text-slate-600"
                    >
                        {symptom.replace(/_/g, ' ')}
                    </span>
                ))}
            </div>
        </div>
    );
};

const TestCard: React.FC<{ test: TestSuggestion }> = ({ test }) => {
    return (
        <div className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-800 text-sm">{test.name}</h4>
                <div className="flex gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCostBadge(test.cost)}`}>
                        {test.cost} cost
                    </span>
                </div>
            </div>
            <p className="text-xs text-slate-500 mb-2">{test.reason}</p>
            <div className="text-[10px] text-slate-400">
                For: {test.relevantConditions.join(', ')}
            </div>
        </div>
    );
};

const AssessmentResult: React.FC<AssessmentResultProps> = ({ result, onReset }) => {
    const riskBadge = getRiskBadge(result.riskLevel);
    const RiskIcon = riskBadge.icon;

    const handleDownload = () => {
        const content = `
SYMPTOMSAGE - HEALTH ASSESSMENT REPORT
Generated: ${result.timestamp.toLocaleString()}
======================================

RISK LEVEL: ${result.riskLevel.toUpperCase()}

SYMPTOMS REPORTED:
${result.matchedSymptoms.map(s => `• ${s.replace(/_/g, ' ')}`).join('\n')}

POSSIBLE CONDITIONS:
${result.possibleConditions.map((c, i) => `${i + 1}. ${c.name} (${c.confidence.replace('_', ' ')})\n   ${c.description}`).join('\n\n')}

REASONING:
${result.reasoning.map(r => `• ${r}`).join('\n')}

RECOMMENDED TESTS:
${result.testSuggestions.map(t => `• ${t.name} (${t.cost} cost) - ${t.reason}`).join('\n')}

NEXT STEPS:
${result.nextSteps.map(s => `• ${s}`).join('\n')}

======================================
${result.disclaimer}
        `.trim();

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SymptomSage_Assessment_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Emergency Banner (if applicable) */}
            {result.isEmergency && (
                <div className="bg-signal text-white p-6 rounded-2xl border-2 border-ink shadow-hard">
                    <div className="flex items-center gap-3 mb-3">
                        <Phone className="w-8 h-8" />
                        <h2 className="text-2xl font-bold">SEEK IMMEDIATE MEDICAL CARE</h2>
                    </div>
                    <p className="text-white/90 mb-4">{result.reasoning[0]}</p>
                    <a href="tel:112" className="btn !bg-white !text-ink mb-4 shadow-hard"><Phone className="w-4 h-4" /> Call 112 now</a>
                    <div className="bg-white/20 rounded-xl p-4">
                        <p className="font-semibold mb-2">Emergency Instructions:</p>
                        <ul className="space-y-1 text-sm">
                            {result.nextSteps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold shrink-0">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Risk Level Badge */}
            {!result.isEmergency && (
                <div className={`${riskBadge.bg} ${riskBadge.text} p-6 rounded-2xl border-2 border-ink shadow-hard`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <RiskIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="label-mono !text-current opacity-75">Urgency</p>
                                <h2 className="font-display text-2xl font-extrabold leading-tight">{riskBadge.label}</h2>
                                <p className="text-sm font-semibold opacity-80">{riskBadge.action}</p>
                            </div>
                        </div>
                        <div className="text-right text-xs opacity-70">
                            <p>{result.matchedSymptoms.length} symptoms analyzed</p>
                            <p>{result.possibleConditions.length} conditions identified</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Possible Conditions */}
            {result.possibleConditions.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">Possible Conditions</h3>
                    </div>
                    <div className="space-y-3">
                        {result.possibleConditions.map((condition, index) => (
                            <ConditionCard key={condition.conditionId} condition={condition} rank={index + 1} />
                        ))}
                    </div>
                </div>
            )}

            {/* Reasoning */}
            <div className="bg-brand-50 rounded-2xl border-2 border-ink p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-blue-800">Why These Results?</h3>
                </div>
                <ul className="space-y-2">
                    {result.reasoning.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                            {reason}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Test Recommendations */}
            {result.testSuggestions.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Beaker className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">Recommended Tests</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.testSuggestions.map((test) => (
                            <TestCard key={test.testId} test={test} />
                        ))}
                    </div>
                </div>
            )}

            {/* Next Steps */}
            {!result.isEmergency && (
                <div className="bg-brand-50 rounded-2xl border-2 border-ink p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-blue-800">Recommended Next Steps</h3>
                    </div>
                    <ul className="space-y-2">
                        {result.nextSteps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-blue-700">
                                <span className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Nearby Healthcare Facilities - Show for moderate/high risk */}
            {(result.riskLevel === 'moderate' || result.riskLevel === 'high' || result.riskLevel === 'emergency') && (
                <NearbyFacilitiesCard
                    testSuggestions={result.testSuggestions}
                    possibleConditions={result.possibleConditions}
                    riskLevel={result.riskLevel}
                />
            )}

            {/* Disclaimer */}
            <div className="bg-caution-soft rounded-2xl border-2 border-ink p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        {result.disclaimer}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={onReset}
                    className="flex-1 btn-ghost"
                >
                    <RefreshCw className="w-4 h-4" />
                    New Assessment
                </button>
                <button
                    onClick={handleDownload}
                    className="flex-1 btn-dark"
                >
                    <Download className="w-4 h-4" />
                    Download Report
                </button>
            </div>
        </div>
    );
};

export default AssessmentResult;
