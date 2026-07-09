import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaff",
          100: "#dff5ff",
          200: "#baeaff",
          300: "#80d9ff",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        ink: {
          900: "#152033",
          700: "#31415c",
          500: "#61708a",
        },
      },
      boxShadow: {
        soft: "0 24px 80px rgba(73, 143, 205, 0.16)",
        panel: "0 18px 50px rgba(75, 103, 140, 0.12)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
