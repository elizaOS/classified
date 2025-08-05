/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'terminal-green': '#00ff00',
        'terminal-green-dim': 'rgba(0, 255, 0, 0.8)',
        'terminal-green-subtle': 'rgba(0, 255, 0, 0.1)',
        'terminal-green-border': 'rgba(0, 255, 0, 0.3)',
        'terminal-yellow': '#ffff00',
        'terminal-cyan': '#00ffff',
        'terminal-magenta': '#ff00ff',
        'terminal-red': '#ff6666',
        'terminal-orange': '#ffaa00',
        'terminal-blue': '#00aaff',
        'terminal-gray': '#888888',
      },
      fontFamily: {
        mono: ['Courier New', 'Monaco', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        glow: 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 255, 0, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 0, 0.8)' },
        },
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(0deg, transparent 24%, rgba(0, 255, 0, 0.01) 25%, rgba(0, 255, 0, 0.01) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, 0.01) 75%, rgba(0, 255, 0, 0.01) 76%, transparent 77%, transparent),
          linear-gradient(90deg, transparent 24%, rgba(0, 255, 0, 0.01) 25%, rgba(0, 255, 0, 0.01) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, 0.01) 75%, rgba(0, 255, 0, 0.01) 76%, transparent 77%, transparent)
        `,
      },
    },
  },
  plugins: [],
};
