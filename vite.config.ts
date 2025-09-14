import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.FIRECRAWL_API_KEY': JSON.stringify(env.FIRECRAWL_API_KEY),
        // Enable or disable 3D visuals at build/runtime: set ENABLE_3D=true
        'process.env.ENABLE_3D': JSON.stringify(env.ENABLE_3D ?? 'false'),
        // Comma-separated list of live model slugs to try in order
        'process.env.LIVE_MODELS': JSON.stringify(env.LIVE_MODELS ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // No dev-time proxy configured.
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('/three')) return 'vendor-three';
                if (id.includes('/lit')) return 'vendor-lit';
                if (id.includes('@google/genai')) return 'vendor-genai';
                if (
                  id.includes('html2canvas') ||
                  id.includes('jspdf') ||
                  id.includes('marked')
                ) {
                  return 'vendor-viz';
                }
              }
              return undefined;
            },
          },
        },
        chunkSizeWarningLimit: 1200,
      },
    };
});
