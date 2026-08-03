# 데크센터 홈페이지 → 시네마틱 합성목재(WPC) 제조사 경험 전환

## Context (왜 이걸 하나)

`gilded-drift`(르네상스×스트리트웨어 시네마틱 스크롤 필름)를 이번 세션에 새로 지었고, 사용자가 그 시네마틱 DNA를 **실제 라이브 사이트 데크센터(deckctr.com)**에 이식해 **합성목재(WPC) 제조사** 톤으로 리포지셔닝하려 한다.

- **왜 지금**: deckctr는 도메인 글로서리(§7.3)와 `DEC-732`에서 이미 "유통 전제로 시작 → 유통 안 함 → 재포지셔닝 필요"로 명시된 상태. 현재 홈페이지는 "견적 시뮬레이터 SaaS" 톤이라 제조사 정체성과 어긋난다.
- **의도한 결과**: 홈페이지를 gilded-drift식 시네마틱 WebGL 스크롤 경험(히어로 + 제조사 실콘텐츠 하이브리드)으로 바꾸고, 사이트 전역의 SaaS 프레이밍·가짜 연락처를 실제 데크센터 정체성으로 교체.
- **핵심 발견(리스크 완화)**: 원하는 스택(three/gsap/ScrollTrigger/lenis)이 **이미 설치·작동 중**이고 검증된 WebGL 아일랜드 패턴(`src/components/Hero3D.astro`)이 존재. 프레임워크 교체 불필요 — Astro(내부 Vite) 리포 안의 아일랜드로 구현.

## 확정된 결정 (Q&A)

1. **브랜드**: 데크센터(실제) — 제조사로 리포지셔닝. 실제 정체성/제품 카피/인증 사용.
2. **구성 깊이**: 시네마틱 히어로 + 제조사 콘텐츠 (하이브리드).
3. **기술·에셋**: 올로컬 WebGL(MOKRIM 패턴) — 절차적 CanvasTexture + 인씬/빌드타임 지오메트리, 원격 에셋 0. Astro 아일랜드로.
4. **대상**: 라이브 `main` 트리(= deckctr.com). 별개 `claude` 브랜치 redesign은 건드리지 않음.

## ⚠️ 착수 전 확인/결정 필요 (승인 시 함께 정함)

- **범위**: v1은 **홈페이지 전환 + 전역 프레이밍/정체성 수정**으로 한정(하위 페이지 full 시네마틱 아님). 이대로 OK인지.
- **`claude` 브랜치**: 7/1자 별개 제조사 redesign(wholesale/warranty/resources/products 페이지 포함, 미배포)이 존재. 이번 작업은 `main` 기준으로 하고 그 브랜치는 별도 트랙으로 둔다 — 통합 원하면 알려주기.
- **콘텐츠 미확정**(바이너리 PDF 안): 워런티 연수(사례 10년 vs FAQ 5년), 정밀 수치스펙(밀도/굴곡강도/색상명/표준길이), **난연/방염 WPC 인증 미확인** → 확정 전엔 플레이스홀더/보류 처리하고 검증된 것만 노출.
- **배포**: 이건 **라이브 사이트**. `main` push = Vercel 프로덕션 자동배포. 작업은 별도 브랜치/워크트리, **머지·배포는 명시 승인 전 금지**(Vercel preview까지만).

## 접근 (구현)

### 1. 격리된 작업공간 (라이브 안전)
- `main`(clean)에서 분기: `git worktree add ~/.peer-worktrees/deckctr/cinematic-home -b feat/cinematic-home` (현재 checkout 안 바꿈 — 워크트리 규칙).
- `main`·`claude` 트리 불변. Vercel preview(비-main push)로 확인, 프로덕션 머지는 승인 후.
- 빌드가 Supabase env(`PUBLIC_SUPABASE_*`)에 빌드타임 의존(`ValueProps`/`BidsGlimpse`) → env 유지 또는 해당 컴포넌트 대체 시 빌드 깨지지 않게.

### 2. 시네마틱 홈 아일랜드 (핵심 산출물)
- 신규 컴포넌트 `src/components/CinematicStage.astro`(+ 필요 시 `src/lib/cinematic-scene.ts`)로 gilded-drift의 3레이어 하이브리드 이식:
  - **뒤(WebGL, 투명/풀뷰포트 canvas)**: 절차적 WPC 재질(우드그레인 CanvasTexture — `Hero3D.astro`의 기법 재사용, WPC답게 옹이↓·균일 압출결↑) 위에 떠다니는 **실제 도메인 제품** = 데크 보드 모듈 / 펜스(난간) 패널 / 파고라(루버) 프레임(글로서리 §1 실존 구조물; cladding·planter는 미보유라 제외). 파티클·fog·bloom(가벼운 emissive/CSS)·마우스 패럴랙스.
  - **앞(DOM)**: 오버사이즈 제목 + 제조사 카피, GSAP ScrollTrigger reveal.
  - **오케스트레이션**: 이미 전역 구동 중인 Lenis + `src/lib/animations.ts`(ScrollTrigger 등록됨) 재사용. 카메라·챕터 전환을 스크롤에 바인딩.
- **라이프사이클 필수**(`Hero3D.astro` 그대로): plain module `<script>` 아일랜드, `astro:page-load` 재init, `astro:before-swap`에서 GPU 완전 dispose(WebGL 컨텍스트 누수 방지), 디바이스 티어 품질, DPR 캡, resize, **`prefers-reduced-motion` 정적 폴백**(Hero3D엔 없음 — 추가).

### 3. 스크롤 내러티브(제조사 스토리, 4~5막)
히어로(브랜드/제조 정체성) → 소재(WPC 왜: `composite.mdx` 실카피 재사용 — "목분+고분자수지, 썩거나 갈라지지 않아 반영구", 고밀도 캡형, colorfast, 논슬립) → 제품군(데크/펜스/파고라) → **품질·인증**(KS F 3230, 공인성적서, 환경표지, 혁신시제품/벤처/기업부설연구소 — trust 배지) → 문의 CTA. 실제 사례(WPC 케이스: 판교 카페·분당 베란다) 위빙.

### 4. 콘텐츠 리포지셔닝 (SaaS→제조사, 전역)
- 프레이밍 문자열: `src/components/Footer.astro`(L8–9), `src/layouts/BaseLayout.astro` title/desc(L14–15), `astro.config.mjs` PWA desc(L21) — 제조사 톤으로.
- 가짜 데이터 → 실제 데크센터 정체성: `contact.astro`(전화 010-1234-5678→**010-4118-0426**, 주소 강남 테헤란로123→**서울 송파구 위례광장로 199**, 이메일→**info@deckctr.com**, 사업자 **821-17-02572**, 대표 **김대훈**), `faq.astro`(전화 2곳), `about.astro`(가짜 통계 10,000+/5,000+ → 검증가능 표현으로).
- 홈 재구성: `src/pages/index.astro` L14 `<HeroStatement/>`를 `<CinematicStage/>`로 교체. 기존 죽은 컴포넌트(Features/TrustIndicators/HowItWorks/MaterialShowcase/Testimonial)는 무시/제거.

### 5. 하우스룰 준수(AGENTS.md, 하드)
strict TS 유지 · scoped CSS · **CSS 변수는 `BaseLayout.astro` :root에만** 추가(하드코딩 색상 금지, accent `--color-accent:#0d9488`) · 새 숫자변수 단위접미사(`Mm`/`Deg` 등) · 새 CSS 프레임워크 설치 금지(three/gsap/lenis는 기존 deps라 OK).

## 수정/생성 파일 (대표)
- 생성: `src/components/CinematicStage.astro`, (선택) `src/lib/cinematic-scene.ts`
- 수정: `src/pages/index.astro`(히어로 스왑/재구성), `src/layouts/BaseLayout.astro`(신규 토큰/메타), `Footer.astro`, `astro.config.mjs`(desc), `src/pages/{contact,faq,about}.astro`(정체성)
- 참조(재사용): `src/components/Hero3D.astro`(아일랜드 라이프사이클·절차적 우드), `src/lib/animations.ts`(GSAP), `src/content/products/composite.mdx`(실카피), MOKRIM `~/projects/renaissance-streetwear-world/src/main.ts`(4막 스크롤·절차적 재질·floating GLB 패턴)·`scripts/verify-render.mjs`(검증 하네스)

## 검증 (end-to-end)
1. **빌드 게이트**: `pnpm build`(=tsc strict + astro build) 통과. Supabase env 유지 or 의존 컴포넌트 대체. `verify-astro-style`/`verify-implementation` 스킬로 CSS변수·스키마 점검.
2. **런타임 검증**(gilded-drift에서 쓴 방식): `pnpm preview --host 0.0.0.0` → 로컬 playwright-core + chromium(`~/.cache/ms-playwright/chromium-1217`)로 헤드리스 로드. MOKRIM식 `window.__DECKCTR_READY__`/`__STATS__` 노출 후 어서트: **canvas non-blank**, 스크롤 분할점마다 올바른 막 활성, 데스크톱+모바일 **가로 오버플로 0**, reduced-motion 폴백 렌더, 콘솔 에러 0. 각 막 스크린샷 캡처해 육안 확인.
3. **맥 열람**: tailnet URL `http://100.66.78.98:<port>/`로 preview 서빙(0.0.0.0), 사용자가 맥에서 확인.
4. **배포 안전**: `main` 미변경 확인. 배포는 사용자 승인 후 브랜치 push(Vercel preview) → 승인 시 머지.

## 승인 후 첫 스텝
이 스크래치 플랜을 보이는 위치로 이관: `~/projects/outdoor/deckctr/docs/plans/2026-07-05-cinematic-manufacturer-home/plan.md` (+ `_status.open.md`). 그 후 워크트리 생성부터 실행.
