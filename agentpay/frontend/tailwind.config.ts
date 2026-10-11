import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core background and text
        background: "#0a0b0e",
        foreground: "#f4f5f8",

        // Card & Surfaces
        card: {
          DEFAULT: "#141724",
          foreground: "#f4f5f8",
          hover: "#1b1f30",
        },
        secondary: {
          DEFAULT: "#171b29",
          foreground: "#f4f5f8",
          hover: "#202538",
        },
        muted: {
          DEFAULT: "#1e2233",
          foreground: "#9ca3b8",
        },
        popover: {
          DEFAULT: "#141724",
          foreground: "#f4f5f8",
        },

        // Borders & Inputs
        border: {
          DEFAULT: "#252a3d",
          subtle: "#1c202f",
        },
        input: {
          DEFAULT: "#252a3d",
          bg: "#10131d",
        },

        // Brand & Accents
        primary: {
          DEFAULT: "#0052ff",
          foreground: "#ffffff",
          hover: "#0045d8",
        },
        accent: {
          DEFAULT: "#0052ff",
          foreground: "#ffffff",
          glow: "rgba(0, 82, 255, 0.16)",
        },
        ring: "#0052ff",

        // Status Semantics
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
