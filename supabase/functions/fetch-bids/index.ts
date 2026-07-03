import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PerfTracker } from './perf-tracker.ts';
import { fetchKaptBids } from './sources/kapt.ts';
import { fetchG2bBids, fetchG2bResults } from './sources/g2b.ts';
import { fetchD2bBids, fetchD2bResults } from './sources/d2b.ts';
import { fetchLofinContracts } from './sources/lofin.ts';
import { fetchKwaterBids } from './sources/kwater.ts';
import { fetchLhBids } from './sources/lh.ts';
import {
  upsertBids, upsertResults, linkResultsToNotices,
  updateDeadlineStatus, cleanupStaleData,
} from './shared/db.ts';
import { filterValidBids } from './shared/validator.ts';
import type { NormalizedBid, NormalizedResult, FetchResult } from './types.ts';

// ============================================
// 데크 입찰정보 수집 Edge Function (오케스트레이터)
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DATA_GO_KR_API_KEY = Deno.env.get("DATA_GO_KR_API_KEY");
const FETCH_BIDS_SECRET = Deno.env.get("FETCH_BIDS_SECRET");
const LOFIN365_API_KEY = Deno.env.get("LOFIN365_API_KEY");

Deno.serve(async (req: Request) => {
  const ALLOWED_ORIGIN = 'https://www.deckctr.com';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST만 허용 (H-002)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
    });
  }

  // 필수 환경변수 체크 (M-003)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 인증 체크 - 시크릿 미설정이면 함수 비활성화 (C-001)
  if (!FETCH_BIDS_SECRET) {
    return new Response(JSON.stringify({ error: 'Function not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${FETCH_BIDS_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // API Key 체크 (H-004: 환경변수명 노출 방지)
  if (!DATA_GO_KR_API_KEY) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tracker = new PerfTracker();

  const allBids: NormalizedBid[] = [];
  const allResults: NormalizedResult[] = [];
  const errors: string[] = [];
  let totalInvalid = 0;

  // 소스별 수집 정의
  const sources = [
    { name: 'kapt', fn: () => fetchKaptBids(DATA_GO_KR_API_KEY) },
    { name: 'g2b_bids', fn: () => fetchG2bBids(DATA_GO_KR_API_KEY) },
    { name: 'd2b_bids', fn: () => fetchD2bBids(DATA_GO_KR_API_KEY) },
    { name: 'g2b_results', fn: () => fetchG2bResults(DATA_GO_KR_API_KEY) },
    { name: 'lofin', fn: () => LOFIN365_API_KEY
      ? fetchLofinContracts(LOFIN365_API_KEY, supabase)
      : (console.log('[LOFIN] API key not set, skipping'), Promise.resolve({ bids: [] as NormalizedBid[], results: [] as NormalizedResult[] }))
    },
    { name: 'd2b_results', fn: () => fetchD2bResults(DATA_GO_KR_API_KEY) },
    { name: 'kwater', fn: () => fetchKwaterBids(DATA_GO_KR_API_KEY) },
    { name: 'lh', fn: () => fetchLhBids(DATA_GO_KR_API_KEY) },
  ];

  // 3개씩 병렬 수집 (세마포어)
  const PARALLEL_LIMIT = 3;
  for (let i = 0; i < sources.length; i += PARALLEL_LIMIT) {
    const batch = sources.slice(i, i + PARALLEL_LIMIT);

    const tasks = batch.map(source => async (): Promise<FetchResult & { name: string }> => {
      tracker.start(source.name);
      try {
        const result = await source.fn();
        // 데이터 검증 관문
        const { valid: validBids, invalidCount } = filterValidBids(result.bids);
        totalInvalid += invalidCount;
        tracker.end(source.name, validBids.length + result.results.length);
        return { name: source.name, bids: validBids, results: result.results };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        tracker.error(source.name, msg);
        errors.push(`${source.name}: ${msg}`);
        return { name: source.name, bids: [], results: [] };
      }
    });

    const batchResults = await Promise.allSettled(tasks.map(fn => fn()));

    for (const settled of batchResults) {
      if (settled.status === 'fulfilled') {
        allBids.push(...settled.value.bids);
        allResults.push(...settled.value.results);
      }
    }
  }

  // DB 저장
  const bidUpsert = await upsertBids(supabase, allBids);
  if (bidUpsert.error) errors.push(`bids upsert: ${bidUpsert.error}`);

  if (allResults.length > 0) {
    await linkResultsToNotices(supabase, allResults);
    const resultUpsert = await upsertResults(supabase, allResults);
    if (resultUpsert.error) errors.push(`results upsert: ${resultUpsert.error}`);
  }

  // 마감/stale 정리
  tracker.start('maintenance');
  const deadlineErr = await updateDeadlineStatus(supabase);
  if (deadlineErr) errors.push(`deadline update: ${deadlineErr}`);
  const staleErr = await cleanupStaleData(supabase);
  if (staleErr) errors.push(`stale cleanup: ${staleErr}`);
  tracker.end('maintenance');

  // 내부 에러 로그 (서버 콘솔에만)
  if (errors.length > 0) {
    console.error('Processing errors:', JSON.stringify(errors));
  }

  // 후속 작업 체이닝 (비동기 — 응답 대기하지 않음)
  if (FETCH_BIDS_SECRET && SUPABASE_URL) {
    fetch(`${SUPABASE_URL}/functions/v1/send-bid-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FETCH_BIDS_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch(e => console.error('Alert chain error:', e.message));

    fetch(`${SUPABASE_URL}/functions/v1/batch-summarize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FETCH_BIDS_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch(e => console.error('Summarize chain error:', e.message));
  }

  // 소스별 건수 집계
  const countBySource = (arr: NormalizedBid[], src: string) => arr.filter(b => b.source === src).length;
  const countResultsBySource = (arr: NormalizedResult[], src: string) => arr.filter(r => r.source === src).length;

  return new Response(JSON.stringify({
    success: errors.length === 0,
    fetched: {
      kapt_bids: countBySource(allBids, 'kapt'),
      g2b_bids: countBySource(allBids, 'g2b'),
      d2b_bids: countBySource(allBids, 'd2b'),
      lofin_contracts: countBySource(allBids, 'lofin'),
      kwater_bids: countBySource(allBids, 'kwater'),
      lh_bids: countBySource(allBids, 'lh'),
      g2b_results: countResultsBySource(allResults, 'g2b'),
      d2b_results: countResultsBySource(allResults, 'd2b'),
      lofin_results: countResultsBySource(allResults, 'lofin'),
    },
    diagnostics: {
      ...tracker.report(),
      parallel: { batchSize: PARALLEL_LIMIT, totalBatches: Math.ceil(sources.length / PARALLEL_LIMIT) },
      validation: { invalidBidsFiltered: totalInvalid },
    },
    errors: errors.length > 0
      ? [`${errors.length} error(s) occurred during processing`]
      : [],
    timestamp: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
});
