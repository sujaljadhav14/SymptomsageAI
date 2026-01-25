import React, { useState, useRef } from 'react';
import { Camera, Upload, X, ArrowLeft, Loader2, AlertCircle, Image as ImageIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onBack ? onBack() : navigate('/app')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">Medical Image Analysis</h1>
                            <p className="text-xs text-slate-500">AI-powered symptom detection</p>
                        </div>
                    </div>
                </div>

                {capturedImage && !analysisResult && (
                    <button
                        onClick={reset}
                        className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        Clear
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
                                <div className="p-8 text-center space-y-6">
                                    <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto">
                                        <ImageIcon className="w-12 h-12 text-blue-600" />
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
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                                        <button
                                            onClick={stopCamera}
                                            className="px-6 py-3 bg-slate-800/80 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-slate-700/80 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={captureImage}
                                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
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
                    <div className="flex-1">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
                            {!analysisResult && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-8">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                        <Sparkles className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Analysis Yet</h3>
                                        <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                            Upload an image and click analyze to see AI-powered medical insights
                                        </p>
                                    </div>
                                </div>
                            )}

                            {loading && (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                                    <p className="text-slate-600 font-medium">Analyzing image...</p>
                                    <p className="text-slate-400 text-sm">This may take a few seconds</p>
                                </div>
                            )}

                            {analysisResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-slate-800">Analysis Results</h3>
                                        <button
                                            onClick={reset}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all active:scale-95"
                                        >
                                            New Analysis
                                        </button>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Sparkles className="w-5 h-5 text-blue-600" />
                                            <span className="text-blue-900 font-bold text-sm">AI Medical Insights</span>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                                            {analysisResult.text}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 text-center">
                                        Analysis completed at {analysisResult.timestamp.toLocaleTimeString()}
                                    </div>
                                </motion.div>
                            )}
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
