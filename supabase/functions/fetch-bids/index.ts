import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// 데크 입찰정보 수집 Edge Function
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DATA_GO_KR_API_KEY = Deno.env.get("DATA_GO_KR_API_KEY");
const FETCH_BIDS_SECRET = Deno.env.get("FETCH_BIDS_SECRET");
const LOFIN365_API_KEY = Deno.env.get("LOFIN365_API_KEY");

// 데크 관련 키워드
const SEARCH_KEYWORDS = [
  "데크", "목재데크", "합성목", "합성목재",
  "조경시설", "목재시설", "방부목", "수변데크",
  "보행데크", "친수", "옥상녹화", "파고라"
];

// K-APT 입찰공고 API
const KAPT_API_BASE = "https://apis.data.go.kr/1613000/ApHusBidPblAncInfoOfferServiceV2/getBidPblAncNmSearchV2";

// 나라장터 입찰공고 API (공사) - 신규 엔드포인트 2026
const G2B_BID_CNSTWK = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwk";
// 나라장터 입찰공고 API (용역)
const G2B_BID_SERVC = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc";

// 나라장터 낙찰정보 API - 신규 엔드포인트 2026
const G2B_RESULT_CNSTWK = "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusCnstwk";
const G2B_RESULT_SERVC = "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getScsbidListSttusServc";

// D2B 국방전자조달 API
const D2B_BID_BASE = "http://openapi.d2b.go.kr/openapi/service/BidPblancInfoService/getDmstcCmpetBidPblancList";
const D2B_RESULT_BASE = "http://openapi.d2b.go.kr/openapi/service/BidResultInfoService/getDmstcCmpetBidResultList";

// 지방재정365 계약현황 API (www.lofin365.go.kr 공식 OpenAPI)
const LOFIN_API_BASE = "https://www.lofin365.go.kr/lf/hub/WCEGCF";

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

// 지방재정365 계약현황 응답 필드 (공식 OpenAPI 문서 기준)
interface LofinContractItem {
  laf_cd?: string;           // 자치단체코드
  ctrt_ldgr_mng_no?: string; // 계약대장관리번호
  data_crt_ymd?: string;     // 자료생성일자
  laf_hg_nm?: string;        // 자치단체명
  wa_laf_hg_nm?: string;     // 시도명
  ctrt_mth_nm?: string;      // 계약방법
  ctrt_knd_nm?: string;      // 계약종류
  ctrt_trgt_nm?: string;     // 계약명
  smz_ctrt_ymd?: string;     // 계약일자
  ctrt_tot_tott_amt?: string; // 계약집계금액
  clt_nm?: string;           // 업체명
  sbc_yn?: string;           // 하도급유무
}

function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SEARCH_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
}

function toTimestamp(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// K-APT 입찰 수집
async function fetchKaptBids(apiKey: string): Promise<any[]> {
  const results: any[] = [];
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
      const res = await fetch(url.toString());
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

        results.push({
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

  return results;
}

// 나라장터 입찰 수집 (공사 + 용역)
async function fetchG2bBids(apiKey: string): Promise<any[]> {
  const results: any[] = [];

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
        const res = await fetch(url.toString());
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

          results.push({
            source: 'g2b',
            bid_num: item.bidNtceNo,
            title: item.bidNtceNm,
            org_name: item.ntceInsttNm || item.dminsttNm || null,
            org_code: item.ntceInsttCd || null,
            estimated_price: item.presmptPrce ? parseInt(item.presmptPrce) : null,
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

  return results;
}

// 나라장터 낙찰 결과 수집 (공사 + 용역, 전체 조회 후 로컬 필터링)
async function fetchG2bResults(apiKey: string): Promise<any[]> {
  const results: any[] = [];
  const seen = new Set<string>();

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 최근 7일
  const formatDate = (d: Date) => {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}0000`;
  };

  const endpoints = [
    { url: G2B_RESULT_CNSTWK, type: '공사' },
    { url: G2B_RESULT_SERVC, type: '용역' },
  ];

  for (const endpoint of endpoints) {
    let pageNo = 1;
    const maxPages = 7; // 최대 7페이지 (약 7,000건)

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
        const res = await fetch(url.toString());
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

          // 공고명으로 키워드 매칭 (로컬 필터링)
          const title = item.bidNtceNm || '';
          const matched = matchKeywords(title);
          if (matched.length === 0) continue;

          seen.add(item.bidNtceNo);
          results.push({
            source: 'g2b',
            bid_num: item.bidNtceNo,
            company_name: item.bidwinnrNm,
            company_bizno: item.bidwinnrBizno || null,
            award_price: item.sucsfbidAmt ? parseInt(item.sucsfbidAmt) : null,
            award_rate: item.sucsfbidRate ? parseFloat(item.sucsfbidRate) : null,
            award_date: toTimestamp(item.fnlSucsfDate || item.rlOpengDt),
            raw_data: item,
          });
        }

        // 모든 데이터를 가져왔으면 종료
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

  return results;
}

// D2B 국방전자조달 입찰공고 수집
async function fetchD2bBids(apiKey: string): Promise<any[]> {
  const results: any[] = [];

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
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`[D2B] HTTP ${res.status} for '${keyword}'`);
        continue;
      }

      const data = await res.json();
      // D2B API 응답 구조: response.body.items 또는 Items.Item
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

        // D2B 날짜 형식: YYYYMMDD 또는 YYYYMMDDHHMM
        const parseD2bDate = (d?: string) => {
          if (!d || d.length < 8) return null;
          const y = d.slice(0,4), m = d.slice(4,6), day = d.slice(6,8);
          const h = d.length >= 10 ? d.slice(8,10) : '00';
          const min = d.length >= 12 ? d.slice(10,12) : '00';
          return toTimestamp(`${y}-${m}-${day}T${h}:${min}:00`);
        };

        results.push({
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

  return results;
}

// D2B 국방전자조달 입찰결과 수집
async function fetchD2bResults(apiKey: string): Promise<any[]> {
  const results: any[] = [];
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
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[D2B-결과] HTTP ${res.status}`);
      return results;
    }

    const data = await res.json();
    const items = data?.response?.body?.items?.item
      || data?.response?.body?.items
      || data?.Items?.Item;
    if (!items) return results;

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

  return results;
}

// 지방재정365 계약현황 수집 (지자체 계약 정보)
// API: https://www.lofin365.go.kr/lf/hub/WCEGCF
// Deno Deploy의 TLS와 lofin365 서버가 호환되지 않아 pg_net(libcurl)을 통해 우회
// 2-phase 방식: (1) pg_net으로 HTTP 요청 전송 → (2) 대기 → (3) 응답 조회 및 처리
async function fetchLofinContracts(apiKey: string, supabase: any): Promise<{ bids: any[]; results: any[] }> {
  const bids: any[] = [];
  const results: any[] = [];
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

  // Phase 2: pg_net 응답 대기 (트랜잭션 경계 이후에 응답 도착)
  await new Promise(r => setTimeout(r, 8000));

  // Phase 3: 응답 배치 조회
  const { data: responses, error: getErr } = await supabase.rpc('lofin_get_responses', { req_ids: reqIds });
  if (getErr) {
    console.error(`[LOFIN] Batch get error: ${getErr.message}`);
    return { bids, results };
  }

  let okCount = 0, errCount = 0, pendingCount = 0;

  for (const resp of responses as any[]) {
    const { keyword, dateStr } = meta[resp.idx];

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

    // 응답 구조: WCEGCF[0].head, WCEGCF[1].row[]
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
        || `${item.laf_cd || ''}-${item.smz_ctrt_ymd || dateStr}-${contractName.slice(0, 30)}`;

      if (seen.has(contractId)) continue;
      seen.add(contractId);

      const price = item.ctrt_tot_tott_amt
        ? parseInt(String(item.ctrt_tot_tott_amt).replace(/[^0-9]/g, '')) || null
        : null;

      const ctrtDate = item.smz_ctrt_ymd || dateStr;
      const isoDate = ctrtDate.length === 8
        ? toTimestamp(`${ctrtDate.slice(0,4)}-${ctrtDate.slice(4,6)}-${ctrtDate.slice(6,8)}`)
        : toTimestamp(ctrtDate);

      const region = [item.wa_laf_hg_nm, item.laf_hg_nm].filter(Boolean).join(' ');

      // 지방재정365 계약현황 검색 URL 생성
      const lofinDetailUrl = item.laf_cd
        ? `https://lofin365.go.kr/portal/service/openInf498.do?laf_cd=${item.laf_cd}&ctrt_trgt_nm=${encodeURIComponent(contractName.slice(0, 50))}`
        : null;

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

  const stats = { kapt: 0, g2b: 0, d2b: 0, lofin: 0, results: 0, d2b_results: 0, lofin_results: 0, errors: [] as string[] };

  try {
    // 1. K-APT 입찰 수집
    const kaptBids = await fetchKaptBids(DATA_GO_KR_API_KEY);
    if (kaptBids.length > 0) {
      const { error } = await supabase
        .from('bid_notices')
        .upsert(kaptBids, { onConflict: 'source,bid_num' });
      if (error) stats.errors.push(`kapt upsert: ${error.message}`);
      else stats.kapt = kaptBids.length;
    }

    // 2. 나라장터 입찰 수집
    const g2bBids = await fetchG2bBids(DATA_GO_KR_API_KEY);
    if (g2bBids.length > 0) {
      const { error } = await supabase
        .from('bid_notices')
        .upsert(g2bBids, { onConflict: 'source,bid_num' });
      if (error) stats.errors.push(`g2b upsert: ${error.message}`);
      else stats.g2b = g2bBids.length;
    }

    // 3. D2B 국방전자조달 입찰 수집
    const d2bBids = await fetchD2bBids(DATA_GO_KR_API_KEY);
    if (d2bBids.length > 0) {
      const { error } = await supabase
        .from('bid_notices')
        .upsert(d2bBids, { onConflict: 'source,bid_num' });
      if (error) stats.errors.push(`d2b upsert: ${error.message}`);
      else stats.d2b = d2bBids.length;
    }

    // 4. 나라장터 낙찰 결과 수집
    const g2bResults = await fetchG2bResults(DATA_GO_KR_API_KEY);
    if (g2bResults.length > 0) {
      for (const result of g2bResults) {
        const { data: notice } = await supabase
          .from('bid_notices')
          .select('id')
          .eq('source', result.source)
          .eq('bid_num', result.bid_num)
          .single();

        if (notice) {
          result.bid_notice_id = notice.id;
        }
      }

      const { error } = await supabase
        .from('bid_results')
        .upsert(g2bResults, { onConflict: 'source,bid_num' });
      if (error) stats.errors.push(`results upsert: ${error.message}`);
      else stats.results = g2bResults.length;
    }

    // 5. 지방재정365 계약현황 수집
    if (LOFIN365_API_KEY) {
      const lofin = await fetchLofinContracts(LOFIN365_API_KEY, supabase);

      if (lofin.bids.length > 0) {
        const { error } = await supabase
          .from('bid_notices')
          .upsert(lofin.bids, { onConflict: 'source,bid_num' });
        if (error) stats.errors.push(`lofin upsert: ${error.message}`);
        else stats.lofin = lofin.bids.length;
      }

      if (lofin.results.length > 0) {
        for (const result of lofin.results) {
          const { data: notice } = await supabase
            .from('bid_notices')
            .select('id')
            .eq('source', result.source)
            .eq('bid_num', result.bid_num)
            .single();

          if (notice) result.bid_notice_id = notice.id;
        }

        const { error } = await supabase
          .from('bid_results')
          .upsert(lofin.results, { onConflict: 'source,bid_num' });
        if (error) stats.errors.push(`lofin results upsert: ${error.message}`);
        else stats.lofin_results = lofin.results.length;
      }
    } else {
      console.log('[LOFIN] API key not set, skipping');
    }

    // 6. D2B 입찰결과 수집
    const d2bResults = await fetchD2bResults(DATA_GO_KR_API_KEY);
    if (d2bResults.length > 0) {
      for (const result of d2bResults) {
        const { data: notice } = await supabase
          .from('bid_notices')
          .select('id')
          .eq('source', result.source)
          .eq('bid_num', result.bid_num)
          .single();

        if (notice) {
          result.bid_notice_id = notice.id;
        }
      }

      const { error } = await supabase
        .from('bid_results')
        .upsert(d2bResults, { onConflict: 'source,bid_num' });
      if (error) stats.errors.push(`d2b results upsert: ${error.message}`);
      else stats.d2b_results = d2bResults.length;
    }

    // 7. 마감된 공고 상태 업데이트
    await supabase
      .from('bid_notices')
      .update({ status: 'closed' })
      .lt('deadline', new Date().toISOString())
      .eq('status', 'active');

  } catch (e) {
    stats.errors.push(`general: ${(e as Error).message}`);
  }

  // 내부 에러 로그 (서버 콘솔에만)
  if (stats.errors.length > 0) {
    console.error('Processing errors:', JSON.stringify(stats.errors));
  }

  // 8. 후속 작업 체이닝 (비동기 — 응답 대기하지 않음)
  if (FETCH_BIDS_SECRET && SUPABASE_URL) {
    // 알림 발송
    fetch(`${SUPABASE_URL}/functions/v1/send-bid-alerts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FETCH_BIDS_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch(e => console.error('Alert chain error:', e.message));

    // AI 요약 배치 처리
    fetch(`${SUPABASE_URL}/functions/v1/batch-summarize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FETCH_BIDS_SECRET}`,
        'Content-Type': 'application/json',
      },
    }).catch(e => console.error('Summarize chain error:', e.message));
  }

  return new Response(JSON.stringify({
    success: stats.errors.length === 0,
    fetched: {
      kapt_bids: stats.kapt,
      g2b_bids: stats.g2b,
      d2b_bids: stats.d2b,
      lofin_contracts: stats.lofin,
      g2b_results: stats.results,
      d2b_results: stats.d2b_results,
      lofin_results: stats.lofin_results,
    },
    errors: stats.errors.length > 0
      ? [`${stats.errors.length} error(s) occurred during processing`]
      : [],
    timestamp: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
});
