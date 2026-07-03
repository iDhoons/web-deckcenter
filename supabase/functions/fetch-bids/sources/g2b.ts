// sources/g2b.ts — 나라장터 입찰 + 낙찰결과 수집

import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords, SEARCH_KEYWORDS } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid, NormalizedResult } from '../types.ts';

// 나라장터 입찰공고 API (공사 + 용역) - 신규 엔드포인트 2026
const G2B_BID_CNSTWK = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk";
const G2B_BID_SERVC = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc";

// 나라장터 낙찰정보 API - 신규 엔드포인트 2026
const G2B_RESULT_CNSTWK = "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusCnstwk";
const G2B_RESULT_SERVC = "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusServc";

interface G2bBidItem {
  bidNtceNm?: string;
  bidNtceNo?: string;
  bidNtceDt?: string;
  bidClseDt?: string;
  opengDt?: string;
  ntceInsttNm?: string;
  ntceInsttCd?: string;
  dminsttNm?: string;
  presmptPrce?: string;
  bidMethdNm?: string;
  sucsfbidMthdNm?: string;
  rgstDt?: string;
  bidNtceDtlUrl?: string;
}

interface G2bResultItem {
  bidNtceNo?: string;
  bidNtceNm?: string;
  bidwinnrNm?: string;
  bidwinnrBizno?: string;
  sucsfbidAmt?: string;
  sucsfbidRate?: string;
  rlOpengDt?: string;
  fnlSucsfDate?: string;
  dminsttNm?: string;
}

export async function fetchG2bBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}0000`;
  };

  const endpoints = [
    { url: G2B_BID_CNSTWK, type: '공사' },
    { url: G2B_BID_SERVC, type: '용역' },
  ];

  for (const endpoint of endpoints) {
    for (const keyword of SEARCH_KEYWORDS.slice(0, 6)) {
      try {
        const url = new URL(endpoint.url);
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("numOfRows", "50");
        url.searchParams.set("pageNo", "1");
        url.searchParams.set("type", "json");
        url.searchParams.set("inqryDiv", "1");
        url.searchParams.set("inqryBgnDt", formatDate(from));
        url.searchParams.set("inqryEndDt", formatDate(now));
        url.searchParams.set("bidNtceNm", keyword);

        console.log(`[G2B-${endpoint.type}] Fetching keyword: ${keyword}`);
        const res = await fetchWithTimeout(url.toString());
        if (!res.ok) {
          console.error(`[G2B-${endpoint.type}] HTTP ${res.status} for '${keyword}'`);
          continue;
        }

        const data = await res.json();
        const items = data?.response?.body?.items;
        if (!items) continue;

        const itemList = Array.isArray(items) ? items : [items];
        console.log(`[G2B-${endpoint.type}] Found ${itemList.length} items for '${keyword}'`);

        for (const item of itemList as G2bBidItem[]) {
          if (!item.bidNtceNo || !item.bidNtceNm) continue;

          const matched = matchKeywords(item.bidNtceNm);
          if (matched.length === 0) continue;

          bids.push({
            source: 'g2b',
            bid_num: item.bidNtceNo,
            title: item.bidNtceNm,
            org_name: item.ntceInsttNm || item.dminsttNm || null,
            org_code: item.ntceInsttCd || null,
            estimated_price: safeParseInt(item.presmptPrce),
            bid_method: item.bidMethdNm || null,
            award_method: item.sucsfbidMthdNm || null,
            bid_type: endpoint.type,
            reg_date: toTimestamp(item.rgstDt),
            deadline: toTimestamp(item.bidClseDt),
            open_date: toTimestamp(item.opengDt),
            detail_url: item.bidNtceDtlUrl || `https://www.g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do?bidno=${item.bidNtceNo}`,
            matched_keywords: matched,
            status: 'active',
            raw_data: item,
          });
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`G2B fetch error [${endpoint.type}] '${keyword}': ${errMsg}`);
      }
    }
  }

  return { bids, results: [] };
}

export async function fetchG2bResults(apiKey: string): Promise<FetchResult> {
  const results: NormalizedResult[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}0000`;
  };

  const endpoints = [
    { url: G2B_RESULT_CNSTWK, type: '공사' },
    { url: G2B_RESULT_SERVC, type: '용역' },
  ];

  for (const endpoint of endpoints) {
    let pageNo = 1;
    const maxPages = 7;

    while (pageNo <= maxPages) {
      try {
        const url = new URL(endpoint.url);
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("numOfRows", "999");
        url.searchParams.set("pageNo", String(pageNo));
        url.searchParams.set("type", "json");
        url.searchParams.set("inqryDiv", "1");
        url.searchParams.set("inqryBgnDt", formatDate(from));
        url.searchParams.set("inqryEndDt", formatDate(now));

        console.log(`[G2B-결과-${endpoint.type}] page ${pageNo}`);
        const res = await fetchWithTimeout(url.toString());
        if (!res.ok) {
          console.error(`[G2B-결과-${endpoint.type}] HTTP ${res.status} page ${pageNo}`);
          break;
        }

        const data = await res.json();
        const totalCount = data?.response?.body?.totalCount || 0;
        const items = data?.response?.body?.items;
        if (!items) break;

        const itemList = Array.isArray(items) ? items : [items];
        console.log(`[G2B-결과-${endpoint.type}] page ${pageNo}: ${itemList.length}/${totalCount} items`);

        for (const item of itemList as G2bResultItem[]) {
          if (!item.bidNtceNo || !item.bidwinnrNm) continue;
          if (seen.has(item.bidNtceNo)) continue;

          const title = item.bidNtceNm || '';
          const matched = matchKeywords(title);
          if (matched.length === 0) continue;

          seen.add(item.bidNtceNo);
          results.push({
            source: 'g2b',
            bid_num: item.bidNtceNo,
            company_name: item.bidwinnrNm,
            company_bizno: item.bidwinnrBizno || null,
            award_price: safeParseInt(item.sucsfbidAmt),
            award_rate: item.sucsfbidRate ? parseFloat(item.sucsfbidRate) : null,
            award_date: toTimestamp(item.fnlSucsfDate || item.rlOpengDt),
            raw_data: item,
          });
        }

        if (pageNo * 999 >= totalCount) break;
        pageNo++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`G2B results fetch error [${endpoint.type}] page ${pageNo}: ${errMsg}`);
        break;
      }
    }
  }

  return { bids: [], results };
}
