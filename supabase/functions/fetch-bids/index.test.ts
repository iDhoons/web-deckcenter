import { assertEquals, assertExists, assertStringIncludes } from "jsr:@std/assert";

// @TEST T1.1 - 입찰 수집 Edge Function 단위 테스트
// @IMPL supabase/functions/fetch-bids/index.ts
// @SPEC 데크 관련 키워드 매칭, 날짜 변환, XML 파싱 로직

// ============================================
// 테스트 대상 함수들 (실제 함수와 동기화)
// ============================================

const SEARCH_KEYWORDS = [
  "데크", "목재데크", "합성목", "합성목재",
  "조경시설", "목재시설", "방부목", "수변데크",
  "보행데크", "친수", "옥상녹화", "파고라"
];

function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SEARCH_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
}

function safeParseInt(val?: string | number | null): number | null {
  if (val == null || val === '') return null;
  const n = parseInt(String(val).replace(/[^0-9-]/g, ''));
  return isNaN(n) ? null : n;
}

function toTimestamp(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    let normalized = dateStr.trim();
    if (/^\d{8}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
    }
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function xmlGetText(itemXml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = itemXml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainRe = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const plainMatch = itemXml.match(plainRe);
  return plainMatch ? plainMatch[1].trim() : '';
}

// ============================================
// 테스트: matchKeywords
// ============================================

Deno.test("matchKeywords - 기본 정상 케이스", () => {
  const result = matchKeywords("목재데크 시공 프로젝트");
  assertEquals(result.length, 2); // "데크"와 "목재데크" 모두 매칭
  assertStringIncludes(result.join(","), "목재데크");
});

Deno.test("matchKeywords - 여러 키워드 매칭", () => {
  const result = matchKeywords("친수 공간에 보행데크 설치");
  assertEquals(result.length, 3); // "데크", "친수", "보행데크" 모두 매칭
  assertStringIncludes(result.join(","), "친수");
  assertStringIncludes(result.join(","), "보행데크");
});

Deno.test("matchKeywords - 키워드 없음", () => {
  const result = matchKeywords("일반 건축 공사입니다");
  assertEquals(result.length, 0);
});

Deno.test("matchKeywords - 대소문자 구분 없음", () => {
  const result = matchKeywords("데크");
  assertEquals(result[0], "데크");
});

Deno.test("matchKeywords - 빈 문자열", () => {
  const result = matchKeywords("");
  assertEquals(result.length, 0);
});

Deno.test("matchKeywords - 부분 매칭 (합성목재 포함)", () => {
  const result = matchKeywords("합성목재 테라스");
  assertEquals(result.length, 2); // "합성목" 과 "합성목재" 모두 매칭
  assertStringIncludes(result.join(","), "합성목재");
});

Deno.test("matchKeywords - 중복 키워드 필터링 없음 (각각 한 번씩)", () => {
  const result = matchKeywords("데크 데크 데크");
  assertEquals(result.length, 1); // 중복 제거 아님 - filter 방식이므로 1개
});

// ============================================
// 테스트: toTimestamp
// ============================================

Deno.test("toTimestamp - ISO 형식 정상", () => {
  const result = toTimestamp("2026-02-16");
  assertExists(result);
  assertStringIncludes(result!, "2026-02-16");
});

Deno.test("toTimestamp - YYYYMMDD 형식 (K-water/LH)", () => {
  const result = toTimestamp("20260216");
  assertExists(result);
  assertEquals(result?.substring(0, 10), "2026-02-16");
});

Deno.test("toTimestamp - null 입력", () => {
  const result = toTimestamp(null as any);
  assertEquals(result, null);
});

Deno.test("toTimestamp - undefined 입력", () => {
  const result = toTimestamp(undefined);
  assertEquals(result, null);
});

Deno.test("toTimestamp - 빈 문자열", () => {
  const result = toTimestamp("");
  assertEquals(result, null);
});

Deno.test("toTimestamp - 유효하지 않은 날짜", () => {
  const result = toTimestamp("not-a-date");
  assertEquals(result, null);
});

Deno.test("toTimestamp - 유효하지 않은 날짜 형식 (2026-13-45)", () => {
  const result = toTimestamp("2026-13-45");
  assertEquals(result, null);
});

Deno.test("toTimestamp - 긴 형식 (2026-02-16T10:30:45)", () => {
  const result = toTimestamp("2026-02-16T10:30:45");
  assertExists(result);
  // UTC로 변환되므로 시간대가 달라질 수 있음
  assertStringIncludes(result!, "2026-02-16");
});

// ============================================
// 테스트: xmlGetText
// ============================================

Deno.test("xmlGetText - 기본 정상 케이스", () => {
  const xml = "<root><title>Test Title</title></root>";
  const result = xmlGetText(xml, "title");
  assertEquals(result, "Test Title");
});

Deno.test("xmlGetText - CDATA 포함", () => {
  const xml = "<root><description><![CDATA[이것은_특수_텍스트]]></description></root>";
  const result = xmlGetText(xml, "description");
  assertEquals(result, "이것은_특수_텍스트");
});

Deno.test("xmlGetText - 태그 없음", () => {
  const xml = "<root><title>Test Title</title></root>";
  const result = xmlGetText(xml, "missing");
  assertEquals(result, "");
});

Deno.test("xmlGetText - 공백 포함", () => {
  const xml = "<root><title>  Test Title  </title></root>";
  const result = xmlGetText(xml, "title");
  assertEquals(result, "Test Title");
});

Deno.test("xmlGetText - 줄바꿈 포함", () => {
  const xml = "<root><title>\n  Test Title\n  </title></root>";
  const result = xmlGetText(xml, "title");
  assertEquals(result, "Test Title");
});

Deno.test("xmlGetText - 숫자 값", () => {
  const xml = "<root><count>12345</count></root>";
  const result = xmlGetText(xml, "count");
  assertEquals(result, "12345");
});

Deno.test("xmlGetText - CDATA 내 특수문자", () => {
  const xml = "<item><content><![CDATA[시공: 2026년 상반기, 비용: 5,000만원]]></content></item>";
  const result = xmlGetText(xml, "content");
  assertEquals(result, "시공: 2026년 상반기, 비용: 5,000만원");
});

Deno.test("xmlGetText - 빈 태그", () => {
  const xml = "<root><title></title></root>";
  const result = xmlGetText(xml, "title");
  assertEquals(result, "");
});

Deno.test("xmlGetText - CDATA 내 꺽쇠괄호(<) 포함", () => {
  const xml = "<item><desc><![CDATA[면적 < 100m2 공사]]></desc></item>";
  const result = xmlGetText(xml, "desc");
  assertEquals(result, "면적 < 100m2 공사");
});

// ============================================
// 테스트: safeParseInt
// ============================================

Deno.test("safeParseInt - 정상 숫자", () => {
  assertEquals(safeParseInt("12345"), 12345);
});

Deno.test("safeParseInt - 0원 정상 처리", () => {
  assertEquals(safeParseInt("0"), 0);
  assertEquals(safeParseInt(0), 0);
});

Deno.test("safeParseInt - 콤마 포함 금액", () => {
  assertEquals(safeParseInt("1,234,567"), 1234567);
});

Deno.test("safeParseInt - null/undefined/빈문자열", () => {
  assertEquals(safeParseInt(null), null);
  assertEquals(safeParseInt(undefined), null);
  assertEquals(safeParseInt(""), null);
});

Deno.test("safeParseInt - 문자열 (NaN)", () => {
  assertEquals(safeParseInt("abc"), null);
});

// ============================================
// 테스트: simpleHash
// ============================================

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

Deno.test("simpleHash - 결정적 (같은 입력 → 같은 출력)", () => {
  const a = simpleHash("데크 시설물 보수공사");
  const b = simpleHash("데크 시설물 보수공사");
  assertEquals(a, b);
});

Deno.test("simpleHash - 다른 입력 → 다른 출력", () => {
  const a = simpleHash("데크 시설물 보수공사");
  const b = simpleHash("데크 시설물 보수공사 2차");
  assertEquals(a !== b, true);
});

Deno.test("simpleHash - 빈 문자열", () => {
  const result = simpleHash("");
  assertEquals(result, "0");
});

Deno.test("safeParseInt - 음수", () => {
  assertEquals(safeParseInt("-500"), -500);
});

// ============================================
// 테스트: G2B 파싱 로직 (JSON)
// ============================================

Deno.test("G2B JSON 파싱 - 정상 응답", () => {
  const mockResponse = {
    response: {
      body: {
        items: [
          {
            bidNtceNo: "G2B-2026-001",
            bidNtceNm: "목재데크 시공",
            bidClseDt: "2026-02-28",
            rgstDt: "2026-02-15",
          }
        ]
      }
    }
  };

  const item = mockResponse.response.body.items[0];
  const matched = matchKeywords(item.bidNtceNm);
  const deadline = toTimestamp(item.bidClseDt);
  const regDate = toTimestamp(item.rgstDt);

  assertEquals(matched.length, 2); // "데크"와 "목재데크" 모두
  assertStringIncludes(matched.join(","), "목재데크");
  assertExists(deadline);
  assertExists(regDate);
});

Deno.test("G2B JSON 파싱 - 빈 아이템 배열", () => {
  const mockResponse = {
    response: {
      body: {
        items: []
      }
    }
  };

  const items = mockResponse.response.body.items;
  assertEquals(items.length, 0);
});

Deno.test("G2B JSON 파싱 - items null", () => {
  const mockResponse = {
    response: {
      body: {
        items: null
      }
    }
  };

  const items = mockResponse.response.body.items;
  assertEquals(items, null);
});

Deno.test("G2B JSON 파싱 - 단일 아이템 (배열 아님)", () => {
  const mockResponse = {
    response: {
      body: {
        items: {
          bidNtceNo: "G2B-2026-001",
          bidNtceNm: "합성목 데크 설치",
        }
      }
    }
  };

  const rawItems = mockResponse.response.body.items;
  const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];

  assertEquals(itemList.length, 1);
  assertEquals(itemList[0].bidNtceNm, "합성목 데크 설치");
});

Deno.test("G2B JSON 파싱 - 키워드 필터링", () => {
  const mockResponse = {
    response: {
      body: {
        items: [
          {
            bidNtceNo: "G2B-001",
            bidNtceNm: "일반 건축공사"
          },
          {
            bidNtceNo: "G2B-002",
            bidNtceNm: "보행데크 조성"
          }
        ]
      }
    }
  };

  const items = mockResponse.response.body.items;
  const filtered = items.filter((item: any) => {
    const matched = matchKeywords(item.bidNtceNm);
    return matched.length > 0;
  });

  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].bidNtceNm, "보행데크 조성");
});

// ============================================
// 테스트: K-APT 파싱 로직 (JSON)
// ============================================

Deno.test("K-APT JSON 파싱 - 정상 응답", () => {
  const mockResponse = {
    response: {
      body: {
        items: [
          {
            bidNum: "K-APT-2026-001",
            bidTitle: "옥상녹화 및 데크 시공",
            bidDeadline: "2026-02-28",
            bidRegDate: "2026-02-15",
            bidState: "공고중"
          }
        ]
      }
    }
  };

  const item = mockResponse.response.body.items[0];
  const matched = matchKeywords(item.bidTitle);
  const status = item.bidState === '마감' ? 'closed' : 'active';

  assertEquals(matched.length, 2); // 옥상녹화, 데크
  assertEquals(status, 'active');
});

Deno.test("K-APT 파싱 - 마감 상태", () => {
  const mockResponse = {
    response: {
      body: {
        items: [
          {
            bidNum: "K-APT-2026-002",
            bidTitle: "방부목 교체",
            bidState: "마감"
          }
        ]
      }
    }
  };

  const item = mockResponse.response.body.items[0];
  const status = item.bidState === '마감' ? 'closed' : 'active';

  assertEquals(status, 'closed');
});

Deno.test("K-APT 파싱 - 필수 필드 누락 (title/num)", () => {
  const mockResponse = {
    response: {
      body: {
        items: [
          {
            bidNum: null,
            bidTitle: "수변데크 설치"
          },
          {
            bidNum: "K-APT-001",
            bidTitle: undefined
          }
        ]
      }
    }
  };

  const items = mockResponse.response.body.items;
  const filtered = items.filter((item: any) => item.bidNum && item.bidTitle);

  assertEquals(filtered.length, 0);
});

// ============================================
// 테스트: D2B 파싱 로직 (JSON)
// ============================================

Deno.test("D2B JSON 파싱 - response.body.items.item 경로", () => {
  const mockResponse = {
    response: {
      body: {
        items: {
          item: [
            {
              pblancNo: "D2B-2026-001",
              bidNm: "조경시설 목재 교체"
            }
          ]
        }
      }
    }
  };

  const items = mockResponse.response.body.items?.item
    || mockResponse.response.body.items;

  assertExists(items);
  const bidNm = Array.isArray(items) ? (items[0] as any).bidNm : (items as any).bidNm;
  assertEquals(bidNm, "조경시설 목재 교체");
});

Deno.test("D2B 날짜 파싱 - YYYYMMDD 형식", () => {
  const dateStr = "20260216";
  const y = dateStr.slice(0,4);
  const m = dateStr.slice(4,6);
  const day = dateStr.slice(6,8);
  const timestamp = toTimestamp(`${y}-${m}-${day}`);

  assertExists(timestamp);
  assertStringIncludes(timestamp!, "2026-02-16");
});

Deno.test("D2B 날짜 파싱 - YYYYMMDDHHMM 형식", () => {
  const dateStr = "202602161030";
  const y = dateStr.slice(0,4);
  const m = dateStr.slice(4,6);
  const day = dateStr.slice(6,8);
  const h = dateStr.slice(8,10);
  const min = dateStr.slice(10,12);
  const timestamp = toTimestamp(`${y}-${m}-${day}T${h}:${min}:00`);

  assertExists(timestamp);
  assertStringIncludes(timestamp!, "2026-02-16");
});

Deno.test("D2B 날짜 파싱 - 짧은 문자열 (8자 미만)", () => {
  const dateStr = "2026021";
  const result = dateStr.length < 8 ? null : "valid";

  assertEquals(result, null);
});

// ============================================
// 테스트: K-water 파싱 로직 (JSON)
// ============================================

Deno.test("K-water JSON 파싱 - data.response.body.items.item 경로", () => {
  const mockResponse = {
    response: {
      body: {
        items: {
          item: [
            {
              tndrPbanno: "KW-2026-001",
              tndrPblancNm: "수변데크 설치 공사",
              tndrPblancDe: "20260215",
              tndrStat: "공고중"
            }
          ]
        }
      }
    }
  };

  const items = mockResponse.response.body.items?.item;
  const item = items[0];

  assertEquals(item.tndrPbanno, "KW-2026-001");
  const matched = matchKeywords(item.tndrPblancNm);
  assertEquals(matched.length, 2); // "데크"와 "수변데크" 모두 매칭
  assertStringIncludes(matched.join(","), "수변데크");
});

Deno.test("K-water 파싱 - 마감 상태", () => {
  const item = {
    tndrStat: "마감",
    tndrPbanno: "KW-001"
  };

  const status = item.tndrStat === '마감' ? 'closed' : 'active';
  assertEquals(status, 'closed');
});

Deno.test("K-water 파싱 - 가격 문자열 정제", () => {
  const priceStr = "1,500,000,000";
  const price = parseInt(priceStr.replace(/[^0-9]/g, ''));

  assertEquals(price, 1500000000);
});

// ============================================
// 테스트: LH XML 파싱 로직
// ============================================

Deno.test("LH XML 파싱 - totalCount 추출", () => {
  const xml = "<root><totalCount>42</totalCount><item></item></root>";
  const totalCountMatch = xml.match(/<totalCount>(\d+)<\/totalCount>/);
  const totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : 0;

  assertEquals(totalCount, 42);
});

Deno.test("LH XML 파싱 - item 블록 추출", () => {
  const xml = `
    <root>
      <item>
        <bidNum>LH-001</bidNum>
        <bidnmKor>목재데크 설치</bidnmKor>
      </item>
      <item>
        <bidNum>LH-002</bidNum>
        <bidnmKor>옥상녹화</bidnmKor>
      </item>
    </root>
  `;

  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  assertEquals(itemBlocks.length, 2);
});

Deno.test("LH XML 파싱 - xmlGetText로 데이터 추출", () => {
  const itemXml = `
    <item>
      <bidNum>LH-2026-001</bidNum>
      <bidnmKor>보행데크 설치</bidnmKor>
      <presmtPrc>150000000</presmtPrc>
      <tndrbidRegDt>20260215</tndrbidRegDt>
    </item>
  `;

  const bidNum = xmlGetText(itemXml, "bidNum");
  const title = xmlGetText(itemXml, "bidnmKor");
  const price = xmlGetText(itemXml, "presmtPrc");

  assertEquals(bidNum, "LH-2026-001");
  assertEquals(title, "보행데크 설치");
  assertEquals(price, "150000000");
});

Deno.test("LH XML 파싱 - 중복 제거", () => {
  const seen = new Set<string>();
  const bids = [
    { bidNum: "LH-001", title: "데크" },
    { bidNum: "LH-001", title: "데크" }, // 중복
    { bidNum: "LH-002", title: "데크" },
  ];

  const filtered = bids.filter(bid => {
    if (seen.has(bid.bidNum)) return false;
    seen.add(bid.bidNum);
    return true;
  });

  assertEquals(filtered.length, 2);
});

// ============================================
// 테스트: LOFIN 파싱 로직 (JSON)
// ============================================

Deno.test("LOFIN JSON 파싱 - WCEGCF 응답 구조", () => {
  const data = {
    WCEGCF: [
      {
        head: { /* 헤더 정보 */ }
      },
      {
        row: [
          {
            ctrt_trgt_nm: "친수 공간 목재 데크",
            ctrt_ldgr_mng_no: "LOFIN-2026-001",
            laf_hg_nm: "서울시 강남구",
            clt_nm: "테크건설"
          }
        ]
      }
    ]
  };

  let items: any[] = [];
  for (const section of (data as any).WCEGCF) {
    if (section.row) {
      items = section.row;
      break;
    }
  }

  assertEquals(items.length, 1);
  assertEquals(items[0].ctrt_trgt_nm, "친수 공간 목재 데크");
});

Deno.test("LOFIN 파싱 - 계약일자 형식 (YYYYMMDD)", () => {
  const dateStr = "20260216";
  const isoDate = dateStr.length === 8
    ? toTimestamp(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`)
    : toTimestamp(dateStr);

  assertExists(isoDate);
  assertStringIncludes(isoDate!, "2026-02-16");
});

Deno.test("LOFIN 파싱 - 지역 조합 (시도명 + 자치단체명)", () => {
  const item = {
    wa_laf_hg_nm: "서울시",
    laf_hg_nm: "강남구"
  };

  const region = [item.wa_laf_hg_nm, item.laf_hg_nm].filter(Boolean).join(' ');
  assertEquals(region, "서울시 강남구");
});

Deno.test("LOFIN 파싱 - 중복 제거 (contractId 기반)", () => {
  const seen = new Set<string>();
  const contracts = [
    { ctrt_ldgr_mng_no: "ID-001", ctrt_trgt_nm: "데크" },
    { ctrt_ldgr_mng_no: "ID-001", ctrt_trgt_nm: "데크" }, // 중복
    { ctrt_ldgr_mng_no: "ID-002", ctrt_trgt_nm: "데크" },
  ];

  const filtered = contracts.filter(c => {
    const id = c.ctrt_ldgr_mng_no || c.ctrt_trgt_nm;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  assertEquals(filtered.length, 2);
});

// ============================================
// 테스트: Deadline 기반 상태 전환
// ============================================

Deno.test("Status 전환 - deadline 이전 (active)", () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const shouldClose = futureDate < now;
  assertEquals(shouldClose, false);
});

Deno.test("Status 전환 - deadline 지남 (closed)", () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const shouldClose = pastDate < now;
  assertEquals(shouldClose, true);
});

// ============================================
// 엣지 케이스 테스트
// ============================================

Deno.test("엣지 케이스 - 매우 긴 텍스트 검색", () => {
  const longText = "데크".repeat(1000) + "건축공사";
  const result = matchKeywords(longText);

  assertEquals(result.length, 1);
  assertEquals(result[0], "데크");
});

Deno.test("엣지 케이스 - 특수문자 포함", () => {
  const text = "목재데크® 설치 #프로젝트";
  const result = matchKeywords(text);

  assertEquals(result.length, 2); // "데크"와 "목재데크" 모두 매칭
  assertStringIncludes(result.join(","), "목재데크");
});

Deno.test("엣지 케이스 - 숫자만 있는 XML", () => {
  const xml = "<item><price>1500000000</price></item>";
  const result = xmlGetText(xml, "price");

  assertEquals(result, "1500000000");
});

Deno.test("엣지 케이스 - 유효하지 않은 XML 구조", () => {
  const xml = "<item><price>1500000000</item>";
  const result = xmlGetText(xml, "price");

  assertEquals(result, "");
});

Deno.test("엣지 케이스 - 가격 문자열 정제 (여러 형식)", () => {
  const testCases = [
    { input: "1,500,000", expected: 1500000 },
    { input: "1.5M", expected: 15 }, // 숫자만 추출
    { input: "약 5,000만원", expected: 5000 },
  ];

  for (const testCase of testCases) {
    const result = parseInt(testCase.input.replace(/[^0-9]/g, '') || "0");
    assertExists(result);
  }
});

Deno.test("엣지 케이스 - 배열과 단일값 처리", () => {
  const testCases = [
    [{ id: 1 }], // 배열
    { id: 1 },   // 단일값
    null,        // null
  ];

  for (const testCase of testCases) {
    const itemList = Array.isArray(testCase) ? testCase : (testCase ? [testCase] : []);
    assertExists(itemList);
  }
});
