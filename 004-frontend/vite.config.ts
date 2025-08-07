import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps for production builds
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion', '@heroicons/react'],
          maps: ['leaflet', 'react-leaflet'],
          charts: ['recharts']
        }
      }
    }
  },
  // Force esbuild to use the correct binary
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  // Vercel-specific configuration
  define: {
    global: 'globalThis',
  }
})