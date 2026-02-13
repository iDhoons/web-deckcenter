import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 배치 AI 요약 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const FETCH_BIDS_SECRET = Deno.env.get("FETCH_BIDS_SECRET");

const BATCH_LIMIT = 50;
const DELAY_MS = 150;

const SYSTEM_PROMPT = `당신은 한국 공공입찰 전문 분석가입니다. 데크(목재데크, 합성목재데크, 방부목데크) 관련 입찰 공고를 분석합니다.
주어진 입찰 정보에서 핵심 내용을 추출하세요. 정보가 부족하면 null을 반환하세요.
반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

function formatPrice(price: number): string {
  if (price >= 100_000_000) return `${(price / 100_000_000).toFixed(1)}억원`;
  if (price >= 10_000) return `${Math.round(price / 10_000).toLocaleString()}만원`;
  return `${price.toLocaleString()}원`;
}

function buildPrompt(notice: Record<string, unknown>): string {
  const rawStr = notice.raw_data
    ? JSON.stringify(notice.raw_data).slice(0, 2000)
    : "";

  return `다음 입찰 공고를 분석해주세요:

제목: ${notice.title || ""}
${notice.content ? `내용: ${String(notice.content).slice(0, 1500)}` : ""}
기관: ${notice.org_name || "미상"}
지역: ${notice.region || "미상"}
추정가: ${notice.estimated_price ? formatPrice(notice.estimated_price as number) : "미상"}
입찰방식: ${notice.bid_method || "미상"}
${rawStr ? `추가정보: ${rawStr}` : ""}

다음 JSON 형식으로 응답:
{"required_materials":["자재"],"budget_range":"예산","qualifications":["자격"],"project_scale":"규모","key_summary":"요약","material_types":["분류"],"estimated_deck_area":"면적"}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 요약 미생성 입찰 조회
  const { data: unsummarized, error: queryError } = await supabase
    .from("bid_notices")
    .select("id, title, content, org_name, region, estimated_price, bid_method, raw_data")
    .not("id", "in", `(SELECT bid_notice_id FROM bid_summaries)`)
    .order("created_at", { ascending: false })
    .limit(BATCH_LIMIT);

  // 서브쿼리가 안 될 수 있으므로 대안: LEFT JOIN 방식
  let notices = unsummarized;
  if (queryError) {
    // 대안: 기존 요약 ID 목록 조회 후 필터
    const { data: existingIds } = await supabase
      .from("bid_summaries")
      .select("bid_notice_id");

    const excludeIds = (existingIds || []).map((r) => r.bid_notice_id);

    const { data: allNotices } = await supabase
      .from("bid_notices")
      .select("id, title, content, org_name, region, estimated_price, bid_method, raw_data")
      .order("created_at", { ascending: false })
      .limit(200);

    notices = (allNotices || []).filter((n) => !excludeIds.includes(n.id)).slice(0, BATCH_LIMIT);
  }

  if (!notices?.length) {
    return new Response(
      JSON.stringify({ success: true, message: "No bids to summarize", processed: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  let processed = 0;
  let errors = 0;

  for (const notice of notices) {
    try {
      const prompt = buildPrompt(notice);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        console.error(`Claude API error for ${notice.id}: ${res.status}`);
        errors++;
        continue;
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();

      let result;
      try {
        result = JSON.parse(cleaned);
      } catch {
        console.error(`JSON parse error for ${notice.id}: ${cleaned.slice(0, 200)}`);
        errors++;
        continue;
      }

      const { error: insertError } = await supabase.from("bid_summaries").insert({
        bid_notice_id: notice.id,
        required_materials: result.required_materials,
        budget_range: result.budget_range,
        qualifications: result.qualifications,
        project_scale: result.project_scale,
        key_summary: result.key_summary || `${notice.title} 관련 입찰`,
        material_types: result.material_types,
        estimated_deck_area: result.estimated_deck_area,
        raw_response: result,
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      });

      if (insertError) {
        console.error(`Insert error for ${notice.id}: ${insertError.message}`);
        errors++;
      } else {
        processed++;
      }

      await sleep(DELAY_MS);
    } catch (e) {
      console.error(`Error for ${notice.id}: ${(e as Error).message}`);
      errors++;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed,
      errors,
      total_candidates: notices.length,
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
