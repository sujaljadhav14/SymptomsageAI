/**
 * Single source of truth for how triage urgency looks and reads.
 * Colour = urgency (see docs/DESIGN_SYSTEM.md). Used by the checker, results and dashboard.
 */
export type RiskLevel = 'emergency' | 'high' | 'moderate' | 'low';

export interface UrgencyStyle {
    /** Short pill label */
    label: string;
    /** What the person should do */
    action: string;
    /** Tailwind classes for a solid banner/pill */
    banner: string;
    /** Tailwind classes for a small dot */
    dot: string;
}

export const URGENCY: Record<RiskLevel, UrgencyStyle> = {
    emergency: {
        label: 'Emergency',
        action: 'Call 112 or 108 now',
        banner: 'bg-signal text-white',
        dot: 'bg-signal',
    },
    high: {
        label: 'See a doctor within 24 hours',
        action: 'Book or walk in today or tomorrow',
        banner: 'bg-orange-400 text-ink',
        dot: 'bg-orange-500',
    },
    moderate: {
        label: 'See a doctor this week',
        action: 'Book a regular appointment',
        banner: 'bg-caution text-ink',
        dot: 'bg-caution',
    },
    low: {
        label: 'Home care for now',
        action: 'Rest, fluids, and watch for change',
        banner: 'bg-leaf text-ink',
        dot: 'bg-leaf-ink',
    },
};

export const EMERGENCY_NUMBERS = { national: '112', ambulance: '108' } as const;

export function urgencyFor(level: string): UrgencyStyle {
    return URGENCY[(level as RiskLevel) in URGENCY ? (level as RiskLevel) : 'low'];
}
