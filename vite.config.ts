import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 关键修改：将绝对路径改为相对路径 ('./')
  // Electron 在生产环境中通过 file:// 协议加载文件，绝对路径会导致找不到资源
  base: './',
});