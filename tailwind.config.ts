// Removed the type import to avoid moduleResolution errors with ESM .d.mts files.
// If you want full type support, update your tsconfig.json to use "moduleResolution": "node16" or "nodenext".

const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
