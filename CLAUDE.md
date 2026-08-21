# CLAUDE.md

@AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@~/projects/products/outdoor/_shared-context/outdoor-structures.md

## Project Overview

데크센터(Deckctr) - A Korean B2B/B2C marketing website for deck material suppliers. Built with Astro 5 static site generator.

**Site URL:** https://www.deckctr.com

## Development Commands

```bash
pnpm dev       # Start dev server at localhost:4321
pnpm build     # Build production site to ./dist/
pnpm preview   # Preview production build locally
```

## Architecture

### Tech Stack
- **Framework:** Astro 5.16 with TypeScript (strict mode)
- **Content:** MDX with Zod-validated content collections
- **Styling:** Scoped CSS with CSS variables + Tailwind CSS utilities (imported in `src/styles/global.css`)
- **Font:** Paperlogy (Korean) via CDN
- **Smooth Scroll:** Lenis library
- **Transitions:** Astro View Transitions

### Content Collections

Content is managed through Astro's content collections in `/src/content/`:

| Collection | Schema Location | Content Path |
|------------|-----------------|--------------|
| products | `config.ts` | `/src/content/products/*.mdx` |
| cases | `config.ts` | `/src/content/cases/*.mdx` |
| blog | `config.ts` | `/src/content/blog/*.mdx` |

Each collection has a Zod schema in `/src/content/config.ts` defining required frontmatter fields.

### Routing

File-based routing in `/src/pages/`:

**Static pages:**
- `index.astro` - Homepage
- `about.astro` - About page
- `app.astro` - App landing
- `features.astro` - Features
- `pricing.astro` - Pricing
- `gallery.astro` - Gallery
- `faq.astro` - FAQ
- `contact.astro` - Contact form
- `bids/index.astro` - Bids dashboard (Supabase)

**Dynamic routes:**
- `blog/index.astro`, `blog/[slug].astro` - Blog listing & detail

**SEO:** `robots.txt.ts`, `rss.xml.js` auto-generated

### Components

**Layouts** (`/src/layouts/`):
- **BaseLayout** - Master layout with Header/Footer, global CSS variables, OG meta, theme toggle

**Components** (`/src/components/`):
- **Header** - Global navigation with mobile menu, theme toggle
- **Footer** - Global footer with links and contact info
- **Hero** - Homepage hero
- **Hero3D** - 3D hero section
- **TrustIndicators** - Stats row
- **Features**, **HowItWorks**, **MaterialShowcase**, **Pricing** - Homepage sections
- **Section**, **Card**, **CTA**, **Testimonial** - Reusable UI
- **ChatButton** - Floating chat widget button
- **Splash** - Initial splash screen animation
- **Skeleton** - Loading placeholder

### CSS Variables

Defined in `BaseLayout.astro`:

**Colors (Light theme):**
- `--color-accent: #0d9488` (premium teal)
- `--color-accent-light: #14b8a6`
- `--color-primary: #0f1419`
- `--color-text: #1a1a1a`
- `--color-bg: #fafafa`

**Colors (Dark theme):**
- `--color-accent: #2dd4bf`
- `--color-accent-light: #5eead4`
- `--color-bg: #0c0a09`

**Layout:**
- `--max-width: 1200px`

**Design tokens:** Warm stone background system, spacing scale (xs~3xl), shadow scale (sm~xl), z-index scale, typography scale (xs~5xl)

## Adding Content

**New product:** Create `/src/content/products/product-name.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `features[]`, `applications[]`, `maintenance`, `ctaText`

**New blog post:** Create `/src/content/blog/post-slug.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `date`, `tags[]`, `author`
- Posts with tags '소재비교' or '가이드' appear on homepage.

**New case study:** Create `/src/content/cases/case-name.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `location`, `area`, `material`, `duration`, `date`
- Optional: `gallery[]`

## Skills

| 스킬 | 설명 | 트리거 |
| ---- | ---- | ------ |
| `verify-astro-style` | CSS 변수 사용, 하드코딩 색상 금지, scoped 스타일 준수 | `.astro` 파일 수정 후 |
| `verify-content-schema` | MDX frontmatter 필수 필드 완전성 검증 | `src/content/**/*.mdx` 수정 후 |
| `verify-edge-functions` | CORS, env null 체크, try/catch, 시크릿 금지 | `supabase/functions/` 수정 후 |
| `verify-implementation` | 위 3개 스킬 순차 실행 (통합 검증) | PR 전 |
| `manage-skills` | verify 스킬 드리프트 탐지 및 업데이트 | 새 패턴 도입 후 |

## 코드 규약 (단위 접미사)

JS/TS 숫자 변수는 단위 접미사를 붙인다 (`Mm`/`M2`/`Pyeong`/`Krw`/`Deg`/`Pct` 등). 전체 표·정의는 `_shared-context/outdoor-structures.md §4.5` (위 @import로 자동 로드). **신규 코드부터 적용**, 기존 코드 전면 변환은 별도(DEC-730).

## External Integrations

- **Estimate Calculator:** https://calc.deckctr.com (linked from CTAs)
- **Sitemap:** Auto-generated via `@astrojs/sitemap`
- **RSS Feed:** Auto-generated via `@astrojs/rss`
- **Smooth Scroll:** Lenis library (reinitialized on view transitions)
- **Font CDN:** Paperlogy via `https://cdn.jsdelivr.net/gh/niceplugin/Paperlogy/Paperlogy.css`

## Operations

| 항목 | 내용 |
|------|------|
| 배포 | Vercel (자동 배포, PWA + 정적 생성) |
| DB | Supabase (입찰 데이터 수집) |
| 모니터링 | PostHog |
| 패키지 | pnpm 9.15.4 |
| 환경변수 | `.env.local` (SUPABASE_URL, ANON_KEY, DATA_GO_KR_API_KEY, FETCH_BIDS_SECRET) |
| 사이트 | https://www.deckctr.com |

### 알려진 이슈

- `/src/pages/app.astro` Line 83: 이메일 수집 로직 미구현
- B2B/도매 페이지 미생성
- 입찰 수집 안정성 개선 진행 중 (N+1 제거, 해시 ID, 에러 로깅)
