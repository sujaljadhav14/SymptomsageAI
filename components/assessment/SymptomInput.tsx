import React, { useState } from 'react';
import { Search, Plus, X, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { AssessmentInput } from '../../types';
import { getAllSymptoms, getCommonSymptoms } from '../../utils/assessmentEngine';

interface SymptomInputProps {
    onSubmit: (input: AssessmentInput) => void;
    isLoading: boolean;
}

const DURATION_OPTIONS = [
    { value: 'today', label: 'Started today' },
    { value: '1-3_days', label: '1-3 days' },
    { value: '4-7_days', label: '4-7 days' },
    { value: '1-2_weeks', label: '1-2 weeks' },
    { value: '2-4_weeks', label: '2-4 weeks' },
    { value: 'over_month', label: 'Over a month' },
];

const SEVERITY_OPTIONS = [
    { value: 'mild', label: 'Mild', description: 'Noticeable but not affecting daily activities' },
    { value: 'moderate', label: 'Moderate', description: 'Affecting some daily activities' },
    { value: 'severe', label: 'Severe', description: 'Significantly affecting daily life' },
];

const SymptomInput: React.FC<SymptomInputProps> = ({ onSubmit, isLoading }) => {
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [duration, setDuration] = useState('1-3_days');
    const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [showAllSymptoms, setShowAllSymptoms] = useState(false);

    const commonSymptoms = getCommonSymptoms();
    const allSymptoms = getAllSymptoms();

    const filteredSymptoms = searchTerm
        ? allSymptoms.filter(s =>
            s.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedSymptoms.includes(s.id)
        )
        : [];

    const handleAddSymptom = (symptomId: string) => {
        if (!selectedSymptoms.includes(symptomId)) {
            setSelectedSymptoms([...selectedSymptoms, symptomId]);
        }
        setSearchTerm('');
    };

    const handleRemoveSymptom = (symptomId: string) => {
        setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptomId));
    };

    const handleSubmit = () => {
        if (selectedSymptoms.length === 0) return;

        onSubmit({
            symptoms: selectedSymptoms,
            duration,
            severity,
            additionalNotes: additionalNotes.trim() || undefined,
        });
    };

    const getSymptomLabel = (id: string) => {
        const symptom = allSymptoms.find(s => s.id === id);
        return symptom?.label || id.replace(/_/g, ' ');
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                <h2 className="text-xl font-bold mb-1">Quick Health Assessment</h2>
                <p className="text-white/80 text-sm">
                    Select your symptoms below for an instant, explainable assessment
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Offline Ready
                    </span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        No AI Required
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Symptom Search */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        What symptoms are you experiencing?
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search symptoms..."
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        {filteredSymptoms.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                                {filteredSymptoms.slice(0, 8).map((symptom) => (
                                    <button
                                        key={symptom.id}
                                        onClick={() => handleAddSymptom(symptom.id)}
                                        className="w-full px-4 py-2 text-left hover:bg-emerald-50 text-sm flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4 text-emerald-500" />
                                        {symptom.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Common Symptoms Quick Select */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Common Symptoms
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {(showAllSymptoms ? commonSymptoms : commonSymptoms.slice(0, 8)).map((symptom) => (
                            <button
                                key={symptom.id}
                                onClick={() => handleAddSymptom(symptom.id)}
                                disabled={selectedSymptoms.includes(symptom.id)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedSymptoms.includes(symptom.id)
                                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                            >
                                {symptom.label}
                            </button>
                        ))}
                        {!showAllSymptoms && commonSymptoms.length > 8 && (
                            <button
                                onClick={() => setShowAllSymptoms(true)}
                                className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-1"
                            >
                                +{commonSymptoms.length - 8} more
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Selected Symptoms */}
                {selectedSymptoms.length > 0 && (
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Selected Symptoms ({selectedSymptoms.length})
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {selectedSymptoms.map((symptomId) => (
                                <div
                                    key={symptomId}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-medium"
                                >
                                    {getSymptomLabel(symptomId)}
                                    <button
                                        onClick={() => handleRemoveSymptom(symptomId)}
                                        className="hover:bg-white/20 rounded-full p-0.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Duration */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        How long have you had these symptoms?
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {DURATION_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setDuration(option.value)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${duration === option.value
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Severity */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        How severe are your symptoms?
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {SEVERITY_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSeverity(option.value as 'mild' | 'moderate' | 'severe')}
                                className={`p-4 rounded-xl text-left transition-all border-2 ${severity === option.value
                                    ? 'bg-emerald-50 border-emerald-500'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className={`font-bold text-sm ${severity === option.value ? 'text-emerald-700' : 'text-slate-700'
                                    }`}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {option.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Additional Notes */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Additional Information (Optional)
                    </label>
                    <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder="Describe any other symptoms or details that might be helpful..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        rows={3}
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={selectedSymptoms.length === 0 || isLoading}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${selectedSymptoms.length === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200 hover:shadow-xl active:scale-[0.98]'
                        }`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            Get Assessment
                        </>
                    )}
                </button>

                {/* Disclaimer */}
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    This tool provides general health information only. It is not a substitute for
                    professional medical advice, diagnosis, or treatment.
                </p>
            </div>
        </div>
    );
};

export default SymptomInput;
