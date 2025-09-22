/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'figma-bg': 'var(--figma-color-bg)',
        'figma-bg-secondary': 'var(--figma-color-bg-secondary)',
        'figma-border': 'var(--figma-color-border)',
        'figma-text': 'var(--figma-color-text)',
      },
    },
  },
  plugins: [],
  darkMode: ['class', '.figma-dark']
}
