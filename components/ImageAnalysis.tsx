import React, { useState, useRef } from 'react';
import { Camera, Upload, X, ArrowLeft, Loader2, AlertCircle, Image as ImageIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Activity, ClipboardList, Clock,
    ArrowRight, MapPin
} from 'lucide-react';

interface AnalysisResult {
    text: string;
    timestamp: Date;
}

interface ImageAnalysisProps {
    onBack?: () => void;
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ onBack }) => {
    const navigate = useNavigate();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    // Start camera
    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setIsCameraActive(true);
            }
        } catch (err: any) {
            setError('Camera access denied. Please enable camera permissions.');
            console.error('Camera error:', err);
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    // Capture image from camera
    const captureImage = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.95);
                setCapturedImage(imageData);
                stopCamera();
            }
        }
    };

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload a valid image file');
                return;
            }

            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setError('Image size should be less than 10MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                setCapturedImage(event.target?.result as string);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    // Analyze image with Gemini Vision API
    const analyzeImage = async () => {
        if (!capturedImage) return;

        setLoading(true);
        setError(null);

        try {
            const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';

            if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
                throw new Error('Gemini API key not configured');
            }

            // Convert base64 to proper format for Gemini
            const base64Data = capturedImage.split(',')[1];

            const requestBody = {
                contents: [{
                    parts: [
                        {
                            text: `You are a medical AI assistant. Analyze this medical image and provide:
1. A brief description of what you observe
2. Potential medical concerns or symptoms visible
3. Recommended immediate actions or precautions
4. Whether the person should seek immediate medical attention

IMPORTANT: Always include a disclaimer that this is not a professional medical diagnosis and the user should consult a healthcare provider for accurate diagnosis and treatment.

Be professional, empathetic, and clear in your response.`
                        },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Data
                            }
                        }
                    ]
                }]
            };

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                // Get detailed error message from response
                const errorData = await response.json().catch(() => null);
                const errorMessage = errorData?.error?.message || response.statusText;

                // Check for specific error types
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                } else if (response.status === 403) {
                    throw new Error('API key invalid or Vision API not enabled. Please check your Gemini API key.');
                } else if (response.status === 400) {
                    throw new Error(`Invalid request: ${errorMessage}`);
                } else {
                    throw new Error(`API request failed (${response.status}): ${errorMessage}`);
                }
            }

            const data = await response.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (resultText) {
                setAnalysisResult({
                    text: resultText,
                    timestamp: new Date()
                });
                // Auto-scroll to results after a short delay to allow mounting
                setTimeout(() => {
                    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                throw new Error('No analysis result received from AI');
            }
        } catch (err: any) {
            console.error('Analysis error:', err);
            setError(err.message || 'Failed to analyze image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Clear everything and start over
    const reset = () => {
        setCapturedImage(null);
        setAnalysisResult(null);
        setError(null);
        stopCamera();
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
                <div className="flex items-center gap-3 md:gap-4">
                    <button
                        onClick={() => onBack ? onBack() : navigate('/app')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                            <Camera className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm md:text-lg font-bold text-slate-800">Image Analysis</h1>
                            <p className="text-[10px] md:text-xs text-slate-500">Symptom detection</p>
                        </div>
                    </div>
                </div>

                {capturedImage && !analysisResult && (
                    <button
                        onClick={reset}
                        className="px-3 md:px-5 py-2 md:py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-200 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                )}
            </header>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                    >
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="p-6 max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Panel - Image Capture/Upload */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {!capturedImage && !isCameraActive && (
                                <div className="p-6 md:p-8 text-center space-y-6">
                                    <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto">
                                        <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Upload an Image</h3>
                                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                                            Upload an image of your symptom for AI-powered medical analysis
                                        </p>
                                    </div>

                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Upload className="w-5 h-5" />
                                            Upload Image
                                        </button>
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Camera View */}
                            {isCameraActive && !capturedImage && (
                                <div className="relative">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-auto rounded-2xl"
                                    />
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-4">
                                        <button
                                            onClick={stopCamera}
                                            className="px-4 md:px-6 py-2.5 md:py-3 bg-slate-800/80 backdrop-blur-sm text-white rounded-xl text-xs md:text-sm font-bold hover:bg-slate-700/80 transition-all flex-1 md:flex-none"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={captureImage}
                                            className="px-6 md:px-8 py-2.5 md:py-3 bg-blue-600 text-white rounded-xl text-xs md:text-sm font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex-1 md:flex-none"
                                        >
                                            📸 Capture
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Captured Image Preview */}
                            {capturedImage && (
                                <div className="p-6">
                                    <img
                                        src={capturedImage}
                                        alt="Captured"
                                        className="w-full h-auto rounded-xl border border-slate-200"
                                    />
                                    {!analysisResult && (
                                        <button
                                            onClick={analyzeImage}
                                            disabled={loading}
                                            className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Analyzing...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5" />
                                                    Analyze with AI
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Info Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">How to use</h3>
                            <ul className="text-sm text-slate-600 space-y-2.5">
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">1.</span>
                                    Capture a clear image of the affected area
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">2.</span>
                                    Ensure good lighting and focus
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">3.</span>
                                    Click "Analyze with AI" to get insights
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">4.</span>
                                    Follow AI recommendations or seek medical help
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Panel - Analysis Results */}
                    <div className="flex-1" ref={resultRef}>
                        <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 p-8 min-h-[500px] transition-all duration-500 hover:shadow-2xl hover:shadow-blue-100/30">
                            {!analysisResult && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-8">
                                    <div className="w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-[2rem] flex items-center justify-center border border-slate-200 shadow-inner">
                                        <Sparkles className="w-12 h-12 text-slate-300 animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-slate-800">Ready for Analysis</h3>
                                        <p className="text-slate-500 text-sm max-w-[280px] mx-auto leading-relaxed">
                                            Upload or capture an image to see immediate AI-generated medical insights.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {loading && (
                                <div className="h-full flex flex-col items-center justify-center space-y-8 p-8">
                                    <div className="relative">
                                        <div className="w-24 h-24 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin" />
                                        <Activity className="absolute inset-0 m-auto w-10 h-10 text-blue-600 animate-pulse" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-bold text-slate-800">Processing Medical Image</p>
                                        <p className="text-slate-400 text-sm animate-pulse font-medium">Gemini is analyzing visual patterns...</p>
                                    </div>
                                </div>
                            )}

                            <AnimatePresence>
                                {analysisResult && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.98, y: 30 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
                                        className="space-y-8"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                                    <ClipboardList className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Clinical Report</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">AI-Generated Assessment</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={reset}
                                                className="px-3 md:px-5 py-2 md:py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] md:text-xs font-bold transition-all active:scale-95 shadow-sm border border-blue-100"
                                            >
                                                <span className="hidden sm:inline">Start New Analysis</span>
                                                <span className="sm:hidden">New Analysis</span>
                                            </button>
                                        </div>

                                        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-[2rem] p-8 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Activity className="w-32 h-32" />
                                            </div>
                                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                                                <Sparkles className="w-5 h-5 text-blue-600" />
                                                <span className="text-slate-800 font-bold text-sm tracking-tight">Expert AI Observation</span>
                                            </div>
                                            <div className="prose prose-blue prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-[1.8] font-medium tracking-tight">
                                                {analysisResult.text}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center gap-3 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] border-t border-slate-100">
                                            <Clock className="w-3.5 h-3.5" />
                                            Analysis Finalized {analysisResult.timestamp.toLocaleTimeString()}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-amber-800 text-sm font-medium">
                        ⚠️ <strong>Medical Disclaimer:</strong> This AI analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default ImageAnalysis;
