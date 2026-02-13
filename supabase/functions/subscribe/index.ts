import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 이메일 구독 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ALLOWED_ORIGIN = "https://www.deckctr.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let body: { email?: string; keywords?: string[]; regions?: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { email, keywords, regions } = body;

  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Valid email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const MAX_KEYWORDS = 20;
  const MAX_REGIONS = 10;
  const MAX_STRING_LEN = 50;

  const subscriberData: Record<string, unknown> = {
    email: email.toLowerCase().trim(),
    channel: "email",
    is_active: true,
  };

  if (keywords && keywords.length > 0) {
    subscriberData.keywords = keywords
      .slice(0, MAX_KEYWORDS)
      .map((k) => String(k).slice(0, MAX_STRING_LEN).trim())
      .filter((k) => k.length > 0);
  }
  if (regions && regions.length > 0) {
    subscriberData.regions = regions
      .slice(0, MAX_REGIONS)
      .map((r) => String(r).slice(0, MAX_STRING_LEN).trim())
      .filter((r) => r.length > 0);
  }

  // UPSERT: 이미 등록된 이메일이면 keywords/regions 업데이트
  const { error } = await supabase
    .from("subscribers")
    .upsert(subscriberData, { onConflict: "email" });

  if (error) {
    console.error("Subscribe error:", error.message);
    return new Response(JSON.stringify({ error: "Subscription failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
