import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 구독 취소 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const masked = local.slice(0, 2) + "***";
  return `${masked}@${domain}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Service not configured", { status: 503 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(buildHtml("잘못된 요청", "구독 취소 토큰이 없습니다."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("subscribers")
    .update({ is_active: false })
    .eq("unsubscribe_token", token)
    .select("email")
    .single();

  if (error || !data) {
    return new Response(
      buildHtml("구독 취소 실패", "유효하지 않은 링크이거나 이미 취소된 구독입니다."),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const maskedEmail = maskEmail(data.email);

  return new Response(
    buildHtml(
      "구독이 취소되었습니다",
      `${escapeHtml(maskedEmail)} 주소로의 입찰 알림이 중단되었습니다.<br>다시 구독하시려면 <a href="https://www.deckctr.com/bids">입찰정보 페이지</a>를 방문해주세요.`,
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
});

function buildHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - 데크센터</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Paperlogy', -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fafafa; color: #1a1a1a;
      padding: 1.5rem;
    }
    .card {
      max-width: 420px; width: 100%; text-align: center;
      background: #fff; border-radius: 12px; padding: 2.5rem;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; font-weight: 700; }
    p { font-size: 1rem; line-height: 1.6; color: #555; }
    a { color: #0d9488; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
