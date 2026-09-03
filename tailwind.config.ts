import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          950: "#07030f",
          900: "#0c0718",
          850: "#120a22",
          800: "#170e2b",
          700: "#221540",
          purple: "#8b5cf6",
          blue: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(139,92,246,0.55)",
        "glow-blue": "0 0 24px -6px rgba(34,211,238,0.5)",
        card: "0 8px 32px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "arena-gradient":
          "radial-gradient(1200px 600px at 15% -10%, rgba(139,92,246,0.18), transparent 60%), radial-gradient(1000px 500px at 90% 0%, rgba(34,211,238,0.12), transparent 55%), linear-gradient(180deg, #0c0718 0%, #07030f 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "pop-in": "popIn 0.18s ease-out",
        shimmer: "shimmer 2.4s linear infinite",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        popIn: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        slideUp: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
export default config;
