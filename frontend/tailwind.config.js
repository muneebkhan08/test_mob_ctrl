/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#e0e6e9",
          100: "#c5cdd2",
          200: "#9ba8b0",
          300: "#72818b",
          400: "#566370",
          500: "#3d4a54",
          600: "#2a343c",
          700: "#1a2028",
          800: "#10151b",
          900: "#0a0e12",
          950: "#050709",
        },
        accent: {
          DEFAULT: "#00ffc8",
          light: "#5cffe0",
          dark: "#00cc9f",
        },
        success: "#00ff88",
        danger: "#ff3355",
        warning: "#ffaa00",
      },
      fontFamily: {
        sans: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "monospace",
        ],
        mono: ["JetBrains Mono", "Fira Code", "SF Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 255, 200, 0.25), 0 0 60px rgba(0, 255, 200, 0.08)",
        "glow-success": "0 0 20px rgba(0, 255, 136, 0.25)",
        "glow-danger": "0 0 20px rgba(255, 51, 85, 0.25)",
        "glow-sm": "0 0 8px rgba(0, 255, 200, 0.15)",
        "inner-glow": "inset 0 0 20px rgba(0, 255, 200, 0.05)",
      },
      animation: {
        "scan": "scan 4s linear infinite",
        "flicker": "flicker 0.15s ease-in-out",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "data-stream": "dataStream 2s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(0, 255, 200, 0.1)" },
          "50%": { boxShadow: "0 0 15px rgba(0, 255, 200, 0.2)" },
        },
        dataStream: {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "0% 100%" },
        },
      },
    },
  },
  plugins: [],
};
