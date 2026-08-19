import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// VAPID Credentials for RFC 8292 Web Push
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

// Configure webpush with VAPID
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("VAPID initialization notice:", err);
}

/**
 * Server-Side Notification Events Queue Processor
 * Drains public.notification_events table and dispatches Web Push to recipients
 */
async function processNotificationEventsQueue(supabaseClient: any) {
  try {
    // 1. Fetch pending notification events
    const { data: events, error: fetchErr } = await supabaseClient
      .from("notification_events")
      .select("id, event_type, source_id, actor_user_id, recipient_user_id, payload, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(30);

    if (fetchErr) {
      if (!fetchErr.message?.includes("does not exist") && !fetchErr.message?.includes("schema")) {
        console.warn("Error fetching notification events:", fetchErr.message);
      }
      return { processed: 0, failed: 0 };
    }

    if (!events || events.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const eventIds = events.map((e: any) => e.id);
    
    // Mark them processing
    await supabaseClient
      .from("notification_events")
      .update({ status: "processing" })
      .in("id", eventIds);

    let processedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      try {
        const recipientUserId = event.recipient_user_id;
        const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : (event.payload || {});

        // Fetch recipient's push subscriptions using Service Role
        const { data: subs, error: subErr } = await supabaseClient
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", recipientUserId);

        if (subErr || !subs || subs.length === 0) {
          // No active push device registered for this recipient
          await supabaseClient
            .from("notification_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error_message: subs?.length === 0 ? "No active push device registered for recipient" : (subErr?.message || "")
            })
            .eq("id", event.id);
          processedCount++;
          continue;
        }

        const pushPayload = JSON.stringify({
          title: payload.title || "Friend OS",
          body: payload.body || "You have a new update in Friend OS",
          section: payload.section || "home",
          icon: payload.icon || "/icons/icon-192.png",
          badge: payload.badge || "/icons/icon-192.png",
          image: payload.image || undefined,
          tag: payload.tag || `friend-os-${event.event_type}-${Date.now()}`,
          data: {
            section: payload.section || "home",
            url: `/?tab=${payload.section || "home"}`,
            ...(payload.data || {}),
            eventId: event.id,
            sourceId: event.source_id,
            eventType: event.event_type
          }
        });

        const expiredSubIds: string[] = [];

        await Promise.all(
          subs.map(async (sub: any) => {
            if (!sub.endpoint || !sub.p256dh || !sub.auth) return;
            const pushSub = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            try {
              await webpush.sendNotification(pushSub, pushPayload, {
                TTL: 86400,
                urgency: "high"
              });
            } catch (err: any) {
              const code = err?.statusCode;
              if (code === 410 || code === 404) {
                if (sub.id) expiredSubIds.push(sub.id);
              }
            }
          })
        );

        if (expiredSubIds.length > 0) {
          await supabaseClient.from("push_subscriptions").delete().in("id", expiredSubIds);
        }

        await supabaseClient
          .from("notification_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString()
          })
          .eq("id", event.id);

        processedCount++;
      } catch (evtErr: any) {
        failedCount++;
        await supabaseClient
          .from("notification_events")
          .update({
            status: "failed",
            error_message: evtErr?.message || "Error during push delivery"
          })
          .eq("id", event.id);
      }
    }

    return { processed: processedCount, failed: failedCount };
  } catch (err: any) {
    console.warn("processNotificationEventsQueue error:", err?.message);
    return { processed: 0, failed: 0 };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Start background queue daemon that runs every 2.5 seconds
  let isQueueProcessing = false;
  setInterval(async () => {
    if (isQueueProcessing) return;
    isQueueProcessing = true;
    try {
      await processNotificationEventsQueue(supabaseClient);
    } catch {
      // safe loop
    } finally {
      isQueueProcessing = false;
    }
  }, 2500);

  // JSON Body Parser for API requests
  app.use(express.json({ limit: "5mb" }));

  // Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Trigger Immediate Queue Drain
  app.all("/api/process-notifications", async (_req, res) => {
    try {
      const result = await processNotificationEventsQueue(supabaseClient);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Push Notification Dispatch Gateway
  app.post("/api/send-push", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
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
      } = req.body || {};

      // Initialize server Supabase client
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // Fetch subscriptions from database
      let query = supabaseClient
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth");

      if (all) {
        // Query all registered devices
      } else if (Array.isArray(recipient_user_ids) && recipient_user_ids.length > 0) {
        query = query.in("user_id", recipient_user_ids);
      } else {
        return res.json({ 
          success: true,
          delivered: 0,
          failed: 0,
          cleaned: 0,
          message: "No recipients specified." 
        });
      }

      const { data: subscriptions, error: subError } = await query;

      if (subError) {
        console.warn("Failed to fetch push subscriptions from database:", subError.message);
        return res.json({ 
          success: false,
          delivered: 0,
          failed: 0,
          cleaned: 0,
          error: `Database error: ${subError.message}. Please verify the push_subscriptions table exists in Supabase.`
        });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return res.json({
          success: true,
          delivered: 0,
          failed: 0,
          cleaned: 0,
          message: "No active push devices registered for the selected recipients."
        });
      }

      // Payload matching service worker onPush handler
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
      let cleaned = 0;

      const expiredSubscriptionIds: string[] = [];

      // Send to each subscription
      await Promise.all(
        subscriptions.map(async (sub) => {
          if (!sub.endpoint || !sub.p256dh || !sub.auth) {
            failed++;
            return;
          }

          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, pushPayload, {
              TTL: 86400, // 24 hours
              urgency: "high"
            });
            delivered++;
          } catch (err: any) {
            failed++;
            const statusCode = err?.statusCode;
            // Subscription has expired, unsubscribed, or is invalid (410 Gone / 404 Not Found)
            if (statusCode === 410 || statusCode === 404) {
              if (sub.id) {
                expiredSubscriptionIds.push(sub.id);
              }
            }
          }
        })
      );

      // Clean up expired subscriptions in background
      if (expiredSubscriptionIds.length > 0) {
        try {
          const { error: deleteErr } = await supabaseClient
            .from("push_subscriptions")
            .delete()
            .in("id", expiredSubscriptionIds);

          if (!deleteErr) {
            cleaned = expiredSubscriptionIds.length;
          }
        } catch {
          // non-blocking
        }
      }

      return res.json({
        success: true,
        delivered,
        failed,
        cleaned
      });
    } catch (err: any) {
      console.error("Error in /api/send-push:", err);
      return res.status(500).json({ 
        error: "Internal Server Error in push gateway", 
        details: err?.message || err 
      });
    }
  });

  // Save/Persist Push Subscription to Supabase using Service Role
  app.post("/api/save-subscription", async (req, res) => {
    try {
      const { user_id, endpoint, p256dh, auth, user_agent } = req.body || {};
      if (!user_id || !endpoint || !p256dh || !auth) {
        return res.status(400).json({ success: false, error: "Missing required subscription fields." });
      }

      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // Upsert into push_subscriptions table
      const { error } = await supabaseClient
        .from("push_subscriptions")
        .upsert(
          {
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent: user_agent || "",
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) {
        // Fallback: Delete any existing records for this user+endpoint and insert
        await supabaseClient.from("push_subscriptions").delete().eq("user_id", user_id).eq("endpoint", endpoint);
        const { error: insertErr } = await supabaseClient
          .from("push_subscriptions")
          .insert({
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent: user_agent || "",
            updated_at: new Date().toISOString()
          });

        if (insertErr) {
          console.warn("Save subscription insert fallback error:", insertErr.message);
          return res.status(200).json({ success: false, error: insertErr.message });
        }
      }

      return res.json({ success: true, message: "Push subscription persisted successfully." });
    } catch (err: any) {
      console.error("Save subscription exception:", err);
      return res.status(500).json({ success: false, error: err?.message || "Server error saving subscription" });
    }
  });

  // Push Status & Diagnostic Endpoint
  app.get("/api/push-status", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      let totalCount = 0;
      let userSubscriptionCount = 0;

      const { count: total, error: totalErr } = await supabaseClient
        .from("push_subscriptions")
        .select("*", { count: "exact", head: true });

      if (!totalErr && typeof total === "number") {
        totalCount = total;
      }

      if (userId) {
        const { count: userCount, error: userErr } = await supabaseClient
          .from("push_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!userErr && typeof userCount === "number") {
          userSubscriptionCount = userCount;
        }
      }

      return res.json({
        success: true,
        vapidConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
        totalRegisteredDevices: totalCount,
        userRegisteredDevices: userSubscriptionCount
      });
    } catch (err: any) {
      return res.json({
        success: false,
        error: err?.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Friend OS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
