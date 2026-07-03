// sources/lofin.ts — 지방재정365 계약현황 수집 (pg_net 2-phase)

import { simpleHash, safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords, SEARCH_KEYWORDS } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid, NormalizedResult } from '../types.ts';

const LOFIN_API_BASE = "https://www.lofin365.go.kr/lf/hub/WCEGCF";

interface LofinContractItem {
  laf_cd?: string;
  ctrt_ldgr_mng_no?: string;
  data_crt_ymd?: string;
  laf_hg_nm?: string;
  wa_laf_hg_nm?: string;
  ctrt_mth_nm?: string;
  ctrt_knd_nm?: string;
  ctrt_trgt_nm?: string;
  smz_ctrt_ymd?: string;
  ctrt_tot_tott_amt?: string;
  clt_nm?: string;
  sbc_yn?: string;
}

// LOFIN은 pg_net RPC를 사용하므로 supabase 인스턴스가 필요
export async function fetchLofinContracts(apiKey: string, supabase: any): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];
  const results: NormalizedResult[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  // Phase 1: 모든 URL 생성 및 pg_net으로 배치 전송
  const urls: string[] = [];
  const meta: { keyword: string; dateStr: string }[] = [];

  for (const keyword of SEARCH_KEYWORDS.slice(0, 6)) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = fmt(targetDate);
      const encodedKeyword = encodeURIComponent(keyword);
      const url = `${LOFIN_API_BASE}?Key=${apiKey}&Type=json&pIndex=1&pSize=100&smz_ctrt_ymd=${dateStr}&ctrt_trgt_nm=${encodedKeyword}`;
      urls.push(url);
      meta.push({ keyword, dateStr });
    }
  }

  console.log(`[LOFIN] Sending ${urls.length} requests via pg_net...`);

  const { data: reqIds, error: sendErr } = await supabase.rpc('lofin_http_get_batch', { urls });
  if (sendErr) {
    console.error(`[LOFIN] Batch send error: ${sendErr.message}`);
    return { bids, results };
  }

  console.log(`[LOFIN] Sent ${reqIds.length} requests, waiting 8s for responses...`);

  // Phase 2: pg_net 응답 대기
  await new Promise(r => setTimeout(r, 8000));

  // Phase 3: 응답 배치 조회
  const { data: responses, error: getErr } = await supabase.rpc('lofin_get_responses', { req_ids: reqIds });
  if (getErr) {
    console.error(`[LOFIN] Batch get error: ${getErr.message}`);
    return { bids, results };
  }

  let okCount = 0, errCount = 0, pendingCount = 0;

  for (const resp of responses as any[]) {
    const { keyword: _keyword, dateStr } = meta[resp.idx];

    if (resp.status === 'pending') {
      pendingCount++;
      continue;
    }
    if (resp.status !== 'ok') {
      errCount++;
      continue;
    }

    okCount++;
    const data = resp.data;
    if (!data?.WCEGCF) continue;

    let items: LofinContractItem[] = [];
    for (const section of data.WCEGCF) {
      if (section.row) {
        items = section.row;
        break;
      }
    }

    if (items.length === 0) continue;

    for (const item of items) {
      const contractName = item.ctrt_trgt_nm || '';
      const matched = matchKeywords(contractName);
      if (matched.length === 0) continue;

      const contractId = item.ctrt_ldgr_mng_no
        || `lofin-${item.laf_cd || ''}-${item.smz_ctrt_ymd || dateStr}-${simpleHash(contractName)}`;

      if (seen.has(contractId)) continue;
      seen.add(contractId);

      const price = safeParseInt(item.ctrt_tot_tott_amt);

      const ctrtDate = item.smz_ctrt_ymd || dateStr;
      const isoDate = ctrtDate.length === 8
        ? toTimestamp(`${ctrtDate.slice(0,4)}-${ctrtDate.slice(4,6)}-${ctrtDate.slice(6,8)}`)
        : toTimestamp(ctrtDate);

      const region = [item.wa_laf_hg_nm, item.laf_hg_nm].filter(Boolean).join(' ');

      const lofinDetailUrl = null;

      bids.push({
        source: 'lofin',
        bid_num: contractId,
        title: contractName,
        org_name: item.laf_hg_nm || null,
        region: region || null,
        estimated_price: price,
        bid_method: item.ctrt_mth_nm || null,
        bid_type: item.ctrt_knd_nm || null,
        reg_date: isoDate,
        detail_url: lofinDetailUrl,
        matched_keywords: matched,
        status: 'closed',
        raw_data: item,
      });

      if (item.clt_nm) {
        results.push({
          source: 'lofin',
          bid_num: contractId,
          company_name: item.clt_nm,
          award_price: price,
          award_date: isoDate,
          raw_data: item,
        });
      }
    }
  }

  console.log(`[LOFIN] Results: ${okCount} ok, ${errCount} errors, ${pendingCount} pending → ${bids.length} bids, ${results.length} results`);
  return { bids, results };
}
