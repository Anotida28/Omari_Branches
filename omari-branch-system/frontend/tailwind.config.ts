import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 1px -1px rgb(15 23 42 / 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
