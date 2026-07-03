// sources/lh.ts — LH 전자조달 입찰공고 수집 (XML + EUC-KR)

import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp, xmlGetText } from '../shared/parsers.ts';
import { matchKeywords } from '../shared/keywords.ts';
import type { FetchResult, NormalizedBid } from '../types.ts';

const LH_BID_BASE = "http://openapi.ebid.lh.or.kr/ebid.com.openapi.service.OpenBidInfoList.dev";

export async function fetchLhBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  let pageNo = 1;
  const maxPages = 5;

  while (pageNo <= maxPages) {
    try {
      const url = new URL(LH_BID_BASE);
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("numOfRows", "100");
      url.searchParams.set("pageNo", String(pageNo));
      url.searchParams.set("tndrbidRegDtStart", fmt(from));
      url.searchParams.set("tndrbidRegDtEnd", fmt(now));

      console.log(`[LH] Fetching page ${pageNo}`);
      const res = await fetchWithTimeout(url.toString());
      if (!res.ok) {
        console.error(`[LH] HTTP ${res.status} page ${pageNo}`);
        break;
      }

      // EUC-KR 디코딩
      const buffer = await res.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('euc-kr').decode(buffer);
      } catch {
        text = new TextDecoder('utf-8').decode(buffer);
      }

      const totalCountMatch = text.match(/<totalCount>(\d+)<\/totalCount>/);
      const totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : 0;

      const itemBlocks = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      console.log(`[LH] page ${pageNo}: ${itemBlocks.length}/${totalCount} items`);

      if (itemBlocks.length === 0) break;

      for (const block of itemBlocks) {
        const xml = block[1];
        const title = xmlGetText(xml, 'bidnmKor');
        const bidNum = xmlGetText(xml, 'bidNum');
        if (!bidNum || !title) continue;
        if (seen.has(bidNum)) continue;

        const matched = matchKeywords(title);
        if (matched.length === 0) continue;

        seen.add(bidNum);
        const priceStr = xmlGetText(xml, 'presmtPrc');

        bids.push({
          source: 'lh',
          bid_num: bidNum,
          title: title,
          org_name: xmlGetText(xml, 'zoneHqCd') || '한국토지주택공사',
          estimated_price: safeParseInt(priceStr),
          bid_method: xmlGetText(xml, 'tndrCtrctMedCd') || null,
          bid_type: '공사',
          reg_date: toTimestamp(xmlGetText(xml, 'tndrbidRegDt')),
          deadline: toTimestamp(xmlGetText(xml, 'tndrdocAcptEndDtm')),
          open_date: toTimestamp(xmlGetText(xml, 'openDtm')),
          detail_url: 'https://ebid.lh.or.kr/',
          matched_keywords: matched,
          status: xmlGetText(xml, 'bidProgrsStatus') === '마감' ? 'closed' : 'active',
          raw_data: {
            bidNum,
            bidnmKor: title,
            zoneHqCd: xmlGetText(xml, 'zoneHqCd'),
            presmtPrc: xmlGetText(xml, 'presmtPrc'),
            fdmtlAmt: xmlGetText(xml, 'fdmtlAmt'),
            addtTax: xmlGetText(xml, 'addtTax'),
            tndrCtrctMedCd: xmlGetText(xml, 'tndrCtrctMedCd'),
            tndrbidRegDt: xmlGetText(xml, 'tndrbidRegDt'),
            tndrdocAcptEndDtm: xmlGetText(xml, 'tndrdocAcptEndDtm'),
            openDtm: xmlGetText(xml, 'openDtm'),
            bidProgrsStatus: xmlGetText(xml, 'bidProgrsStatus'),
            cstrtnJobGbNm: xmlGetText(xml, 'cstrtnJobGbNm'),
          },
        });
      }

      if (pageNo * 100 >= totalCount) break;
      pageNo++;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`LH fetch error page ${pageNo}: ${errMsg}`);
      break;
    }
  }

  return { bids, results: [] };
}
