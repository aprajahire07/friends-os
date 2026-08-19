// ==============================================================================
// FRIEND OS — Supabase Edge Function: send-push
// Real-time mobile & desktop Web Push Notification delivery using VAPID & RFC 8292
// ==============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER_ADMIN_EMAIL = "aprajahire07@gmail.com";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // VAPID Credentials from Supabase Edge Secrets
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "BIuU2K8p706ypy_bWNBdoaOlrNNle1SCmF6hl1sA_ulg9N4VnhqaNVGtwKGQXZI9lLZIwlPVI0JUS5BmGBLu_Kk";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "W2-FTYlc10eiMCMXzfAc428BZu-LbFqoQOBZpGKoy9Q";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:aprajahire07@gmail.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID credentials not configured in Edge Function secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configure Web Push with VAPID
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 1. Authenticate Request via caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client for verifying user identity
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuthClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service role to securely query push_subscriptions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse request payload
    const body = await req.json();
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
    } = body;

    // 3. Security validation
    // If sending to 'all' (Broadcast), check if caller is an Admin
    if (all) {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();

      const isAdmin =
        callerProfile?.role === "admin" ||
        callerProfile?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ||
        user.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Only Friend OS Administrators can broadcast push notifications to all users." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Fetch target push subscriptions from database
    let query = supabaseAdmin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");

    if (all) {
      // Broadcast to everyone
    } else if (Array.isArray(recipient_user_ids) && recipient_user_ids.length > 0) {
      query = query.in("user_id", recipient_user_ids);
    } else {
      return new Response(
        JSON.stringify({ error: "No recipient user IDs provided and 'all' is false." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch push subscriptions", details: subError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          delivered: 0,
          failed: 0,
          cleaned: 0,
          message: "No registered push subscription devices found for the target recipients."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Construct Web Push payload
    const pushPayload = JSON.stringify({
      title,
      body: messageBody,
      section,
      icon,
      badge,
      image,
      tag: tag || `friend-os-${section}-${Date.now()}`,
      url: `/?tab=${section}`,
      data: {
        ...data,
        section,
        sentBy: user.id,
        sentAt: new Date().toISOString()
      },
      timestamp: Date.now()
    });

    let deliveredCount = 0;
    let failedCount = 0;
    let cleanedCount = 0;
    const expiredEndpoints: string[] = [];

    // 6. Deliver push notifications in parallel
    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        deliveredCount++;
      } catch (err: any) {
        failedCount++;
        // 404 (Not Found) or 410 (Gone) indicates the subscription is permanently expired/invalid
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn(`Push delivery error to endpoint ${sub.endpoint}:`, err.message);
        }
      }
    });

    await Promise.allSettled(pushPromises);

    // 7. Cleanup stale/expired subscriptions automatically
    if (expiredEndpoints.length > 0) {
      const { error: cleanError } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);

      if (!cleanError) {
        cleanedCount = expiredEndpoints.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        failed: failedCount,
        cleaned: cleanedCount,
        total: subscriptions.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-push Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
