#!/usr/bin/env node

// Build script to bypass binary permission issues on Vercel
import { build } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

async function buildApp() {
  try {
    console.log('🚀 Starting Vite build process...');
    console.log('📁 Working directory:', process.cwd());
    console.log('🟢 Node.js version:', process.version);
    
    const config = {
      root: process.cwd(),
      mode: 'production',
      plugins: [react()],
      resolve: {
        alias: {
          '@': resolve(process.cwd(), './src'),
        },
      },
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
      esbuild: {
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext'
        }
      },
      define: {
        global: 'globalThis',
        'process.env.NODE_ENV': JSON.stringify('production')
      }
    };
    
    console.log('⚙️  Starting build with config...');
    await build(config);
    
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

buildApp();