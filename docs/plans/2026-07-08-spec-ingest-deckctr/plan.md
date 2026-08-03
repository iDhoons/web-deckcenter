# 성적서 구조화 적재 — 기존 spec 파이프라인을 deckctr에 가동

> 실행 분담: **구현 = Codex** (코드+테스트만, DB 접근 불가 환경) / **DB 적재·검증 = Claude 로컬**.
> 승인 시 이 플랜을 `docs/plans/2026-07-08-spec-ingest-deckctr/plan.md`(+`_status.open.md`)로 저장 후 Codex에 그 경로를 명시해 위임한다 (지난 /cxb가 stale 컨텍스트로 다른 작업을 구현한 사고 재발 방지).

## Context

파싱 품질 감사(2026-07-08)로 확인된 문제: 폴리우드 성적서의 미끄럼저항성 **C.S.R 0.41**이 코퍼스에 있는데 파이프 표 덤프라 검색이 값을 못 끌어옴. 해법은 재파싱 신규 개발이 아니라 **이미 완성된 spec 파이프라인 가동**:

- `scripts/ingest-spec.ts` — MinerU 산출물 → `extractResults`(표 HTML 파싱) → KS F 3230 기준 join(`resolveCriterion`) → 판정(`judgeSpecResult`) → `spec_documents`/`spec_attributes` 적재. **`--replace` 멱등 재적재와 `documents` 임베딩 문장 노출(`buildSpecAttributeSentence`)까지 내장.**
- `src/app/api/chat/route.ts:418~` — spec_inquiry 인텐트가 `buildSpecAnswer(tenant.id, message)`로 이 데이터를 소비 (경로 완비).
- 과거 테스트 테넌트 실증: 같은 성적서에서 속성 23건 추출 성공. **그러나 deckctr의 spec_attributes = 0건** — 실제 테넌트에 안 돌린 상태.

**남은 갭 (Codex 구현 대상)**: MinerU 전체 산출물(content_list.json)이 있는 성적서는 1건뿐. 나머지 ~14건은 `scripts/rag-lab/results/ocr/*.md`(OCR 마크다운, 파이프 표)만 있음 → **md 표 → SpecTableBlock 어댑터**가 있으면 재-OCR 없이 전부 적재 가능.

**사용자 결정(2026-07-08)**: 제품 타입 = **S(솔리드형)** 기본. 폴리우드(자사) 성적서 우선, 타사(성미테크우드 등)는 보류.

## Phase A — Codex 구현 (코드+테스트만, DB/네트워크 없음)

### A-1. md 표 어댑터 (신규 `src/lib/spec/extract-md.ts`)
- `parseMarkdownTablesToBlocks(mdText: string): SpecTableBlock[]` — 마크다운 파이프 표(`| 시험항목 | 단위 | ... |`)를 최소 `<table><tr><td>` HTML로 변환해 `SpecTableBlock{html, pageIdx, bbox}` 배열 반환. pageIdx는 md 내 표 순번, bbox는 `[0,0,0,0]`.
- **기존 `extractResults`/`matchDef`(extract.ts)는 무수정 재사용** — 어댑터는 입력 변환만. 헤더 행(`|---|`) 스킵, 셀 내 `<br>`·공백 정리는 extract.ts의 `stripTags` 관례를 따름.
- TDD: `src/lib/spec/extract-md.test.ts` — 픽스처는 실제 `scripts/rag-lab/results/ocr/공인성적서_합성수지데크(3230외)_폴리우드.md`의 표 발췌를 `__fixtures__/`에 저장해 사용. 기대값: 미끄럼저항성 C.S.R **0.41**, 나사못유지력 **986** 추출. 정성 결과("불검출")는 result_value=null·confidence 0.5 (기존 규칙).

### A-2. `scripts/ingest-spec.ts`에 `--markdown-only` 모드
- `--content-list` 없이 `--markdown`만 주면 A-1 어댑터로 blocks 생성. MinerU 경로(기존 기본)는 무변경.
- 기존 플래그(`--tenant`, `--type`, `--standard`, `--title`, `--replace`) 그대로 동작.

### A-3. 배치 매니페스트 러너 (신규 `scripts/ingest-spec-batch.ts` + `scripts/spec-manifest.deckctr.json`)
- 매니페스트 항목: `{ file, title, type, standard?, company, enabled }`. 초안은 `scripts/rag-lab/results/ocr/` 중 **폴리우드 성적서만 enabled=true**(파일명·내용에 폴리우드/SDF025/SDP025), 성미테크우드 등 타사는 enabled=false로 나열만.
- 러너는 매니페스트를 읽어 항목별로 ingest-spec 로직 호출(`--markdown-only`, `--replace`). `--dry-run`이면 추출 결과 요약만 출력하고 DB 미접근.
- 기본 type=S (사용자 확정), 항목별 override 가능.

### A-4. 품질 게이트
- `pnpm typecheck && pnpm lint && pnpm test:unit` 통과. 테스트는 픽스처 기반 — **DB·네트워크·Docker 불필요하게 작성**.

### Codex 금지사항 (스코프 가드 — 위임 브리프에 그대로 포함)
- `docs/content/*`(FAQ 사실 — 특히 **창립연도 2023 절대 변경 금지**), golden set 관련 코드/데이터, `src/lib/ai/*`, `scripts/archive-explorer.ts`, `.env*` 일체 수정 금지.
- DB mutation·마이그레이션·eval 실행 금지 (환경상 불가하기도 함). 수정 파일은 A-1~A-3에 명시된 것만.

## Phase B — Claude 로컬 실행·검증 (Codex 수확 후)

1. **수확 검증**: diff 리뷰(스코프 가드 준수 확인) → typecheck/lint/test:unit 재실행.
2. **파일럿 적재**: 기존 MinerU 산출물로
   `pnpm tsx --env-file=.env.local scripts/ingest-spec.ts --tenant deckctr --type S --content-list .claude-tmp/spec-ingest/out/polywood-ksf3230/ocr/polywood-ksf3230_content_list.json --markdown .claude-tmp/.../polywood-ksf3230.md --title "공인성적서 합성수지데크(KS F 3230) 폴리우드" --replace`
   (env prefix `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` — loopback 함정). 기대: 속성 ~23건.
3. **md-only 배치**: `ingest-spec-batch.ts --dry-run`으로 추출 요약 확인 → 사용자에게 매니페스트(어느 파일이 자사인지) 확인 → 실행.
4. **E2E 검증 (성공 기준)**:
   - psql: `spec_attributes`에 미끄럼저항 0.41 존재.
   - 아카이브 익스플로러(8948) "폴리우드 성적서 미끄럼 저항성 값" → **0.41을 근거와 함께 답변** (ingest가 documents에 임베딩 문장을 넣으므로 하이브리드 검색에 노출됨).
   - 챗봇 spec_inquiry: dev 서버에 "폴리우드 미끄럼저항성 시험결과" curl → 값+판정 응답.
5. (선택, 별도 승인) 골든 재측정 및 오제외 7청크 원복.

## 리스크

- OCR md 표가 문서마다 형태 편차(셀 분리 깨짐) → 어댑터가 못 잡는 파일은 unmatched로 리포트되고 dry-run에서 드러남. 억지 복구 금지 — 실패 파일은 원본 PDF 재-MinerU(doc2md --mineru) 후속 트랙으로.
- 타입 S 일괄 선언이 틀린 제품이 있을 수 있음 → 판정(합불)에만 영향, 측정값 자체는 무관. 매니페스트에서 파일별 override.
- 내후성 성적서는 KS F 3230 기준이 아닐 수 있음 → `--standard` override, resolveCriterion 미매칭 시 기준 없음으로 적재(기존 동작).
