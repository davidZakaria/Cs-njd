import type { Config } from "tailwindcss";

/**
 * Tailwind v4 supplemental theme — fonts, motion, elevation.
 * Core color tokens live in app/globals.css; @config loads this file.
 */
const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: [
          "var(--font-display)",
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(15px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "scale-in": "scale-in 0.35s ease-out forwards",
      },
      boxShadow: {
        premium:
          "0 10px 30px -10px rgb(15 23 42 / 0.06), 0 4px 12px -4px rgb(15 23 42 / 0.04)",
        "premium-lg":
          "0 20px 40px -12px rgb(15 23 42 / 0.1), 0 8px 20px -8px rgb(15 23 42 / 0.06)",
        "premium-dark":
          "0 10px 30px -10px rgb(0 0 0 / 0.45), 0 4px 12px -4px rgb(0 0 0 / 0.3)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
};

export default config;
