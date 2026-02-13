import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// AI 입찰 요약 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const FETCH_BIDS_SECRET = Deno.env.get("FETCH_BIDS_SECRET");

const SYSTEM_PROMPT = `당신은 한국 공공입찰 전문 분석가입니다. 데크(목재데크, 합성목재데크, 방부목데크) 관련 입찰 공고를 분석합니다.
주어진 입찰 정보에서 핵심 내용을 추출하세요. 정보가 부족하면 null을 반환하세요.
반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

interface BidSummary {
  required_materials: string[] | null;
  budget_range: string | null;
  qualifications: string[] | null;
  project_scale: string | null;
  key_summary: string;
  material_types: string[] | null;
  estimated_deck_area: string | null;
}

function formatPrice(price: number): string {
  if (price >= 100_000_000) return `${(price / 100_000_000).toFixed(1)}억원`;
  if (price >= 10_000) return `${Math.round(price / 10_000).toLocaleString()}만원`;
  return `${price.toLocaleString()}원`;
}

function buildUserPrompt(notice: Record<string, unknown>): string {
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

다음 JSON 형식으로 응답하세요:
{
  "required_materials": ["필요한 자재명"] 또는 null,
  "budget_range": "예산범위 문자열" 또는 null,
  "qualifications": ["자격요건"] 또는 null,
  "project_scale": "공사규모 설명" 또는 null,
  "key_summary": "2-3문장 핵심 요약 (필수)",
  "material_types": ["데크 자재 분류: 합성목, 방부목, 알루미늄 등"] 또는 null,
  "estimated_deck_area": "추정 데크 면적" 또는 null
}`;
}

async function callClaude(
  prompt: string,
): Promise<{ result: BidSummary; inputTokens: number; outputTokens: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
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
    const errText = await res.text();
    console.error(`Claude API error: ${res.status} ${errText}`);
    throw new Error(`AI summarization failed (${res.status})`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  // JSON 파싱 (코드블록 제거)
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const result = JSON.parse(cleaned) as BidSummary;

  return { result, inputTokens, outputTokens };
}

export async function summarizeBid(
  supabase: ReturnType<typeof createClient>,
  bidNoticeId: string,
): Promise<{ success: boolean; cached?: boolean; error?: string }> {
  // 이미 요약 있으면 skip
  const { data: existing } = await supabase
    .from("bid_summaries")
    .select("id")
    .eq("bid_notice_id", bidNoticeId)
    .single();

  if (existing) return { success: true, cached: true };

  // 입찰 공고 조회
  const { data: notice, error: noticeError } = await supabase
    .from("bid_notices")
    .select("*")
    .eq("id", bidNoticeId)
    .single();

  if (noticeError || !notice) {
    return { success: false, error: `Notice not found: ${bidNoticeId}` };
  }

  const prompt = buildUserPrompt(notice);

  try {
    const { result, inputTokens, outputTokens } = await callClaude(prompt);

    const { error: insertError } = await supabase
      .from("bid_summaries")
      .insert({
        bid_notice_id: bidNoticeId,
        required_materials: result.required_materials,
        budget_range: result.budget_range,
        qualifications: result.qualifications,
        project_scale: result.project_scale,
        key_summary: result.key_summary,
        material_types: result.material_types,
        estimated_deck_area: result.estimated_deck_area,
        raw_response: result,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });

    if (insertError) {
      return { success: false, error: `Insert error: ${insertError.message}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
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

  let body: { bid_notice_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!body.bid_notice_id || !UUID_RE.test(body.bid_notice_id)) {
    return new Response(
      JSON.stringify({ error: "Valid bid_notice_id (UUID) is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const result = await summarizeBid(supabase, body.bid_notice_id);

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
