/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Dark mode color system based on UI/UX guidelines
        dark: {
          primary: '#0d1117',    // Primary background
          secondary: '#161b22',  // Secondary background 
          tertiary: '#21262d',   // Tertiary background
          border: '#30363d',     // Border color
          hover: '#262c36',      // Hover state
        },
        text: {
          primary: '#f0f6fc',    // Primary text
          secondary: '#8b949e',  // Secondary text
          muted: '#6e7681',      // Muted text
        },
        status: {
          operational: '#238636', // Green - normal operations
          warning: '#d29922',     // Amber - warnings
          critical: '#da3633',    // Red - critical
          active: '#1f6feb',      // Blue - active selections
          coordination: '#8957e5', // Purple - coordination events
        },
        battery: {
          high: '#238636',        // >70% - Green
          medium: '#d29922',      // 30-70% - Amber
          low: '#da3633',         // <30% - Red
          critical: '#f85149',    // <15% - Critical red
        }
      },
      spacing: {
        // 8px base spacing system
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '26': '6.5rem',   // 104px
        '30': '7.5rem',   // 120px
        '34': '8.5rem',   // 136px
        '38': '9.5rem',   // 152px
        '42': '10.5rem',  // 168px
        '46': '11.5rem',  // 184px
        '50': '12.5rem',  // 200px
        '80': '20rem',    // 320px (sidebar width)
      },
      fontFamily: {
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      borderRadius: {
        'DEFAULT': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(31, 111, 235, 0.3)',
        'glow-green': '0 0 20px rgba(35, 134, 54, 0.3)',
        'glow-red': '0 0 20px rgba(218, 54, 51, 0.3)',
        'glow-amber': '0 0 20px rgba(210, 153, 34, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}