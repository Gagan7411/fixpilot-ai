import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  define: {
    // This allows process.env to work in the browser for the SDK
    'process.env': process.env
  }
});