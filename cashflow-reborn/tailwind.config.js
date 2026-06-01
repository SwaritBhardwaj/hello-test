/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Nostalgic board-game display face
        display: ['"Fredoka Variable"', 'ui-rounded', 'system-ui', 'sans-serif'],
        // Clean humanist UI sans (not Inter)
        sans: ['"Outfit Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Tabular numerals for all money / ledger
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // token scale, ratio >= 1.25, line-heights tuned for UI
        '2xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.75rem', { lineHeight: '2rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.375rem' }],
        display: ['2.75rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
      },
      colors: {
        // ---- Surfaces ----
        felt: {
          DEFAULT: 'oklch(0.33 0.055 158)',
          900: 'oklch(0.26 0.05 158)',
          800: 'oklch(0.30 0.055 158)',
          700: 'oklch(0.36 0.06 158)',
          600: 'oklch(0.43 0.065 158)',
        },
        wood: {
          DEFAULT: 'oklch(0.42 0.06 62)',
          900: 'oklch(0.30 0.05 55)',
          700: 'oklch(0.42 0.06 62)',
          500: 'oklch(0.55 0.07 65)',
        },
        brass: {
          DEFAULT: 'oklch(0.78 0.12 84)',
          600: 'oklch(0.70 0.13 80)',
          500: 'oklch(0.78 0.12 84)',
          300: 'oklch(0.88 0.09 88)',
          100: 'oklch(0.95 0.04 88)',
        },
        card: {
          DEFAULT: 'oklch(0.975 0.012 86)',
          edge: 'oklch(0.92 0.02 86)',
        },
        ink: {
          DEFAULT: 'oklch(0.27 0.02 62)',
          soft: 'oklch(0.45 0.02 62)',
          faint: 'oklch(0.62 0.015 62)',
        },
        // ---- Semantic money ----
        income: {
          DEFAULT: 'oklch(0.60 0.13 158)',
          soft: 'oklch(0.94 0.05 158)',
          ink: 'oklch(0.42 0.10 158)',
        },
        expense: {
          DEFAULT: 'oklch(0.58 0.17 26)',
          soft: 'oklch(0.95 0.04 26)',
          ink: 'oklch(0.47 0.16 26)',
        },
        caution: {
          DEFAULT: 'oklch(0.80 0.14 76)',
          soft: 'oklch(0.96 0.05 80)',
          ink: 'oklch(0.55 0.12 70)',
        },
      },
      borderRadius: {
        game: '1.25rem',
        tile: '0.625rem',
      },
      boxShadow: {
        // tinted to surface hue, not gray
        card: '0 2px 4px -2px oklch(0.30 0.05 60 / 0.25), 0 8px 20px -8px oklch(0.30 0.05 60 / 0.30)',
        piece: '0 2px 3px oklch(0.25 0.04 60 / 0.4), 0 6px 10px -4px oklch(0.25 0.04 60 / 0.35)',
        inset: 'inset 0 2px 6px oklch(0.20 0.04 158 / 0.45)',
        brass: '0 0 0 1px oklch(0.70 0.13 80 / 0.5), 0 6px 16px -6px oklch(0.78 0.12 84 / 0.55)',
      },
      keyframes: {
        'card-in': {
          '0%': { transform: 'translateY(14px) scale(0.96)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'coin-pop': {
          '0%': { transform: 'translateY(6px) scale(0.6)', opacity: '0' },
          '60%': { transform: 'translateY(-2px) scale(1.06)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0) scale(0.9)', opacity: '0' },
          '20%': { transform: 'translateY(-6px) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-38px) scale(1)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(3px)' },
        },
        'glow-pulse': {
          '0%,100%': { boxShadow: '0 0 0 0 oklch(0.78 0.12 84 / 0.45)' },
          '50%': { boxShadow: '0 0 26px 4px oklch(0.78 0.12 84 / 0.6)' },
        },
        'danger-pulse': {
          '0%,100%': { boxShadow: '0 0 0 0 oklch(0.58 0.17 26 / 0.5)' },
          '50%': { boxShadow: '0 0 18px 3px oklch(0.58 0.17 26 / 0.75)' },
        },
        'token-bob': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'card-in': 'card-in 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'coin-pop': 'coin-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'float-up': 'float-up 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shake: 'shake 0.4s ease-in-out',
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        'danger-pulse': 'danger-pulse 1.4s ease-in-out infinite',
        'token-bob': 'token-bob 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
