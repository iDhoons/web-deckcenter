// sources/kwater.ts — K-water 전자조달 입찰공고 수집 (공사)

import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid } from '../types.ts';

const KWATER_BID_CNSTWK = "https://apis.data.go.kr/B500001/ebid/tndr3/cntrwkList";

export async function fetchKwaterBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  for (const searchDt of months) {
    let pageNo = 1;
    const maxPages = 5;

    while (pageNo <= maxPages) {
      try {
        const url = new URL(KWATER_BID_CNSTWK);
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("pageNo", String(pageNo));
        url.searchParams.set("numOfRows", "100");
        url.searchParams.set("searchDt", searchDt);
        url.searchParams.set("_type", "json");

        console.log(`[K-water] Fetching ${searchDt} page ${pageNo}`);
        const res = await fetchWithTimeout(url.toString());
        if (!res.ok) {
          console.error(`[K-water] HTTP ${res.status} for ${searchDt} page ${pageNo}`);
          break;
        }

        const data = await res.json();
        const totalCount = data?.response?.body?.totalCount || 0;
        const rawItems = data?.response?.body?.items?.item;
        if (!rawItems) break;

        const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];
        console.log(`[K-water] ${searchDt} page ${pageNo}: ${itemList.length}/${totalCount} items`);

        for (const item of itemList) {
          const title = item.tndrPblancNm || '';
          const bidNum = item.tndrPbanno || '';
          if (!bidNum || !title) continue;
          if (seen.has(bidNum)) continue;

          const matched = matchKeywords(title);
          if (matched.length === 0) continue;

          seen.add(bidNum);
          bids.push({
            source: 'kwater',
            bid_num: bidNum,
            title: title,
            org_name: item.cntrctDeptNm || '한국수자원공사',
            estimated_price: safeParseInt(item.tndrPlnprc),
            bid_method: item.ctrmthdCdNm || null,
            bid_type: '공사',
            reg_date: toTimestamp(String(item.tndrPblancDe)),
            deadline: toTimestamp(String(item.tndrPblancEnddt)),
            open_date: null,
            detail_url: 'https://ebid.kwater.or.kr/',
            matched_keywords: matched,
            status: item.tndrStat === '마감' ? 'closed' : 'active',
            raw_data: item,
          });
        }

        if (pageNo * 100 >= totalCount) break;
        pageNo++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`K-water fetch error ${searchDt} page ${pageNo}: ${errMsg}`);
        break;
      }
    }
  }

  return { bids, results: [] };
}
