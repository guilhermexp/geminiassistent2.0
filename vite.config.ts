import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.OPENAI_REALTIME_URL': JSON.stringify(env.OPENAI_REALTIME_URL || '/openai-realtime'),
        'process.env.DEFAULT_VOICE_PROVIDER': JSON.stringify(env.DEFAULT_VOICE_PROVIDER ?? 'openai'),
        'process.env.OPENAI_VOICE': JSON.stringify(env.OPENAI_VOICE ?? 'nova'),
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
      server: {
        proxy: {
          // Dev-time proxy for OpenAI Realtime WebSocket. This avoids exposing
          // Authorization headers in the browser and works around the browser
          // limitation of setting custom WS headers.
          '/openai-realtime': {
            target: 'https://api.openai.com',
            changeOrigin: true,
            secure: true,
            ws: true,
            headers: {
              Authorization: env.OPENAI_API_KEY ? `Bearer ${env.OPENAI_API_KEY}` : '',
              'OpenAI-Beta': 'realtime=v1',
            },
            rewrite: (path) => path.replace(/^\/openai-realtime/, '/v1/realtime'),
          },
        },
      },
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
