# 입찰 수집 구조 개선 Implementation Plan

**Goal:** 전문가 패널 합의에 따라 fetch-bids의 근본 원인(경계 부재 + 측정 부재 + 검증 부재)을 해결한다
**Architecture:** 1,150줄 단일 파일 → 소스별 모듈 분리 + 공통 타입 + 측정 인프라 + 병렬화
**Tech Stack:** Supabase Edge Functions (Deno), TypeScript, PostgreSQL

---

## 현재 코드 구조 (AS-IS)

```
supabase/functions/fetch-bids/
├── index.ts           (1,150줄 - 모든 로직이 여기에)
└── index.test.ts      (763줄 - 61개 테스트)
```

### 현재 실행 흐름 (순차)

```
Deno.serve() [924줄]
  ├─ 인증 확인 [932~977줄]
  │
  ├─ 1. fetchKaptBids()     [175~247줄] → upsert bid_notices [985줄]
  ├─ 2. fetchG2bBids()      [250~326줄] → upsert bid_notices [995줄]
  ├─ 3. fetchD2bBids()      [412~488줄] → upsert bid_notices [1005줄]
  ├─ 4. fetchG2bResults()   [329~409줄] → upsert bid_results [1016줄]
  ├─ 5. fetchLofinContracts()[555~682줄] → upsert 양쪽      [1028줄]
  ├─ 6. fetchD2bResults()   [491~549줄] → upsert bid_results [1051줄]
  ├─ 7. fetchKwaterBids()   [687~767줄] → upsert bid_notices [1061줄]
  ├─ 8. fetchLhBids()       [785~887줄] → upsert bid_notices [1071줄]
  │
  ├─ 9. 마감 지난 입찰 closed 처리  [1079줄]
  ├─ 10. 90일 stale 정리           [1086줄]
  │
  ├─ fire-and-forget: send-bid-alerts  [1106줄]
  └─ fire-and-forget: batch-summarize  [1118줄]
```

### 유틸리티 함수 위치

| 함수 | 줄 | 용도 |
|------|-----|------|
| `fetchWithTimeout(url, opts?)` | 133~137 | 15초 타임아웃 HTTP |
| `simpleHash(str)` | 140~146 | LOFIN 결정적 해시 |
| `safeParseInt(val?)` | 148~152 | 안전한 정수 파싱 |
| `matchKeywords(text)` | 154~157 | 키워드 매칭 |
| `toTimestamp(dateStr?)` | 159~172 | 날짜 → ISO 변환 |
| `xmlGetText(itemXml, tag)` | 770~779 | XML/CDATA 파싱 |

### 검색 키워드 (13줄)

```
SEARCH_KEYWORDS = ['데크', '목재데크', '합성목', '합성목재', '합성데크', '방부목']
```

### DB 작업 요약

| 소스 | 테이블 | 작업 | 충돌 키 |
|------|--------|------|---------|
| K-APT | bid_notices | UPSERT | (source, bid_num) |
| G2B 입찰 | bid_notices | UPSERT | (source, bid_num) |
| G2B 결과 | bid_results | UPSERT | (source, bid_num) |
| D2B 입찰 | bid_notices | UPSERT | (source, bid_num) |
| D2B 결과 | bid_results | UPSERT | (source, bid_num) |
| LOFIN | bid_notices + bid_results | UPSERT | (source, bid_num) |
| K-water | bid_notices | UPSERT | (source, bid_num) |
| LH | bid_notices | UPSERT | (source, bid_num) |

### API 딜레이 현황

| 소스 | 딜레이 | 위치 |
|------|--------|------|
| K-APT | 500ms × 6키워드 = 3초 | 239줄 |
| G2B | 300ms × 페이지 | 317, 399줄 |
| D2B | 300ms × 키워드/페이지 | 480줄 |
| LOFIN | 8초 고정 대기 | 590줄 |
| K-water | 300ms × 페이지 | 757줄 |
| LH | 300ms × 페이지 | 878줄 |

---

## 목표 코드 구조 (TO-BE)

```
supabase/functions/fetch-bids/
├── index.ts              (~120줄) 오케스트레이터
├── types.ts              (~50줄)  공통 타입 정의
├── perf-tracker.ts       (~60줄)  측정 인프라
├── sources/
│   ├── kapt.ts           (~80줄)  K-APT 수집 + 정규화
│   ├── g2b.ts            (~120줄) G2B 입찰 + 결과
│   ├── d2b.ts            (~120줄) D2B 입찰 + 결과
│   ├── lofin.ts          (~140줄) LOFIN 계약 (pg_net)
│   ├── kwater.ts         (~90줄)  K-water 수집
│   └── lh.ts             (~110줄) LH 수집 (XML)
├── shared/
│   ├── http-client.ts    (~20줄)  fetchWithTimeout
│   ├── parsers.ts        (~40줄)  safeParseInt, toTimestamp, xmlGetText
│   ├── keywords.ts       (~15줄)  SEARCH_KEYWORDS, matchKeywords
│   └── db.ts             (~60줄)  upsertBids, upsertResults, linkResults
└── index.test.ts         (기존 유지 + 모듈별 테스트 추가)
```

---

## Phase 0: 측정 인프라 (1~2일)

> 쉽게 말하면: "전기 계량기를 먼저 달자"

### 체크리스트

- [ ] `perf-tracker.ts` 생성
- [ ] index.ts에 측정 포인트 삽입 (각 소스별 시작/종료 시간)
- [ ] 응답 JSON에 diagnostics 필드 추가
- [ ] 기존 테스트가 깨지지 않는지 확인

### Task 0-1: perf-tracker.ts 생성

**Files:**
- Create: `supabase/functions/fetch-bids/perf-tracker.ts`

**코드 흐름:**
```
PerfTracker.start(label)  → 시작 시간 기록
PerfTracker.end(label)    → 종료 시간 기록, 소요시간 계산
PerfTracker.error(label, msg) → 에러 기록
PerfTracker.report()      → 전체 결과 반환
```

**핵심 구현:**
```typescript
interface PerfEntry {
  label: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  itemCount?: number;
  errors: string[];
}

export class PerfTracker {
  private entries = new Map<string, PerfEntry>();
  private globalStart = performance.now();

  start(label: string) { ... }
  end(label: string, itemCount?: number) { ... }
  error(label: string, msg: string) { ... }

  report(): {
    totalDurationMs: number;
    sources: Record<string, { durationMs: number; items: number; errors: string[] }>;
    memoryMB: number;
  }
}
```

### Task 0-2: index.ts에 측정 포인트 삽입

**Files:**
- Modify: `supabase/functions/fetch-bids/index.ts` (6곳에 tracker 호출 추가)

**변경 위치:**
```
981줄 전: tracker.start('kapt')
990줄 후: tracker.end('kapt', kaptBids.length)

993줄 전: tracker.start('g2b_bids')
1000줄 후: tracker.end('g2b_bids', g2bBids.length)

... (각 소스마다 동일 패턴)
```

**응답 변경 (1126줄):**
```typescript
// 기존
return new Response(JSON.stringify({ success: true, fetched: stats, ... }))

// 변경
return new Response(JSON.stringify({
  success: true,
  fetched: stats,
  diagnostics: tracker.report(),  // ← 추가
  ...
}))
```

### Task 0-3: 검증

**확인 사항:**
- [ ] `deno test index.test.ts` — 기존 61개 테스트 전부 통과
- [ ] 수동 POST 호출 → diagnostics 필드에 소스별 소요시간 확인
- [ ] 에러 발생 시 diagnostics.sources[소스].errors에 기록 확인

---

## Phase 1: 공통 타입 + 유틸리티 분리 (1일)

> 쉽게 말하면: "공통 양식지와 도구함을 따로 정리하자"

### 체크리스트

- [ ] `types.ts` 생성 — NormalizedBid, NormalizedResult 타입
- [ ] `shared/http-client.ts` — fetchWithTimeout 추출 (133~137줄)
- [ ] `shared/parsers.ts` — safeParseInt, toTimestamp, xmlGetText 추출
- [ ] `shared/keywords.ts` — SEARCH_KEYWORDS, matchKeywords 추출
- [ ] index.ts에서 import로 교체
- [ ] 기존 테스트 통과 확인

### Task 1-1: types.ts

**Files:**
- Create: `supabase/functions/fetch-bids/types.ts`

**핵심 타입:**
```typescript
export type BidSource = 'kapt' | 'g2b' | 'd2b' | 'lofin' | 'kwater' | 'lh';

export interface NormalizedBid {
  source: BidSource;
  bid_num: string;
  title: string;
  content?: string;
  org_name?: string;
  org_code?: string;
  region?: string;
  estimated_price: number | null;  // 0은 유효!
  bid_method?: string;
  award_method?: string;
  bid_type?: string;
  reg_date: string | null;
  deadline: string | null;
  open_date?: string | null;
  file_url?: string;
  detail_url?: string;
  matched_keywords: string[];
  status: 'active' | 'closed';
  raw_data: unknown;
}

export interface NormalizedResult {
  source: BidSource;
  bid_num: string;
  bid_notice_id?: string;
  company_name?: string;
  company_bizno?: string;
  award_price: number | null;
  award_rate?: number | null;
  award_date: string | null;
  raw_data: unknown;
}

export interface FetchResult {
  bids: NormalizedBid[];
  results: NormalizedResult[];
}
```

### Task 1-2: shared/ 파일 3개 추출

**추출 대상 (index.ts에서 잘라내기):**

| 새 파일 | 원본 위치 | 함수 |
|---------|----------|------|
| `shared/http-client.ts` | 133~137줄 | fetchWithTimeout |
| `shared/parsers.ts` | 140~172줄, 770~779줄 | simpleHash, safeParseInt, toTimestamp, xmlGetText |
| `shared/keywords.ts` | 13~20줄, 154~157줄 | SEARCH_KEYWORDS, matchKeywords |

**index.ts 변경:**
```typescript
// 기존: 함수가 직접 정의됨
// 변경: import로 교체
import { fetchWithTimeout } from './shared/http-client.ts';
import { safeParseInt, toTimestamp, simpleHash, xmlGetText } from './shared/parsers.ts';
import { SEARCH_KEYWORDS, matchKeywords } from './shared/keywords.ts';
```

### Task 1-3: 검증

- [ ] `deno test index.test.ts` — 61개 테스트 전부 통과
- [ ] import 경로 확인 (Deno는 `.ts` 확장자 필수)

---

## Phase 2: 소스별 모듈 분리 (2~3일)

> 쉽게 말하면: "각 소스를 별도 방(파일)으로 이사시키자"

### 체크리스트

- [ ] `sources/kapt.ts` — fetchKaptBids 추출 (175~247줄)
- [ ] `sources/g2b.ts` — fetchG2bBids + fetchG2bResults 추출 (250~409줄)
- [ ] `sources/d2b.ts` — fetchD2bBids + fetchD2bResults 추출 (412~549줄)
- [ ] `sources/lofin.ts` — fetchLofinContracts 추출 (555~682줄)
- [ ] `sources/kwater.ts` — fetchKwaterBids 추출 (687~767줄)
- [ ] `sources/lh.ts` — fetchLhBids 추출 (785~887줄)
- [ ] `shared/db.ts` — upsert + linkResults 추출 (890~922줄, 985~1076줄)
- [ ] index.ts를 오케스트레이터로 축소 (~120줄)
- [ ] 기존 테스트 통과 확인

### Task 2-1: 소스 파일 공통 패턴

**각 소스 파일의 구조:**
```typescript
// sources/kapt.ts
import { fetchWithTimeout } from '../shared/http-client.ts';
import { safeParseInt, toTimestamp } from '../shared/parsers.ts';
import { matchKeywords, SEARCH_KEYWORDS } from '../shared/keywords.ts';
import type { NormalizedBid, FetchResult } from '../types.ts';

export async function fetchKaptBids(apiKey: string): Promise<FetchResult> {
  const bids: NormalizedBid[] = [];
  // ... 기존 175~247줄 로직을 여기로 이동
  // ... 단, Supabase upsert는 하지 않음! 데이터만 반환
  return { bids, results: [] };
}
```

**핵심 변경:** 각 소스 함수는 **데이터를 반환만** 하고, DB 저장은 오케스트레이터(index.ts)가 담당.

### Task 2-2: shared/db.ts

**추출 대상:**
- linkResultsToNotices() (890~922줄)
- upsert 로직 (985~1076줄의 반복 패턴)

```typescript
// shared/db.ts
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
): Promise<{ count: number; error?: string }> { ... }

export async function linkResultsToNotices(
  supabase: any,
  results: NormalizedResult[]
): Promise<void> { ... }  // 기존 890~922줄 로직

export async function updateDeadlineStatus(supabase: any): Promise<void> { ... }  // 1079~1084줄
export async function cleanupStaleData(supabase: any): Promise<void> { ... }      // 1086~1094줄
```

### Task 2-3: index.ts 오케스트레이터로 축소

**목표: ~120줄**

```typescript
// index.ts (축소 후)
import { createClient } from '@supabase/supabase-js';
import { PerfTracker } from './perf-tracker.ts';
import { fetchKaptBids } from './sources/kapt.ts';
import { fetchG2bBids, fetchG2bResults } from './sources/g2b.ts';
import { fetchD2bBids, fetchD2bResults } from './sources/d2b.ts';
import { fetchLofinContracts } from './sources/lofin.ts';
import { fetchKwaterBids } from './sources/kwater.ts';
import { fetchLhBids } from './sources/lh.ts';
import { upsertBids, upsertResults, linkResultsToNotices,
         updateDeadlineStatus, cleanupStaleData } from './shared/db.ts';

Deno.serve(async (req) => {
  // 인증 (기존 932~977줄 유지)
  // ...

  const tracker = new PerfTracker();
  const allBids = [];
  const allResults = [];

  // 소스별 수집 (현재는 순차, Phase 3에서 병렬화)
  const sources = [
    { name: 'kapt', fn: () => fetchKaptBids(DATA_GO_KR_API_KEY) },
    { name: 'g2b_bids', fn: () => fetchG2bBids(DATA_GO_KR_API_KEY) },
    { name: 'd2b_bids', fn: () => fetchD2bBids(DATA_GO_KR_API_KEY) },
    { name: 'g2b_results', fn: () => fetchG2bResults(DATA_GO_KR_API_KEY) },
    { name: 'lofin', fn: () => fetchLofinContracts(LOFIN365_API_KEY, supabase) },
    { name: 'd2b_results', fn: () => fetchD2bResults(DATA_GO_KR_API_KEY) },
    { name: 'kwater', fn: () => fetchKwaterBids(DATA_GO_KR_API_KEY) },
    { name: 'lh', fn: () => fetchLhBids(DATA_GO_KR_API_KEY) },
  ];

  for (const source of sources) {
    tracker.start(source.name);
    try {
      const result = await source.fn();
      allBids.push(...result.bids);
      allResults.push(...result.results);
      tracker.end(source.name, result.bids.length + result.results.length);
    } catch (e) {
      tracker.error(source.name, e.message);
    }
  }

  // DB 저장
  await upsertBids(supabase, allBids);
  await linkResultsToNotices(supabase, allResults);
  await upsertResults(supabase, allResults);
  await updateDeadlineStatus(supabase);
  await cleanupStaleData(supabase);

  // 후속 체이닝 (기존 유지)
  // ...

  return new Response(JSON.stringify({
    success: true,
    fetched: { /* 소스별 건수 */ },
    diagnostics: tracker.report(),
  }));
});
```

### Task 2-4: 검증

- [ ] `deno test index.test.ts` — 기존 61개 테스트 통과
- [ ] 수동 POST → 각 소스 정상 수집 확인
- [ ] diagnostics에 소스별 시간/건수/에러 확인
- [ ] fire-and-forget 체이닝 정상 작동 확인

---

## Phase 3: 병렬화 + 에러 보고 (2일)

> 쉽게 말하면: "줄 서서 1명씩 → 3명씩 동시에"

### 체크리스트

- [ ] index.ts의 순차 루프를 세마포어 병렬로 전환
- [ ] 소스별 성공/실패 상세 보고
- [ ] LOFIN의 8초 대기가 다른 소스를 막지 않도록 격리
- [ ] 병렬화 전후 diagnostics 비교

### Task 3-1: 세마포어 패턴 구현

**Files:**
- Modify: `supabase/functions/fetch-bids/index.ts`

**변경 전 (순차):**
```typescript
for (const source of sources) {
  const result = await source.fn();
  // ...
}
```

**변경 후 (3개씩 병렬):**
```typescript
// 간단한 세마포어 (외부 라이브러리 없이)
async function parallelWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map(fn => fn()));
    results.push(...batchResults);
  }
  return results;
}

// 사용
const tasks = sources.map(source => async () => {
  tracker.start(source.name);
  try {
    const result = await source.fn();
    tracker.end(source.name, result.bids.length + result.results.length);
    return { name: source.name, ...result };
  } catch (e) {
    tracker.error(source.name, e.message);
    return { name: source.name, bids: [], results: [] };
  }
});

const settled = await parallelWithLimit(tasks, 3);
```

### Task 3-2: 에러 상세 보고

**응답에 추가:**
```typescript
diagnostics: {
  totalDurationMs: 45000,
  sources: {
    kapt: { durationMs: 5200, items: 12, errors: [] },
    g2b_bids: { durationMs: 8100, items: 34, errors: [] },
    lofin: { durationMs: 12000, items: 8, errors: ["timeout on keyword '합성데크'"] },
    // ...
  },
  parallel: { batchSize: 3, totalBatches: 3 },
  memoryMB: 42.5
}
```

### Task 3-3: 검증

- [ ] 병렬화 전후 diagnostics.totalDurationMs 비교 (목표: 1/2~1/3 단축)
- [ ] 한 소스 실패 시 다른 소스 정상 수집 확인
- [ ] LOFIN 8초 대기가 같은 배치의 다른 소스에만 영향 (다음 배치는 대기 안 함)
- [ ] `deno test` 통과

---

## Phase 4: DB 안전장치 (1일)

> 쉽게 말하면: "현관 잠금장치를 튼튼하게"

### 체크리스트

- [ ] source CHECK constraint에 kwater, lh 추가 (즉시!)
- [ ] source 참조 테이블 마이그레이션 생성
- [ ] 변경 로그 테이블 추가
- [ ] 기존 RLS 정책 유지 확인

### Task 4-1: source constraint 수정 (긴급)

**Files:**
- Create: `supabase/migrations/2026XXXX_fix_source_constraint_v2.sql`

```sql
-- kwater, lh 추가
ALTER TABLE bid_notices DROP CONSTRAINT IF EXISTS bid_notices_source_check;
ALTER TABLE bid_notices ADD CONSTRAINT bid_notices_source_check
  CHECK (source IN ('g2b', 'kapt', 'alio', 'd2b', 'lofin', 'kwater', 'lh'));

ALTER TABLE bid_results DROP CONSTRAINT IF EXISTS bid_results_source_check;
ALTER TABLE bid_results ADD CONSTRAINT bid_results_source_check
  CHECK (source IN ('g2b', 'kapt', 'alio', 'd2b', 'lofin', 'kwater', 'lh'));
```

### Task 4-2: 참조 테이블 (선택)

```sql
-- 장기적으로 CHECK constraint 대신 참조 테이블 사용
CREATE TABLE IF NOT EXISTS bid_sources (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  api_base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO bid_sources (code, display_name) VALUES
  ('kapt', 'K-APT'), ('g2b', '나라장터'), ('d2b', '국방전자조달'),
  ('lofin', '지방재정365'), ('kwater', 'K-water'), ('lh', 'LH');
```

### Task 4-3: 변경 로그 테이블

```sql
CREATE TABLE IF NOT EXISTS bid_change_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,        -- 'bid_notices' or 'bid_results'
  record_id UUID,                  -- 변경된 레코드 ID
  source TEXT NOT NULL,
  bid_num TEXT NOT NULL,
  change_type TEXT NOT NULL,       -- 'insert', 'update', 'status_change'
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_change_log_source ON bid_change_log(source, changed_at);
```

### Task 4-4: 검증

- [ ] `supabase db push` 또는 `supabase migration up` 성공
- [ ] kwater, lh 소스 데이터 UPSERT 성공 확인
- [ ] 기존 데이터에 영향 없음 확인

---

## Phase 5: 데이터 검증 관문 (1일)

> 쉽게 말하면: "이상한 택배는 문 앞에서 돌려보내자"

### 체크리스트

- [ ] `shared/validator.ts` 생성
- [ ] 각 소스 모듈에서 정규화 후 검증 호출
- [ ] 검증 실패 건은 로그에 기록하고 DB 저장에서 제외

### Task 5-1: validator.ts

```typescript
// shared/validator.ts
import type { NormalizedBid } from '../types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBid(bid: NormalizedBid): ValidationResult {
  const errors: string[] = [];

  if (!bid.source) errors.push('source 누락');
  if (!bid.bid_num) errors.push('bid_num 누락');
  if (!bid.title || bid.title.trim() === '') errors.push('title 누락');
  if (bid.estimated_price !== null && bid.estimated_price < 0) {
    errors.push(`가격이 음수: ${bid.estimated_price}`);
  }
  if (bid.reg_date && isNaN(Date.parse(bid.reg_date))) {
    errors.push(`날짜 형식 오류: ${bid.reg_date}`);
  }
  if (bid.matched_keywords.length === 0) {
    errors.push('매칭 키워드 없음');
  }

  return { valid: errors.length === 0, errors };
}
```

### Task 5-2: 소스 모듈에 검증 적용

```typescript
// 각 소스 파일 끝에 추가
const validated = bids.filter(bid => {
  const result = validateBid(bid);
  if (!result.valid) {
    console.warn(`[${bid.source}] 검증 실패 (${bid.bid_num}): ${result.errors.join(', ')}`);
  }
  return result.valid;
});

return { bids: validated, results: [] };
```

### Task 5-3: 검증

- [ ] 정상 데이터는 통과, 비정상 데이터는 걸러짐
- [ ] 검증 실패 건이 diagnostics에 기록됨
- [ ] `deno test` 통과

---

## Phase 6: 측정 기반 추가 최적화 (지속)

> 쉽게 말하면: "계량기를 보고 다음 할 일을 결정하자"

### 체크리스트

- [ ] Phase 0~5 완료 후 diagnostics 데이터 수집 (최소 3일)
- [ ] 수집된 데이터로 판단:
  - 병렬 수 3 → 5로 올릴 수 있는지?
  - 어떤 소스가 가장 느린지?
  - 인위적 딜레이를 줄일 수 있는지?
  - Append-only 전환이 필요한 규모인지?

---

## 실행 순서 요약

```
Phase 0 (1~2일)  📊 측정 인프라     ← perf-tracker.ts 추가
    ↓
Phase 1 (1일)    📦 타입 + 유틸 분리  ← types.ts, shared/*.ts
    ↓
Phase 2 (2~3일)  🔀 소스별 분리      ← sources/*.ts, shared/db.ts
    ↓
Phase 3 (2일)    ⚡ 병렬화 + 에러    ← 세마포어, 상세 보고
    ↓
Phase 4 (1일)    🗄️ DB 안전장치     ← constraint, 참조테이블, 변경로그
    ↓
Phase 5 (1일)    🔒 데이터 검증      ← validator.ts
    ↓
Phase 6 (지속)   📈 측정 기반 개선   ← diagnostics 보고 판단
```

**총 예상 기간: 8~10일**

---

## Open Questions

1. Phase 4의 source constraint — 현재 kwater/lh 데이터가 실제로 유실되고 있는지 확인 필요 (constraint가 이미 수정되었을 수도 있음)
2. LOFIN의 pg_net RPC 함수가 분리된 파일에서도 호출 가능한지 Deno import 테스트 필요
3. fire-and-forget 체이닝을 pg_cron으로 전환할지는 Phase 6에서 측정 후 판단
