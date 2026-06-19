/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/frontend/index.html", "./src/frontend/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro"',
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        accent: {
          DEFAULT: "#0A84FF",
          soft: "rgba(10,132,255,0.16)",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        sheet: "0 -8px 40px rgba(0,0,0,0.55)",
        float: "0 8px 30px rgba(0,0,0,0.45)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        breathe: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        breathe: "breathe 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
