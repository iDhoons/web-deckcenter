// sources/d2b.ts — D2B 국방전자조달 입찰 + 결과 수집

import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords, SEARCH_KEYWORDS } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid, NormalizedResult } from '../types.ts';

const D2B_BID_BASE = "http://openapi.d2b.go.kr/openapi/service/BidPblancInfoService/getDmstcCmpetBidPblancList";
const D2B_RESULT_BASE = "http://openapi.d2b.go.kr/openapi/service/BidResultInfoService/getDmstcCmpetBidResultList";

interface D2bBidItem {
  pblancNo?: string;
  bidNm?: string;
  ornt?: string;
  orntCode?: string;
  cntrctMth?: string;
  bidStle?: string;
  busiDivs?: string;
  pblancDate?: string;
  bidPartcptRegistClosDt?: string;
  biddocPresentnClosDt?: string;
  opengDt?: string;
  demandYear?: string;
}

interface D2bResultItem {
  pblancNo?: string;
  bsnsNm?: string;
  ornt?: string;
  opengDate?: string;
  groupNo?: string;
  purchsRequstNo?: string;
}

export async function fetchD2bBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  for (const keyword of SEARCH_KEYWORDS.slice(0, 6)) {
    try {
      const url = new URL(D2B_BID_BASE);
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("numOfRows", "50");
      url.searchParams.set("pageNo", "1");
      url.searchParams.set("type", "json");
      url.searchParams.set("anmtDateBegin", fmt(from));
      url.searchParams.set("anmtDateEnd", fmt(now));
      url.searchParams.set("bidNm", keyword);

      console.log(`[D2B] Fetching keyword: ${keyword}`);
      const res = await fetchWithTimeout(url.toString());
      if (!res.ok) {
        console.error(`[D2B] HTTP ${res.status} for '${keyword}'`);
        continue;
      }

      const data = await res.json();
      const items = data?.response?.body?.items?.item
        || data?.response?.body?.items
        || data?.Items?.Item;
      if (!items) continue;

      const itemList = Array.isArray(items) ? items : [items];
      console.log(`[D2B] Found ${itemList.length} items for '${keyword}'`);

      for (const item of itemList as D2bBidItem[]) {
        if (!item.pblancNo || !item.bidNm) continue;

        const matched = matchKeywords(item.bidNm);
        if (matched.length === 0) continue;

        const parseD2bDate = (d?: string) => {
          if (!d || d.length < 8) return null;
          const y = d.slice(0,4), m = d.slice(4,6), day = d.slice(6,8);
          const h = d.length >= 10 ? d.slice(8,10) : '00';
          const min = d.length >= 12 ? d.slice(10,12) : '00';
          return toTimestamp(`${y}-${m}-${day}T${h}:${min}:00`);
        };

        bids.push({
          source: 'd2b',
          bid_num: item.pblancNo,
          title: item.bidNm,
          org_name: item.ornt || null,
          org_code: item.orntCode || null,
          bid_method: item.cntrctMth || null,
          bid_type: item.busiDivs || null,
          reg_date: parseD2bDate(item.pblancDate),
          deadline: parseD2bDate(item.biddocPresentnClosDt),
          open_date: parseD2bDate(item.opengDt),
          detail_url: `https://www.d2b.go.kr/internet/pblancDetail.do?pblancNo=${item.pblancNo}`,
          matched_keywords: matched,
          status: 'active',
          raw_data: item,
        });
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`D2B fetch error for '${keyword}': ${errMsg}`);
    }
  }

  return { bids, results: [] };
}

export async function fetchD2bResults(apiKey: string): Promise<FetchResult> {
  const results: NormalizedResult[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  try {
    const url = new URL(D2B_RESULT_BASE);
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("type", "json");
    url.searchParams.set("opengDateBegin", fmt(from));
    url.searchParams.set("opengDateEnd", fmt(now));

    console.log(`[D2B-결과] Fetching results`);
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      console.error(`[D2B-결과] HTTP ${res.status}`);
      return { bids: [], results };
    }

    const data = await res.json();
    const items = data?.response?.body?.items?.item
      || data?.response?.body?.items
      || data?.Items?.Item;
    if (!items) return { bids: [], results };

    const itemList = Array.isArray(items) ? items : [items];
    console.log(`[D2B-결과] Found ${itemList.length} results`);

    for (const item of itemList as D2bResultItem[]) {
      if (!item.pblancNo) continue;
      if (seen.has(item.pblancNo)) continue;

      const title = item.bsnsNm || '';
      const matched = matchKeywords(title);
      if (matched.length === 0) continue;

      seen.add(item.pblancNo);
      results.push({
        source: 'd2b',
        bid_num: item.pblancNo,
        company_name: item.ornt || '미상',
        award_date: toTimestamp(
          item.opengDate ? `${item.opengDate.slice(0,4)}-${item.opengDate.slice(4,6)}-${item.opengDate.slice(6,8)}` : ''
        ),
        raw_data: item,
      });
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`D2B results fetch error: ${errMsg}`);
  }

  return { bids: [], results };
}
