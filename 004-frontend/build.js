#!/usr/bin/env node

// Build script to bypass binary permission issues on Vercel
import { build } from 'vite';
import { resolve } from 'path';

async function buildApp() {
  try {
    console.log('🚀 Starting Vite build process...');
    
    await build({
      root: process.cwd(),
      mode: 'production',
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
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
      define: {
        global: 'globalThis',
      }
    });
    
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildApp();