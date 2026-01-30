# UI 가이드라인 검토 - 완료

## 수정 완료된 항목

### BaseLayout.astro
- [x] `color-scheme` 메타 태그 추가
- [x] `theme-color` 메타 태그 추가 (라이트/다크)
- [x] `prefers-reduced-motion` 글로벌 CSS 추가
- [x] 제목 `text-wrap: balance` 추가

### Hero.astro
- [x] SVG에 `aria-hidden="true"` 추가
- [x] SVG에 `focusable="false"` 추가

### Hero3D.astro
- [x] 컨테이너에 `role="img"` 및 `aria-label` 추가
- [x] 로딩 상태에 `aria-live="polite"` 추가
- [x] 로딩 상태에 `aria-busy` 동적 업데이트
- [x] 스크린 리더용 로딩 텍스트 추가
- [x] `.sr-only` 클래스 추가

### index.astro
- [x] CTA 버튼 SVG에 `aria-hidden="true"` 추가
- [x] GSAP 애니메이션에 `prefersReducedMotion` 체크 추가

## 빌드 결과
✅ 빌드 성공

## 검증 방법
1. `pnpm dev` → http://localhost:4323
2. DevTools → Rendering → Emulate prefers-reduced-motion
3. 키보드 네비게이션 테스트
4. Lighthouse 접근성 점수 확인
