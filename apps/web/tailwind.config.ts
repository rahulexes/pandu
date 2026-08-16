import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        table: {
          dark: '#0a1628',
          mid: '#0f2035',
          felt: '#1a3a2a',
        },
        accent: {
          gold: '#f0c040',
          amber: '#e8a020',
          emerald: '#10b981',
          rose: '#f43f5e',
          violet: '#8b5cf6',
          sky: '#38bdf8',
        },
      },
    },
  },
  plugins: [],
};

export default config;
