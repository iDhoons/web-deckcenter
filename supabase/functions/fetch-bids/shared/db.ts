// shared/db.ts — DB 작업 (upsert, 연결, 정리)

import type { NormalizedBid, NormalizedResult } from '../types.ts';

export async function upsertBids(
  supabase: any,
  bids: NormalizedBid[]
): Promise<{ count: number; error?: string }> {
  if (bids.length === 0) return { count: 0 };
  const { error } = await supabase
    .from('bid_notices')
    .upsert(bids, { onConflict: 'source,bid_num', ignoreDuplicates: false });
  return { count: bids.length, error: error?.message };
}

export async function upsertResults(
  supabase: any,
  results: NormalizedResult[]
): Promise<{ count: number; error?: string }> {
  if (results.length === 0) return { count: 0 };
  const { error } = await supabase
    .from('bid_results')
    .upsert(results, { onConflict: 'source,bid_num', ignoreDuplicates: false });
  return { count: results.length, error: error?.message };
}

// 낙찰 결과 → bid_notices 배치 연결 (N+1 제거)
export async function linkResultsToNotices(
  supabase: any,
  results: NormalizedResult[]
): Promise<void> {
  if (results.length === 0) return;

  // source별로 그룹핑
  const bySource = new Map<string, string[]>();
  for (const r of results) {
    if (!r.source || !r.bid_num) continue;
    const nums = bySource.get(r.source) || [];
    nums.push(r.bid_num);
    bySource.set(r.source, nums);
  }

  // source별 배치 조회
  const idMap = new Map<string, string>(); // "source:bid_num" → id
  for (const [source, bidNums] of bySource) {
    const { data: notices } = await supabase
      .from('bid_notices')
      .select('id, source, bid_num')
      .eq('source', source)
      .in('bid_num', bidNums);
    if (notices) {
      for (const n of notices) {
        idMap.set(`${n.source}:${n.bid_num}`, n.id);
      }
    }
  }

  // 결과에 bid_notice_id 매핑
  for (const r of results) {
    const id = idMap.get(`${r.source}:${r.bid_num}`);
    if (id) r.bid_notice_id = id;
  }
}

export async function updateDeadlineStatus(supabase: any): Promise<string | undefined> {
  const { error } = await supabase
    .from('bid_notices')
    .update({ status: 'closed' })
    .lt('deadline', new Date().toISOString())
    .eq('status', 'active');
  return error?.message;
}

export async function cleanupStaleData(supabase: any): Promise<string | undefined> {
  const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('bid_notices')
    .update({ status: 'closed' })
    .eq('status', 'active')
    .is('deadline', null)
    .lt('reg_date', staleDate);
  return error?.message;
}
