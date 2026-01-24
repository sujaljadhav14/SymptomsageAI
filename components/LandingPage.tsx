
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Shield, Zap, MessageSquare, ArrowRight, Activity, Bell, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 italic:selection:bg-blue-200">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                            SymptomSage
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                                    Sign In
                                </button>
                            </SignInButton>
                            <SignInButton mode="modal">
                                <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 hover:shadow-blue-200 transition-all active:scale-95">
                                    Get Started
                                </button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <button
                                onClick={() => navigate('/app')}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-all"
                            >
                                Go to Dashboard
                            </button>
                        </SignedIn>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                {/* Background Decorative Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-100/30 blur-[120px] rounded-full -z-10" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-100/20 blur-[100px] rounded-full -z-10" />

                <motion.div
                    className="max-w-7xl mx-auto text-center"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    <motion.div
                        variants={itemVariants}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm mb-8"
                    >
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                            Now with AI-Powered Memory
                        </span>
                    </motion.div>

                    <motion.h1
                        variants={itemVariants}
                        className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
                    >
                        Voice-First AI Triage <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                            For Faster Health Answers
                        </span>
                    </motion.h1>

                    <motion.p
                        variants={itemVariants}
                        className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed"
                    >
                        Understand your symptoms in seconds through natural conversation.
                        Empathetic, clinical-grade triage guidance that remembers your history.
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    Start Your Assessment <ArrowRight className="w-5 h-5" />
                                </button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <button
                                onClick={() => navigate('/app')}
                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                Enter Dashboard <ArrowRight className="w-5 h-5" />
                            </button>
                        </SignedIn>
                        <button className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all">
                            See How It Works
                        </button>
                    </motion.div>

                    {/* Product Preview */}
                    <motion.div
                        variants={itemVariants}
                        className="mt-20 relative max-w-5xl mx-auto px-4"
                    >
                        <div className="absolute inset-0 bg-blue-600/5 blur-[80px] rounded-[60px] -z-10" />
                        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 p-2 md:p-4 rotate-x-12 perspective-1000">
                            <div className="bg-slate-50/50 rounded-[22px] border border-slate-100 p-6 flex items-start gap-4">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 text-left space-y-3">
                                    <div className="h-4 bg-slate-200 rounded-full w-3/4 animate-pulse" />
                                    <div className="h-4 bg-slate-200 rounded-full w-1/2 animate-pulse" />
                                    <div className="pt-2 flex gap-2">
                                        <div className="h-8 w-24 bg-blue-100 rounded-lg" />
                                        <div className="h-8 w-24 bg-slate-100 rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Features Grid */}
            <section className="py-24 px-6 bg-white border-t border-slate-200/50">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <Shield className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Secure & Private</h3>
                            <p className="text-slate-500 leading-relaxed">Your medical data is encrypted and remains under your control. We prioritize your privacy above all else.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Instant Triage</h3>
                            <p className="text-slate-500 leading-relaxed">Skip the search engine anxiety. Get immediate, structured assessments of your symptoms via voice.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Persistent History</h3>
                            <p className="text-slate-500 leading-relaxed">Our AI remembers your past sessions to provide contextually aware guidance for repeat symptoms.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="py-20 px-6 bg-slate-900 text-white rounded-[60px] mx-6 mb-20">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <h2 className="text-3xl md:text-4xl font-bold leading-tight">Empowering patients with expert, accessible triage.</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-y border-white/10">
                        <div>
                            <div className="text-3xl font-bold text-blue-400">98%</div>
                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Accuracy</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-400">2sec</div>
                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Response Time</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-400">24/7</div>
                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Availability</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-400">HIPAA</div>
                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Compliant-Ready</div>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm max-w-xl mx-auto italic">
                        "SymptomSage helped me understand the urgency of my chest pain, directing me to the ER when I was hesitant to call."
                    </p>
                </div>
            </section>

            <footer className="py-12 px-6 border-t border-slate-200">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <span className="font-bold">SymptomSage</span>
                    </div>
                    <p className="text-slate-400 text-xs text-center">
                        &copy; 2026 SymptomSage AI. Not a clinical diagnosis tool. Always seek medical advice from professionals.
                    </p>
                    <div className="flex gap-6 text-sm text-slate-500">
                        <a href="#" className="hover:text-blue-600">Privacy</a>
                        <a href="#" className="hover:text-blue-600">Terms</a>
                        <a href="#" className="hover:text-blue-600">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
