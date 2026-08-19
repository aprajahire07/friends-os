import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { GoogleGenAI } from '@google/genai';

function aiTutorPlugin() {
  return {
    name: 'college-ai-tutor-server',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/ai/college-tutor' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { prompt, college } = JSON.parse(body || '{}');
              const ai = new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
              });

              const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt || 'Hello',
                config: {
                  systemInstruction: `You are FRIEND OS AI, a friendly college study buddy and academic tutor for students at ${college || 'college'}. Answer questions clearly with markdown, math/code step-by-step explanations, and an encouraging college student tone. Keep answers concise, clear, and actionable.`
                }
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ response: response.text }));
            } catch (err: any) {
              console.error('Gemini API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'AI request failed' }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aiTutorPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
