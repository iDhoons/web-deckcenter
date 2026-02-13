# Deckctr (데크센터)

데크센터(Deckctr) B2B/B2C 데크 자재 공급업체 마케팅 웹사이트입니다.

## Stack

- Astro 5.16
- TypeScript (strict)
- MDX 콘텐츠 컬렉션
- Scoped CSS + Tailwind 유틸리티 클래스
- pnpm

## Commands

```bash
pnpm dev      # 개발 서버 (localhost:4321)
pnpm build    # 프로덕션 빌드 (./dist/)
pnpm preview  # 빌드 미리보기
```

## Project Structure

```
src/
  components/  # UI 컴포넌트
  content/     # MDX 콘텐츠 컬렉션 (products, cases, blog)
  layouts/     # BaseLayout
  lib/         # 외부 서비스 클라이언트 (Supabase)
  pages/       # 라우팅 페이지
  styles/      # 전역 스타일 (tailwind import)
```

## Content Collections

스키마는 `src/content/config.ts`에서 관리합니다.

- `products`: 제품 정보
- `cases`: 시공 사례
- `blog`: 블로그 포스트

## Environment

Supabase 연결에 아래 환경 변수가 필요합니다.

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

## References

운영 규칙과 컨텍스트는 `AGENTS.md`, 세부 가이드는 `CLAUDE.md`를 참고합니다.
