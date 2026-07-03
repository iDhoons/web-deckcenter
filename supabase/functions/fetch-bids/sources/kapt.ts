// sources/kapt.ts — K-APT 입찰 수집

import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords, SEARCH_KEYWORDS } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid } from '../types.ts';

const KAPT_API_BASE = "https://apis.data.go.kr/1613000/ApHusBidPblAncInfoOfferServiceV2/getBidPblAncNmSearchV2";

interface KaptBidItem {
  bidTitle?: string;
  bidContent?: string;
  bidKaptname?: string;
  bidKaptcode?: string;
  bidArea?: string;
  bidNum?: string;
  bidDeadline?: string;
  bidRegDate?: string;
  bidState?: string;
  bidFileSeq?: string;
  codeAuth?: string;
  codeWay?: string;
  codeSucWay?: string;
  codeClassifyType1?: string;
}

export async function fetchKaptBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];
  const year = new Date().getFullYear().toString();

  for (const keyword of SEARCH_KEYWORDS.slice(0, 6)) {
    try {
      const url = new URL(KAPT_API_BASE);
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("bidTitle", keyword);
      url.searchParams.set("searchYear", year);
      url.searchParams.set("pageNo", "1");
      url.searchParams.set("numOfRows", "50");
      url.searchParams.set("type", "json");

      console.log(`[K-APT] Fetching keyword: ${keyword}, year: ${year}`);
      const res = await fetchWithTimeout(url.toString());
      console.log(`[K-APT] Response status: ${res.status}`);
      if (!res.ok) {
        console.error(`[K-APT] HTTP ${res.status} for keyword '${keyword}'`);
        continue;
      }

      const data = await res.json();
      const resultCode = data?.response?.header?.resultCode;
      const totalCount = data?.response?.body?.totalCount;
      console.log(`[K-APT] resultCode: ${resultCode}, totalCount: ${totalCount}`);

      const items = data?.response?.body?.items;
      if (!items || (Array.isArray(items) && items.length === 0)) {
        console.log(`[K-APT] No items for keyword '${keyword}'`);
        continue;
      }

      const itemList = Array.isArray(items) ? items : [items];
      console.log(`[K-APT] Found ${itemList.length} items for '${keyword}'`);

      for (const item of itemList as KaptBidItem[]) {
        if (!item.bidNum || !item.bidTitle) continue;

        const titleContent = `${item.bidTitle || ''} ${item.bidContent || ''}`;
        const matched = matchKeywords(titleContent);
        if (matched.length === 0) continue;

        bids.push({
          source: 'kapt',
          bid_num: item.bidNum,
          title: item.bidTitle,
          content: item.bidContent || null,
          org_name: item.bidKaptname || null,
          org_code: (item as any).aptCode || null,
          region: item.bidArea || null,
          bid_method: item.codeAuth || null,
          award_method: item.codeSucWay || null,
          bid_type: item.codeClassifyType1 || null,
          reg_date: toTimestamp(item.bidRegDate),
          deadline: toTimestamp(item.bidDeadline),
          file_url: item.bidFileSeq ? `https://www.k-apt.go.kr/bid/bidFileDown.do?bidFileSeq=${item.bidFileSeq}` : null,
          detail_url: `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=${item.bidNum}`,
          matched_keywords: matched,
          status: item.bidState === '마감' ? 'closed' : 'active',
          raw_data: item,
        });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`K-APT fetch error for keyword '${keyword}': ${errMsg}`);
    }
  }

  return { bids, results: [] };
}
