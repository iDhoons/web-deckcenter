# AGENTS.md

이 파일은 AI 에이전트가 데크센터 프로젝트 작업 시 따라야 할 규칙과 컨텍스트를 정의합니다.

## Project Context

데크센터(Deckctr) - B2B/B2C 데크 자재 공급업체 마케팅 웹사이트

- Site: https://www.deckctr.com
- Stack: Astro 5.16, TypeScript (strict), MDX, Scoped CSS
- Package Manager: pnpm
- No frameworks: Tailwind, React, Vue 미사용

## Operational Commands

```bash
pnpm dev          # 개발 서버 (localhost:4321)
pnpm build        # 프로덕션 빌드 (./dist/)
pnpm preview      # 빌드 미리보기
```

빌드 검증은 `pnpm build` 성공 여부로 판단합니다.

## Golden Rules

### Immutable (절대 변경 금지)

- TypeScript strict 모드 유지
- Scoped CSS 원칙 유지 (Tailwind 도입 금지)
- CSS 변수는 BaseLayout.astro에서만 정의
- 콘텐츠 컬렉션 스키마 변경 시 기존 MDX 파일 호환성 필수 확인

### Do's

- 컴포넌트 Props는 interface로 타입 정의
- 새 CSS 변수 필요 시 BaseLayout.astro의 :root에 추가
- 다크모드 지원: :global([data-theme="dark"]) 선택자 사용
- 이미지는 loading="lazy" 적용 (Hero 제외)
- 외부 링크는 target="_blank" rel="noopener noreferrer" 필수
- 동적 라우트 페이지는 getStaticPaths() 필수 구현

### Don'ts

- 인라인 스타일 사용 금지 (scoped CSS 또는 CSS 변수 사용)
- 하드코딩된 색상값 금지 (var(--color-*) 사용)
- 컴포넌트 내 글로벌 CSS 정의 금지 (:global() 최소화)
- MDX frontmatter에 스키마 미정의 필드 추가 금지
- 외부 CSS 프레임워크/라이브러리 설치 금지

## Architecture Overview

```
src/
├── components/     # Header, Footer, Hero, Section, Card, CTA, Testimonial, ChatButton, Splash
├── layouts/        # 페이지 레이아웃 (BaseLayout만 존재)
├── pages/          # 파일 기반 라우팅
│   ├── [slug].astro    # 동적 라우트
│   └── *.astro         # 정적 페이지
└── content/        # MDX 콘텐츠 컬렉션
    ├── config.ts       # Zod 스키마 정의
    ├── products/       # 제품 (4개)
    ├── cases/          # 시공사례 (8개)
    └── blog/           # 블로그 (15개+)
```

## Context Map

- **[콘텐츠 추가](./src/content/)** - MDX 작성, 스키마는 config.ts 참조
- **[새 페이지](./src/pages/)** - 정적/동적 라우트, BaseLayout 사용 필수
- **[컴포넌트 수정](./src/components/)** - Props interface 정의, scoped CSS
- **[전역 스타일/CSS 변수](./src/layouts/BaseLayout.astro)** - :root 및 [data-theme="dark"]
- **[스키마 변경](./src/content/config.ts)** - Zod 스키마, 기존 MDX 호환성 확인

## Implementation Patterns

### 1. 콘텐츠 스키마

Products:
```typescript
{
  title: string,
  excerpt: string,
  cover: string,          // URL 또는 /images/ 경로
  features: string[],
  applications: string[],
  maintenance: string,
  ctaText: string
}
```

Cases:
```typescript
{
  title: string,
  excerpt: string,
  cover: string,
  location: string,
  area: string,
  material: string,
  duration: string,
  date: Date,             // YYYY-MM-DD 형식
  gallery?: string[]
}
```

Blog:
```typescript
{
  title: string,
  excerpt: string,
  cover: string,
  date: Date,
  tags: string[],         // '소재비교', '가이드' 태그는 홈페이지에 노출
  author: string
}
```

### 2. 컴포넌트 작성 패턴

```astro
---
interface Props {
  title: string;
  description?: string;
  variant?: 'primary' | 'secondary';
}

const { title, description, variant = 'primary' } = Astro.props;
---

<div class="component">
  <h2>{title}</h2>
  {description && <p>{description}</p>}
</div>

<style>
  .component {
    color: var(--color-primary);
    padding: var(--spacing-lg);
  }

  :global([data-theme="dark"]) .component {
    background: var(--color-bg-alt);
  }
</style>
```

### 3. 동적 라우트 패턴

```astro
---
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const items = await getCollection('collectionName');
  return items.map((item) => ({
    params: { slug: item.slug },
    props: { item },
  }));
}

interface Props {
  item: CollectionEntry<'collectionName'>;
}

const { item } = Astro.props;
const { Content } = await item.render();
---
```

### 4. CSS 변수 (BaseLayout.astro)

Colors (Light / Dark):
- --color-primary: #1a1a1a / #f5f5f5
- --color-accent: #004250 / #00a3cc
- --color-text: #333333 / #e5e5e5
- --color-bg: #ffffff / #0f0f0f
- --color-bg-alt: #F8FAFB / #1a1a1a

Spacing:
- --spacing-xs: 0.25rem
- --spacing-sm: 0.5rem
- --spacing-md: 1rem
- --spacing-lg: 1.5rem
- --spacing-xl: 2rem
- --spacing-2xl: 3rem
- --spacing-3xl: 4rem

Shadows:
- --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl

Typography:
- --font-size-xs(0.75rem) ~ --font-size-5xl(3.5rem)

Z-index:
- --z-base: 1
- --z-dropdown: 100
- --z-sticky: 1000
- --z-modal: 2000
- --z-splash: 10000

Layout:
- --max-width: 1200px

Breakpoints (참조용):
- 480px: Small mobile
- 640px: Mobile landscape
- 768px: Tablet (주요)
- 1024px: Desktop
- 1280px: Large desktop

## Standards & References

### 파일 네이밍

- 컴포넌트: PascalCase.astro (Hero.astro, Card.astro)
- 페이지: kebab-case.astro 또는 [slug].astro
- 콘텐츠: kebab-case.mdx (compare-materials.mdx)

### Git 커밋 메시지

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 스타일/UI 변경
refactor: 코드 리팩토링
content: 콘텐츠(MDX) 추가/수정
```

### 외부 연동

- 견적 계산기: https://calc.deckctr.com (CTA 링크 대상)
- Sitemap/RSS: @astrojs/sitemap, @astrojs/rss 자동 생성

## Maintenance Policy

1. 이 파일의 규칙과 실제 코드가 불일치하면 즉시 업데이트를 제안하라
2. 새로운 패턴이 3회 이상 반복되면 이 파일에 문서화를 제안하라
3. 스키마 변경 시 기존 MDX 마이그레이션 계획을 함께 제시하라
