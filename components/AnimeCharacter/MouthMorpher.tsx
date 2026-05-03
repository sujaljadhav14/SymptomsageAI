import React from 'react';

/**
 * MouthMorpher
 * Animates the SVG mouth path based on the given audio volume (0–1).
 * Volume thresholds map to 4 mouth shapes: closed → small → medium → wide.
 * Uses CSS transition on the SVG `d` property for smooth interpolation.
 */

interface MouthMorpherProps {
  volume: number; // 0 to 1
  isActive: boolean; // Only animate when AI is actually speaking
  mouthColor?: string;
  mouthStroke?: string;
}

// All paths MUST have the same structure (number of commands) for CSS morphing.
// Format: M (start) C (cubic bezier upper) L (corners) C (cubic bezier lower) Z
// Coordinates are in the CharacterSVG's viewBox (0 0 300 380)
const MOUTH_SHAPES = {
  // Gentle closed smile — resting face
  closed: "M 122 226 C 136 231 164 231 178 226 C 164 228 136 228 122 226 Z",
  // Very slightly parted — quiet speech
  small:  "M 120 225 C 135 233 165 233 180 225 C 165 236 135 236 120 225 Z",
  // Medium open — normal speech
  medium: "M 118 223 C 133 235 167 235 182 223 C 167 242 133 242 118 223 Z",
  // Wide open — emphasis, loud speech
  wide:   "M 115 220 C 132 237 168 237 185 220 C 168 248 132 248 115 220 Z",
};

function volumeToShape(volume: number, isActive: boolean): keyof typeof MOUTH_SHAPES {
  if (!isActive || volume < 0.04) return 'closed';
  if (volume < 0.20) return 'small';
  if (volume < 0.50) return 'medium';
  return 'wide';
}

const MouthMorpher: React.FC<MouthMorpherProps> = ({
  volume,
  isActive,
  mouthColor = '#f06292',
  mouthStroke = '#e91e63',
}) => {
  const shape = volumeToShape(volume, isActive);
  const d = MOUTH_SHAPES[shape];

  return (
    <>
      {/* Upper lip / mouth outline */}
      <path
        d={d}
        fill={mouthColor}
        stroke={mouthStroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{
          transition: 'all 0.06s ease-out',
        }}
      />

      {/* Teeth hint — subtle white arc inside mouth when open */}
      {(shape === 'medium' || shape === 'wide') && (
        <path
          d={
            shape === 'medium'
              ? "M 122 226 C 135 238 165 238 178 226"
              : "M 120 225 C 134 243 166 243 180 225"
          }
          fill="white"
          stroke="none"
          style={{ transition: 'all 0.06s ease-out' }}
        />
      )}

      {/* Tongue hint — only visible wide open */}
      {shape === 'wide' && (
        <ellipse
          cx="150"
          cy="243"
          rx="12"
          ry="5"
          fill="#f48fb1"
          opacity="0.7"
          style={{ transition: 'opacity 0.1s ease' }}
        />
      )}
    </>
  );
};

export default MouthMorpher;
