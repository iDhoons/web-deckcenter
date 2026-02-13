import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 입찰 알림 이메일 발송 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.deckctr.com";
const FETCH_BIDS_SECRET = Deno.env.get("FETCH_BIDS_SECRET");

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "#";
    return escapeHtml(url);
  } catch {
    return "#";
  }
}

interface BidNotice {
  id: string;
  title: string;
  org_name: string | null;
  region: string | null;
  estimated_price: number | null;
  deadline: string | null;
  detail_url: string | null;
  source: string;
  matched_keywords: string[];
}

interface Subscriber {
  id: string;
  email: string;
  keywords: string[];
  regions: string[];
  unsubscribe_token: string;
  last_notified_at: string | null;
}

function formatPrice(price: number): string {
  if (price >= 100_000_000) return `${(price / 100_000_000).toFixed(1)}억`;
  if (price >= 10_000) return `${Math.round(price / 10_000).toLocaleString()}만원`;
  return `${price.toLocaleString()}원`;
}

function getDday(deadline: string): string {
  const diff = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return "마감";
  if (diff === 0) return "D-Day";
  return `D-${diff}`;
}

function matchesBid(subscriber: Subscriber, bid: BidNotice): boolean {
  // 키워드 매칭: 구독자 키워드와 입찰 매칭 키워드 겹침 확인
  const kwMatch =
    !subscriber.keywords.length ||
    subscriber.keywords.some(
      (kw) =>
        bid.matched_keywords.includes(kw) ||
        bid.title.toLowerCase().includes(kw.toLowerCase()),
    );

  // 지역 매칭: 구독자 지역이 비어있으면 전체, 아니면 포함 확인
  const regionMatch =
    !subscriber.regions.length ||
    (bid.region &&
      subscriber.regions.some((r) => bid.region!.includes(r)));

  return kwMatch && regionMatch;
}

function buildEmailHtml(
  bids: BidNotice[],
  unsubscribeToken: string,
): string {
  const bidRows = bids
    .map(
      (bid) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
        <a href="${bid.detail_url ? sanitizeUrl(bid.detail_url) : "#"}" style="color:#0d9488;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(bid.title)}</a>
        <div style="margin-top:4px;font-size:12px;color:#888">
          ${escapeHtml(bid.org_name || "")} · ${escapeHtml(bid.region || "")} · ${bid.estimated_price ? formatPrice(bid.estimated_price) : "가격미정"}
          ${bid.deadline ? ` · ${getDday(bid.deadline)}` : ""}
        </div>
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff">
    <tr>
      <td style="padding:24px 24px 16px;background:#0d9488;color:#fff">
        <h1 style="margin:0;font-size:20px;font-weight:700">데크센터 입찰 알림</h1>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.9">${bids.length}건의 새 입찰 공고가 등록되었습니다</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${bidRows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;text-align:center">
        <a href="${SITE_URL}/bids" style="display:inline-block;padding:10px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">전체 입찰 공고 보기</a>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center">
        데크센터 | <a href="${SITE_URL}" style="color:#aaa">www.deckctr.com</a><br>
        <a href="${SITE_URL}/bids?unsubscribe=${unsubscribeToken}" style="color:#aaa">알림 구독 취소</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 인증: 시크릿 미설정 시 함수 비활성화
  if (!FETCH_BIDS_SECRET) {
    return new Response(JSON.stringify({ error: "Function not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${FETCH_BIDS_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. 활성 구독자 조회
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("id, email, keywords, regions, unsubscribe_token, last_notified_at")
    .eq("is_active", true)
    .not("email", "is", null);

  if (subError || !subscribers?.length) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "No active subscribers",
        sent: 0,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. 최근 24시간 신규 입찰 조회
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: newBids, error: bidError } = await supabase
    .from("bid_notices")
    .select(
      "id, title, org_name, region, estimated_price, deadline, detail_url, source, matched_keywords",
    )
    .gte("created_at", since)
    .eq("status", "active")
    .order("reg_date", { ascending: false });

  if (bidError || !newBids?.length) {
    return new Response(
      JSON.stringify({ success: true, message: "No new bids", sent: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. 이미 발송된 알림 조회
  const { data: sentLogs } = await supabase
    .from("notification_log")
    .select("subscriber_id, bid_notice_id")
    .gte("sent_at", since);

  const sentSet = new Set(
    (sentLogs || []).map((l) => `${l.subscriber_id}:${l.bid_notice_id}`),
  );

  let totalSent = 0;
  const errors: string[] = [];

  // 4. 구독자별 매칭 & 발송
  for (const subscriber of subscribers as Subscriber[]) {
    const matchedBids = newBids.filter(
      (bid) =>
        matchesBid(subscriber, bid) &&
        !sentSet.has(`${subscriber.id}:${bid.id}`),
    );

    if (matchedBids.length === 0) continue;

    try {
      // Resend API로 이메일 발송
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "데크센터 <noreply@deckctr.com>",
          to: subscriber.email,
          subject: `[데크센터] ${matchedBids.length}건의 새 입찰 공고`,
          html: buildEmailHtml(matchedBids, subscriber.unsubscribe_token),
        }),
      });

      if (!emailRes.ok) {
        errors.push(`Email to subscriber ${subscriber.id}: ${emailRes.status}`);
        continue;
      }

      // 발송 로그 기록
      const logEntries = matchedBids.map((bid) => ({
        subscriber_id: subscriber.id,
        bid_notice_id: bid.id,
      }));

      await supabase.from("notification_log").insert(logEntries);

      // last_notified_at 갱신
      await supabase
        .from("subscribers")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", subscriber.id);

      totalSent++;
    } catch (e) {
      errors.push(`Subscriber ${subscriber.id}: ${(e as Error).message}`);
    }
  }

  if (errors.length > 0) {
    console.error("Alert errors:", JSON.stringify(errors));
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent: totalSent,
      new_bids: newBids.length,
      subscribers: subscribers.length,
      errors: errors.length,
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
