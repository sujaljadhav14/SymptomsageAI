/** @type {import('tailwindcss').Config} */
// Theme: "Clinical editorial" — see docs/DESIGN_SYSTEM.md.
// The legacy blue/indigo/slate/red/amber palettes are REMAPPED to brand colours so
// every existing class (bg-blue-600, text-slate-500, ...) inherits the new look.

const brand = {
  50: '#eaf7f4',
  100: '#cfeee7',
  200: '#a3dfd2',
  300: '#6cc9b8',
  400: '#35ae9b',
  500: '#129283',
  600: '#0d7a69',
  700: '#0a6355',
  800: '#084d43',
  900: '#063a33',
  950: '#032621',
};

const ink = {
  50: '#f8f4ea',
  100: '#f1ebdc',
  200: '#e4dccd',
  300: '#cfc5b0',
  400: '#7d7467',
  500: '#615a4e',
  600: '#4f483d',
  700: '#38332a',
  800: '#24201a',
  900: '#151310',
  950: '#0b0b0b',
};

const signal = {
  50: '#fdecea',
  100: '#fde3df',
  200: '#f9c0ba',
  300: '#f3948b',
  400: '#ec5f54',
  500: '#e3150e',
  600: '#cc120c',
  700: '#b00f08',
  800: '#8a0c07',
  900: '#6b0905',
};

const caution = {
  50: '#fff8de',
  100: '#fff2c2',
  200: '#ffe58a',
  300: '#ffd95e',
  400: '#ffcc2e',
  500: '#e0ad00',
  600: '#a87800',
  700: '#7a5800',
  800: '#5c4200',
  900: '#403000',
};

const indigoInk = {
  50: '#eef6f4',
  100: '#d9ebe6',
  200: '#b4d6cd',
  300: '#86bbae',
  400: '#55998a',
  500: '#34796b',
  600: '#0a5f52',
  700: '#084a40',
  800: '#063a33',
  900: '#042a25',
};

export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Semantic tokens (use these in new code)
        paper: { DEFAULT: '#f6f1e6', 2: '#efe8d9' },
        rule: '#e4dccd',
        ink: { DEFAULT: '#0b0b0b', 2: '#26221c', 3: '#5a5246' },
        brand,
        signal: { DEFAULT: '#e3150e', soft: '#fde3df', ink: '#b00f08' },
        caution: { DEFAULT: '#ffcc2e', soft: '#fff2c2', ink: '#6b4e00' },
        leaf: { DEFAULT: '#bfe9b3', ink: '#0b6b5b' },
        // Legacy remaps
        slate: ink,
        blue: brand,
        indigo: indigoInk,
        red: signal,
        amber: caution,
      },
      borderRadius: {
        xl: '10px',
        '2xl': '14px',
        '3xl': '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(11,11,11,0.08)',
        DEFAULT: '2px 2px 0 #0b0b0b',
        md: '2px 2px 0 #0b0b0b',
        lg: '3px 3px 0 #0b0b0b',
        xl: '4px 4px 0 #0b0b0b',
        '2xl': '6px 6px 0 #0b0b0b',
        hard: '4px 4px 0 #0b0b0b',
        'hard-sm': '2px 2px 0 #0b0b0b',
        'hard-brand': '4px 4px 0 #0d7a69',
        'hard-signal': '4px 4px 0 #e3150e',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        draw: {
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s infinite linear',
        floaty: 'floaty 6s ease-in-out infinite',
        draw: 'draw 2.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
