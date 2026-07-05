# 데크센터 홈 → 시네마틱 합성목재(WPC) 제조사 경험

**브랜치**: `feat/cinematic-home` (워크트리 `~/.peer-worktrees/deckctr/cinematic-home`) · **상태**: 구현 완료, 리뷰/배포 대기 · **날짜**: 2026-07-05

## Context
현재 라이브 홈(`deckctr.com`)은 "견적 시뮬레이터 SaaS" 톤이라 제조사 정체성과 어긋난다(도메인 글로서리 §7.3 / `DEC-732`가 재포지셔닝 명시). 이번 세션에 만든 시네마틱 스크롤 필름(`gilded-drift`)의 DNA를, **이미 설치돼 있던** three/gsap/lenis + 작동 WebGL 아일랜드 패턴(`Hero3D.astro`)을 활용해 Astro 리포 안 아일랜드로 이식했다. 프레임워크 교체 없음.

## 무엇을 했나
- **홈 전면 교체**: `index.astro`가 `HeroStatement`(견적 시뮬레이터 히어로) 대신 신규 `CinematicStage`를 렌더. 5막 스크롤 내러티브: 소개(제조 정체성) → 소재(WPC 왜) → 제품(데크/펜스/파고라) → 품질(KS F 3230·공인성적서·환경표지·혁신시제품) → 문의 CTA.
- **올로컬 WebGL**(원격 에셋 0): sticky 풀뷰포트 canvas 위로 막이 스크롤. 절차적 WPC 우드그레인 CanvasTexture + 절차적 지오메트리(데크 모듈/펜스 패널/파고라 루버/컬러웨이 3종). 라이트 프리미엄 스튜디오 룩(브랜드 teal accent). 스크롤 바인딩 카메라·막별 제품 페이드·마우스 패럴랙스.
- **콘텐츠 리포지셔닝**(SaaS→제조사): Footer 태그라인, PWA 설명, BaseLayout title/desc, 그리고 **가짜 정체성→실제 데크센터**(전화 010-4118-0426, info@deckctr.com, 서울 송파구 위례광장로 199), about 가짜 SaaS 통계(10,000+ 설계/5,000+ 사용자)→검증가능 표현(KS F 3230·자재 3종).
- **부수 버그 수정**: Header 모바일 메뉴(`position:fixed`)가 데스크톱에서 화면 밖에 남아 발생하던 사이트 전역 가로 오버플로 305px → `.mobile-menu`에 `md:hidden` + `html { overflow-x: clip }`.

## 생성/수정 파일
- 신규: `src/lib/cinematic-scene.ts`(Three.js 씬 컨트롤러, TS strict), `src/components/CinematicStage.astro`(DOM 5막 + scoped CSS + 라이프사이클/ScrollTrigger 배선)
- 수정: `src/pages/index.astro`, `src/layouts/BaseLayout.astro`(title/desc + overflow guard), `src/components/{Footer,Header}.astro`, `astro.config.mjs`, `src/pages/{contact,faq,about}.astro`

## 하우스룰 준수(AGENTS.md)
strict TS · scoped CSS · CSS 변수는 BaseLayout에만 · 하드코딩 색상 없음(전부 `var(--color-*)`) · 새 CSS 프레임워크 미설치(기존 three/gsap/lenis 사용) · `Hero3D.astro` 라이프사이클(astro:before-swap dispose) · reduced-motion 정적 폴백 · 디바이스 티어 품질.

## 검증(완료)
- **빌드 게이트**: `pnpm build` 18페이지 성공(placeholder Supabase env로 로컬 게이트 — 실제 env는 Vercel). 홈 index.html 생성.
- **런타임(dev+prod preview)**: 헤드리스 chromium(swiftshader). `__DECKCTR_READY__`=true, WebGL 렌더, 6제품, 막 전환 0→4 정확, **가로 오버플로 0**, 콘솔 에러 0. 5막 스크린샷 육안 확인(제품 스왑·인증 배지·컬러웨이·가독성 OK).

## 미확정 / 후속(사용자 확인 필요)
- 워런티 연수(사례 10년 vs FAQ 5년), 정밀 수치스펙(밀도/굴곡강도/색상명), **난연/방염 WPC 인증**은 미검증이라 노출 안 함.
- 하위 페이지(simulator/features/app/about 본문/bids)의 SaaS 프레이밍은 v1 범위 밖(시뮬레이터=calc.deckctr.com 실제 도구라 제거 아님). 별도 콘텐츠 패스.
- `claude` 브랜치의 별개 제조사 redesign은 미접촉(별도 트랙).

## 배포 안전
`main` 미변경. **머지·배포는 사용자 승인 후**(비-main push → Vercel preview → 승인 시 머지). `.env`(placeholder)는 gitignored, 커밋 제외.
