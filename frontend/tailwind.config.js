/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Desktop-width but short viewports (e.g. 1366×657, 1536×730 laptops): tighter task pages.
        short: { raw: "(min-width: 1024px) and (max-height: 800px)" },
      },
      colors: {
        ink: {
          950: '#07090C',
          900: '#0B0E13',
          850: '#0F131A',
          800: '#141922',
          700: '#1E2530',
          600: '#2A3341',
          500: '#3A4556',
        },
        bone: {
          DEFAULT: '#ECE7DC',
          dim: '#C9C4B8',
        },
        mist: '#8E97A6',
        signal: {
          DEFAULT: '#C6F36B',
          bright: '#D6FA8F',
        },
        // DEFAULT: text/accents. fill: chart marks, stepped into the dark-mode lightness band
        // (validated with the dataviz palette checker: CVD ΔE 9.0, contrast ≥ 3:1).
        real: { DEFAULT: '#3FD9A0', fill: '#1E9F73' },
        fake: { DEFAULT: '#FF6A55', fill: '#E8553F' },
        caution: '#F4B740',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        display: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        scan: {
          '0%': { top: '-25%' },
          '100%': { top: '100%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
        // End on `transform: none` so finished elements don't keep a
        // containing block / stacking context around their children.
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'line-up': {
          '0%': { transform: 'translateY(105%)' },
          '100%': { transform: 'none' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'menu-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        drift: {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(-48px, 36px, 0)' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        scan: 'scan 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-up-fast': 'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'page-in': 'page-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'line-up': 'line-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'menu-in': 'menu-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        drift: 'drift 22s ease-in-out infinite alternate',
        blink: 'blink 1.6s ease-in-out infinite',
        indeterminate: 'indeterminate 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
      },
    },
  },
  plugins: [],
};
