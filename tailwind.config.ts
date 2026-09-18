import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        card: "#12141c",
        sidebar: "#0d0f14",
        text: {
          primary: "#e6e7ec",
          secondary: "#9396a1",
        },
        bull: "#26A69A",
        bear: "#EF5350",
        lateral: "#FFA726",
        link: "#5a8de8",
        border: "#262936",
      },
      borderRadius: {
        card: "10px",
        button: "6px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
