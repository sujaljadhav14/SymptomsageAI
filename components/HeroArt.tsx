import React from 'react';
import { motion } from 'framer-motion';
import { Check, Phone } from 'lucide-react';

/**
 * Hero illustration: halftone sun, drawn ECG line and an *illustrative*
 * triage card. Original artwork, no external assets.
 */
const HeroArt: React.FC = () => (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-[560px]">
        {/* Sun + ECG */}
        <svg viewBox="0 0 560 466" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
                <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse">
                    <circle cx="4.5" cy="4.5" r="1.7" fill="#0b0b0b" opacity="0.32" />
                </pattern>
                <clipPath id="sun">
                    <circle cx="290" cy="225" r="190" />
                </clipPath>
            </defs>
            <circle cx="290" cy="225" r="190" fill="#ffcc2e" stroke="#0b0b0b" strokeWidth="4" />
            <g clipPath="url(#sun)">
                <rect x="290" y="30" width="200" height="400" fill="url(#dots)" />
                <circle cx="215" cy="150" r="80" fill="#fff2c2" opacity="0.7" />
            </g>
            <path
                d="M10 250 H150 L185 170 L235 335 L285 120 L335 300 L365 250 H550"
                fill="none"
                stroke="#0b0b0b"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
                className="animate-draw"
            />
        </svg>

        {/* Illustrative triage card */}
        <motion.div
            initial={{ opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="absolute bottom-[2%] left-[0%] w-[68%] rounded-2xl border-2 border-ink bg-white p-4 shadow-hard"
        >
            <div className="mb-2 flex items-center justify-between">
                <span className="label-mono !text-[10px]">Illustrative example</span>
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            </div>
            <p className="font-display text-[15px] font-bold leading-snug text-ink">
                Fever and sore throat for 2 days
            </p>
            <div className="mt-2 inline-block rounded-md border-2 border-ink bg-orange-100 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-orange-800">
                See a doctor within 24h
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Why: fever with throat pain lasting over 48 hours. No emergency signs found.
            </p>
        </motion.div>

        {/* Red flags chip */}
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute right-[0%] top-[10%] flex items-center gap-2 rounded-full border-2 border-ink bg-leaf px-3.5 py-2 text-xs font-bold shadow-hard-sm"
        >
            <Check className="h-4 w-4" strokeWidth={3} />
            Red flags checked first
        </motion.div>

        {/* 112 badge */}
        <motion.a
            href="tel:112"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, type: 'spring', stiffness: 220, damping: 14 }}
            className="absolute bottom-[8%] right-[2%] flex h-24 w-24 animate-floaty flex-col items-center justify-center rounded-full border-2 border-ink bg-signal text-white shadow-hard"
            aria-label="Call emergency services, 112"
        >
            <Phone className="mb-0.5 h-4 w-4" />
            <span className="font-display text-2xl font-extrabold leading-none">112</span>
            <span className="font-mono text-[8px] uppercase tracking-widest">Emergency</span>
        </motion.a>
    </div>
);

export default HeroArt;
