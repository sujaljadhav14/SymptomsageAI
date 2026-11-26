import React from 'react';

interface LogoProps {
    /** Show the wordmark next to the mark. */
    withText?: boolean;
    /** Invert for dark/teal backgrounds. */
    inverted?: boolean;
    className?: string;
}

/** SymptomSage mark: ink tile with a pulse line. */
export const LogoMark: React.FC<{ size?: number; inverted?: boolean }> = ({ size = 32, inverted = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill={inverted ? '#f6f1e6' : '#0b0b0b'} />
        <path
            d="M4 17h6l3-8 5 15 3.5-10H28"
            fill="none"
            stroke={inverted ? '#0b0b0b' : '#ffcc2e'}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const Logo: React.FC<LogoProps> = ({ withText = true, inverted = false, className = '' }) => (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <LogoMark inverted={inverted} />
        {withText && (
            <span
                className={`font-display text-xl font-extrabold tracking-tight ${inverted ? 'text-paper' : 'text-ink'}`}
            >
                Symptom<span className="font-serif font-normal italic">Sage</span>
            </span>
        )}
    </span>
);

export default Logo;
