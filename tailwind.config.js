/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      // Custom animations for markers
      animation: {
        'ping': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'portal-pulse': 'portal-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'portal-pulse': {
          '0%': { 
            transform: 'translate(-50%, -50%) scale(0.8)',
            opacity: '1'
          },
          '100%': { 
            transform: 'translate(-50%, -50%) scale(1.5)',
            opacity: '0'
          }
        }
      },
      // Add border-3 for thicker borders
      borderWidth: {
        '3': '3px'
      }
    },
  },
  plugins: [],
}