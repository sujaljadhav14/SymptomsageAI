import React from 'react';
import MouthMorpher from './MouthMorpher';

/**
 * CharacterSVG — The anime character SVG drawing of "Sage-chan"
 * A chibi-style medical AI assistant with addressable SVG parts
 * for CSS animation and JS-driven lip-sync.
 *
 * ViewBox: 0 0 300 380
 * Character anatomy centered at x=150
 */

interface CharacterSVGProps {
  volume: number;         // 0–1 from audio analyser
  isSpeaking: boolean;    // Whether AI audio is playing
  isListening: boolean;   // Whether user is speaking
  isThinking: boolean;    // Connecting / processing state
  characterState: 'idle' | 'listening' | 'speaking' | 'thinking';
}

const CharacterSVG: React.FC<CharacterSVGProps> = ({
  volume,
  isSpeaking,
  isListening,
  isThinking,
  characterState,
}) => {
  // Eye openness — nearly closed when thinking
  const eyelidScale = isThinking ? 0.08 : 1;

  return (
    <svg
      viewBox="0 0 300 380"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible', width: '100%', height: '100%' }}
      aria-label="Sage-chan AI Medical Assistant"
    >
      <defs>
        {/* Skin gradient */}
        <radialGradient id="skin-grad" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffeee7" />
          <stop offset="60%" stopColor="#ffccbc" />
          <stop offset="100%" stopColor="#ffab91" />
        </radialGradient>

        {/* Hair gradient — deep navy to blue */}
        <linearGradient id="hair-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a237e" />
          <stop offset="50%" stopColor="#283593" />
          <stop offset="100%" stopColor="#3949ab" />
        </linearGradient>

        {/* Eye iris gradient — bright teal */}
        <radialGradient id="iris-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#80deea" />
          <stop offset="40%" stopColor="#00bcd4" />
          <stop offset="100%" stopColor="#0097a7" />
        </radialGradient>

        {/* Doctor coat gradient */}
        <linearGradient id="coat-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e3f2fd" />
        </linearGradient>

        {/* Blue accent gradient for collar/details */}
        <linearGradient id="accent-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1565c0" />
          <stop offset="100%" stopColor="#0d47a1" />
        </linearGradient>

        {/* Glow filter for speaking state */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft shadow for depth */}
        <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1565c020" />
        </filter>

        {/* Sparkle filter */}
        <filter id="sparkle-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════
          BODY GROUP — Everything that floats / tilts
          ═══════════════════════════════════════════════ */}
      <g className="sage-body-group" style={{ transformOrigin: '150px 200px' }}>

        {/* ── HAIR BACK LAYER ── */}
        <g filter="url(#soft-shadow)">
          {/* Back hair flowing down */}
          <path
            d="M 75 155 C 55 200 45 270 55 340 L 85 340 C 80 275 85 210 95 175 Z"
            fill="url(#hair-grad)"
            opacity="0.9"
          />
          <path
            d="M 225 155 C 245 200 255 270 245 340 L 215 340 C 220 275 215 210 205 175 Z"
            fill="url(#hair-grad)"
            opacity="0.9"
          />
        </g>

        {/* ── BODY / DOCTOR COAT ── */}
        <g className="sage-torso" style={{ transformOrigin: '150px 300px' }} filter="url(#soft-shadow)">
          {/* White coat body */}
          <path
            d="M 85 295 C 85 270 105 258 130 255 L 150 260 L 170 255 C 195 258 215 270 215 295 L 225 380 L 75 380 Z"
            fill="url(#coat-grad)"
            stroke="#bbdefb"
            strokeWidth="1"
          />

          {/* Blue collar / top of scrubs */}
          <path
            d="M 128 255 L 150 280 L 172 255 C 165 258 156 263 150 265 C 144 263 135 258 128 255 Z"
            fill="url(#accent-grad)"
          />

          {/* Coat lapels */}
          <path
            d="M 128 255 C 118 260 108 268 103 280 L 85 295 C 95 268 110 258 128 255 Z"
            fill="white"
            stroke="#e3f2fd"
            strokeWidth="0.5"
          />
          <path
            d="M 172 255 C 182 260 192 268 197 280 L 215 295 C 205 268 190 258 172 255 Z"
            fill="white"
            stroke="#e3f2fd"
            strokeWidth="0.5"
          />

          {/* Pocket on coat */}
          <rect x="105" y="305" width="28" height="20" rx="3"
            fill="white" stroke="#bbdefb" strokeWidth="1" />
          <line x1="119" y1="305" x2="119" y2="325" stroke="#bbdefb" strokeWidth="0.5" />

          {/* Stethoscope — hangs from neck */}
          <path
            d="M 140 265 C 135 285 120 295 118 315 C 118 325 128 330 136 325 C 140 322 142 318 140 315"
            fill="none"
            stroke="#546e7a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 160 265 C 165 285 180 295 182 315 C 182 325 172 330 164 325 C 160 322 158 318 160 315"
            fill="none"
            stroke="#546e7a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Stethoscope diaphragm */}
          <circle cx="150" cy="320" r="8" fill="#37474f" stroke="#546e7a" strokeWidth="1.5" />
          <circle cx="150" cy="320" r="4" fill="#546e7a" />

          {/* SymptomSage badge */}
          <rect x="158" y="305" width="42" height="18" rx="4"
            fill="#1565c0" opacity="0.9" />
          <text x="179" y="317.5" fontSize="6" fontWeight="bold" fill="white"
            textAnchor="middle" fontFamily="sans-serif">SAGE AI</text>
        </g>

        {/* ── NECK ── */}
        <path
          d="M 135 248 C 135 256 143 262 150 262 C 157 262 165 256 165 248 L 163 238 L 137 238 Z"
          fill="url(#skin-grad)"
        />

        {/* ── HEAD / FACE ── */}
        <g filter="url(#soft-shadow)">
          {/* Main face shape */}
          <ellipse
            id="sage-face"
            cx="150"
            cy="175"
            rx="86"
            ry="97"
            fill="url(#skin-grad)"
          />

          {/* Cheek blush — left */}
          <ellipse cx="100" cy="200" rx="18" ry="10" fill="#ffb3b3" opacity="0.35" />
          {/* Cheek blush — right */}
          <ellipse cx="200" cy="200" rx="18" ry="10" fill="#ffb3b3" opacity="0.35" />

          {/* ── EYEBROWS ── */}
          {/* Left eyebrow */}
          <path
            d={isListening
              ? "M 100 143 C 110 137 120 136 130 139"  // raised when listening
              : "M 100 147 C 110 141 120 140 130 143"} // normal
            fill="none"
            stroke="#4a2f1a"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ transition: 'd 0.3s ease' }}
          />
          {/* Right eyebrow */}
          <path
            d={isListening
              ? "M 170 139 C 180 136 190 137 200 143"
              : "M 170 143 C 180 140 190 141 200 147"}
            fill="none"
            stroke="#4a2f1a"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ transition: 'd 0.3s ease' }}
          />

          {/* ── LEFT EYE GROUP ── */}
          <g className="sage-eye-group" style={{ transformOrigin: '115px 168px' }}>
            {/* Eye white */}
            <ellipse cx="115" cy="168" rx="22" ry="20" fill="white" />
            {/* Iris */}
            <ellipse cx="115" cy="170" rx="15" ry="16" fill="url(#iris-grad)" />
            {/* Pupil */}
            <ellipse cx="116" cy="171" rx="8" ry="9" fill="#0a0a1a" />
            {/* Eye highlight sparkle */}
            <ellipse cx="119" cy="163" rx="4" ry="3.5" fill="white" opacity="0.9" filter="url(#sparkle-filter)" />
            <circle cx="111" cy="172" r="1.5" fill="white" opacity="0.6" />
            {/* Eyelid / blink cover */}
            <ellipse
              className="sage-eyelid"
              cx="115"
              cy="158"
              rx="22"
              ry="20"
              fill="url(#skin-grad)"
              style={{
                transformOrigin: '115px 148px',
                transform: `scaleY(${eyelidScale})`,
                transition: 'transform 0.1s ease',
              }}
            />
            {/* Eyelashes (upper) */}
            <path d="M 93 157 C 100 148 115 145 137 157"
              fill="none" stroke="#1a0a00" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* ── RIGHT EYE GROUP ── */}
          <g className="sage-eye-group" style={{ transformOrigin: '185px 168px' }}>
            {/* Eye white */}
            <ellipse cx="185" cy="168" rx="22" ry="20" fill="white" />
            {/* Iris */}
            <ellipse cx="185" cy="170" rx="15" ry="16" fill="url(#iris-grad)" />
            {/* Pupil */}
            <ellipse cx="186" cy="171" rx="8" ry="9" fill="#0a0a1a" />
            {/* Eye highlight */}
            <ellipse cx="189" cy="163" rx="4" ry="3.5" fill="white" opacity="0.9" filter="url(#sparkle-filter)" />
            <circle cx="181" cy="172" r="1.5" fill="white" opacity="0.6" />
            {/* Eyelid */}
            <ellipse
              className="sage-eyelid"
              cx="185"
              cy="158"
              rx="22"
              ry="20"
              fill="url(#skin-grad)"
              style={{
                transformOrigin: '185px 148px',
                transform: `scaleY(${eyelidScale})`,
                transition: 'transform 0.1s ease',
              }}
            />
            {/* Eyelashes */}
            <path d="M 163 157 C 170 148 185 145 207 157"
              fill="none" stroke="#1a0a00" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* ── NOSE ── */}
          <path
            d="M 145 197 C 147 203 150 205 153 203"
            fill="none"
            stroke="#e08070"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* ── MOUTH (Lip-Sync target) ── */}
          <MouthMorpher
            volume={volume}
            isActive={isSpeaking}
            mouthColor="#f48fb1"
            mouthStroke="#e91e63"
          />

          {/* ── THOUGHT BUBBLE (visible only in thinking state) ── */}
          <g className="sage-thought-bubble" opacity="0">
            <circle cx="205" cy="115" r="18" fill="white" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.9" />
            <circle cx="222" cy="100" r="12" fill="white" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.8" />
            <circle cx="234" cy="90" r="7" fill="white" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.7" />
            <text x="205" y="119" fontSize="14" textAnchor="middle">🤔</text>
          </g>
        </g>

        {/* ── HAIR FRONT LAYER (over face edges) ── */}
        <g filter="url(#soft-shadow)">
          {/* Main hair dome */}
          <path
            d="M 64 160 C 64 90 100 65 150 62 C 200 65 236 90 236 160 C 236 140 225 118 210 108 C 205 88 185 72 150 70 C 115 72 95 88 90 108 C 75 118 64 140 64 160 Z"
            fill="url(#hair-grad)"
          />

          {/* Side hair left — flowing piece */}
          <path
            d="M 64 160 C 58 185 60 220 68 250 C 72 265 78 270 80 260 C 75 235 72 205 78 180 Z"
            fill="url(#hair-grad)"
          />
          {/* Side hair right */}
          <path
            d="M 236 160 C 242 185 240 220 232 250 C 228 265 222 270 220 260 C 225 235 228 205 222 180 Z"
            fill="url(#hair-grad)"
          />

          {/* Front bangs — left */}
          <path
            d="M 90 108 C 85 120 82 138 84 155 C 88 148 92 135 98 125 C 96 118 92 112 90 108 Z"
            fill="url(#hair-grad)"
          />
          {/* Front bangs — center-left */}
          <path
            d="M 110 88 C 102 100 98 120 102 145 C 108 135 112 118 114 105 C 113 98 111 92 110 88 Z"
            fill="url(#hair-grad)"
          />
          {/* Front bangs — center */}
          <path
            d="M 135 72 C 128 82 124 100 126 128 C 132 115 140 98 142 85 C 140 79 137 74 135 72 Z"
            fill="url(#hair-grad)"
          />
          {/* Front bangs — center-right */}
          <path
            d="M 165 72 C 158 79 155 98 158 128 C 163 100 168 82 172 72 Z"
            fill="url(#hair-grad)"
          />
          {/* Front bangs — right-center */}
          <path
            d="M 190 88 C 188 92 186 98 187 105 C 189 118 193 135 199 145 C 203 120 198 100 190 88 Z"
            fill="url(#hair-grad)"
          />
          {/* Front bangs — right */}
          <path
            d="M 210 108 C 208 112 204 118 202 125 C 208 135 212 148 216 155 C 218 138 215 120 210 108 Z"
            fill="url(#hair-grad)"
          />

          {/* Hair highlights */}
          <path
            className="sage-hair-highlight"
            d="M 115 75 C 125 68 140 66 155 68"
            fill="none"
            stroke="#7986cb"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            className="sage-hair-highlight"
            d="M 100 95 C 108 85 118 80 128 80"
            fill="none"
            stroke="#9fa8da"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.4"
          />

          {/* Hair accessory — medical cross clip */}
          <g transform="translate(188, 95) rotate(15)">
            <rect x="-6" y="-2" width="12" height="4" rx="2" fill="#e53935" />
            <rect x="-2" y="-6" width="4" height="12" rx="2" fill="#e53935" />
          </g>
        </g>

        {/* ── DECORATIVE SPARKLES (visible when speaking) ── */}
        {isSpeaking && (
          <g opacity="0.7" filter="url(#sparkle-filter)">
            <text className="sage-sparkle" x="60" y="130" fontSize="12">✦</text>
            <text className="sage-sparkle" x="230" y="145" fontSize="10">✦</text>
            <text className="sage-sparkle" x="75" y="200" fontSize="8">✧</text>
          </g>
        )}

        {/* ── LISTENING INDICATOR ── */}
        {isListening && (
          <g>
            {/* Sound wave rings from left ear */}
            <path d="M 64 165 C 56 155 56 175 64 165" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.8" />
            <path d="M 60 160 C 48 150 48 180 60 160" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.5" />
            <path d="M 55 155 C 40 145 40 185 55 155" fill="none" stroke="#34d399" strokeWidth="1" opacity="0.3" />
          </g>
        )}
      </g>

      {/* ── SHADOW ELLIPSE at bottom ── */}
      <ellipse
        cx="150"
        cy="376"
        rx="65"
        ry="6"
        fill="rgba(0,0,0,0.08)"
      />
    </svg>
  );
};

export default CharacterSVG;
