#!/usr/bin/env node

// Standalone build script to bypass esbuild binary permission issues on Vercel
import { build } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

async function buildApp() {
  try {
    console.log('🚀 Starting standalone Vite build process...');
    console.log('📁 Working directory:', process.cwd());
    console.log('🟢 Node.js version:', process.version);
    
    // Completely standalone config that doesn't load vite.config.ts
    const config = {
      root: process.cwd(),
      mode: 'production',
      configFile: false, // Don't load vite.config.ts
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
        minify: 'terser', // Use terser instead of esbuild
        target: 'es2020',
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
      // Disable esbuild completely
      esbuild: false,
      optimizeDeps: {
        disabled: true
      },
      define: {
        global: 'globalThis',
        'process.env.NODE_ENV': JSON.stringify('production')
      }
    };
    
    console.log('⚙️  Starting build with standalone config...');
    await build(config);
    
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

buildApp();