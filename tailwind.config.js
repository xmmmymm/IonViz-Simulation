/** @type {import('tailwindcss').Config} */
// 本地编译 Tailwind：不再依赖 cdn.tailwindcss.com，打包后可完全离线运行
module.exports = {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './constants.ts',
    './types.ts',
    './components/**/*.{ts,tsx}',
    './electron/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
