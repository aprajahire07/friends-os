import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { GoogleGenAI } from '@google/genai';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY = 
  process.env.VAPID_PUBLIC_KEY || 
  "BIuU2K8p706ypy_bWNBdoaOlrNNle1SCmF6hl1sA_ulg9N4VnhqaNVGtwKGQXZI9lLZIwlPVI0JUS5BmGBLu_Kk";

const VAPID_PRIVATE_KEY = 
  process.env.VAPID_PRIVATE_KEY || 
  "W2-FTYlc10eiMCMXzfAc428BZu-LbFqoQOBZpGKoy9Q";

const VAPID_SUBJECT = 
  process.env.VAPID_SUBJECT || 
  "mailto:aprajahire07@gmail.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://leozfdimmqqblquuazcj.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_OwANrJR92NdoVDlCvVPmpA_QQeKI58R";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("VAPID initialization note:", err);
}

function pushGatewayPlugin() {
  return {
    name: 'friend-os-push-gateway',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/send-push' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const {
                recipient_user_ids = [],
                all = false,
                title = "Friend OS",
                body: messageBody = "",
                section = "home",
                icon = "/icons/icon-192.png",
                badge = "/icons/icon-192.png",
                image,
                tag,
                data = {}
              } = payload;

              const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false },
              });

              let query = supabaseClient
                .from("push_subscriptions")
                .select("id, user_id, endpoint, p256dh, auth");

              if (all) {
                // Broadcast to all devices
              } else if (Array.isArray(recipient_user_ids) && recipient_user_ids.length > 0) {
                query = query.in("user_id", recipient_user_ids);
              } else {
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  delivered: 0,
                  failed: 0,
                  cleaned: 0,
                  message: "No recipient user IDs specified."
                }));
                return;
              }

              const { data: subscriptions, error: subError } = await query;

              if (subError) {
                console.warn("Database query for push subscriptions:", subError.message);
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: false,
                  delivered: 0,
                  failed: 0,
                  cleaned: 0,
                  error: `Database: ${subError.message}. Please run the push_subscriptions SQL migration in Supabase SQL editor.`
                }));
                return;
              }

              if (!subscriptions || subscriptions.length === 0) {
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  delivered: 0,
                  failed: 0,
                  cleaned: 0,
                  message: "No active push devices registered for the target recipients."
                }));
                return;
              }

              const pushPayload = JSON.stringify({
                title,
                body: messageBody,
                section,
                icon,
                badge,
                image,
                tag: tag || `friend-os-${Date.now()}`,
                data: {
                  section,
                  url: `/?tab=${section}`,
                  ...data
                }
              });

              let delivered = 0;
              let failed = 0;
              const expiredSubscriptionIds: string[] = [];

              await Promise.all(
                subscriptions.map(async (sub: any) => {
                  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
                    failed++;
                    return;
                  }

                  const pushSub = {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth
                    }
                  };

                  try {
                    await webpush.sendNotification(pushSub, pushPayload, {
                      TTL: 86400,
                      urgency: "high"
                    });
                    delivered++;
                  } catch (err: any) {
                    failed++;
                    const statusCode = err?.statusCode;
                    if (statusCode === 410 || statusCode === 404) {
                      if (sub.id) {
                        expiredSubscriptionIds.push(sub.id);
                      }
                    }
                  }
                })
              );

              let cleaned = 0;
              if (expiredSubscriptionIds.length > 0) {
                try {
                  const { error: deleteErr } = await supabaseClient
                    .from("push_subscriptions")
                    .delete()
                    .in("id", expiredSubscriptionIds);
                  if (!deleteErr) cleaned = expiredSubscriptionIds.length;
                } catch {
                  // non-blocking
                }
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                delivered,
                failed,
                cleaned
              }));
            } catch (err: any) {
              console.error("Push gateway plugin error:", err);
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: false,
                error: err?.message || "Failed to process push request"
              }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

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
    plugins: [react(), tailwindcss(), aiTutorPlugin(), pushGatewayPlugin()],
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
