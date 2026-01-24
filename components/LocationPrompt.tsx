import React from 'react';
import { MapPin, Shield, X, Navigation } from 'lucide-react';

interface LocationPromptProps {
    onAllow: () => void;
    onSkip: () => void;
    isLoading?: boolean;
}

const LocationPrompt: React.FC<LocationPromptProps> = ({ onAllow, onSkip, isLoading }) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    {/* Icon */}
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
                        <MapPin className="w-10 h-10 text-white" />
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">
                        Enable Location Access
                    </h2>

                    {/* Description */}
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        SymptomSage can find nearby doctors, clinics, and test labs when your health assessment suggests you need medical attention.
                    </p>

                    {/* Benefits */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Navigation className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-700 text-sm">Find Nearby Healthcare</p>
                                    <p className="text-xs text-slate-500">Doctors, hospitals, labs based on your condition</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-700 text-sm">Your Privacy Matters</p>
                                    <p className="text-xs text-slate-500">Location stored locally, never sent to servers</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={onAllow}
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Getting Location...
                                </>
                            ) : (
                                <>
                                    <MapPin className="w-5 h-5" />
                                    Enable Location
                                </>
                            )}
                        </button>
                        <button
                            onClick={onSkip}
                            className="w-full py-3 text-slate-500 font-medium hover:text-slate-700 transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-4">
                        You can enable this later from settings
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LocationPrompt;
