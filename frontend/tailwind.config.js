/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Editorial Light Palette ("Abstra" theme)
        'canvas-bg': '#E5E4E0',
        'canvas-card': '#F7F6F3',
        'abstra-dark': '#19191B',
        'abstra-muted': '#6B6B73',
        'abstra-subtle': '#9E9EA6',
        'abstra-border': '#D8D7D2',
        'abstra-terracotta': '#C87A7A',
        'abstra-mauve': '#A35C6A',
        'abstra-sand': '#E2D5C3',
        'signal-teal': '#2E7D6F',
        'ember-orange': '#D97706',
        'alarm-red': '#BE123C',
      },
      fontFamily: {
        sans: ['"DM Sans"', '"Inter"', 'sans-serif'],
        display: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'abstra': '0 20px 40px -15px rgba(0, 0, 0, 0.07), 0 0 1px 1px rgba(255, 255, 255, 0.8) inset',
        'abstra-glass': '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
      }
    },
  },
  plugins: [],
}
