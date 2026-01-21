# CLAUDE.md

> AI 에이전트 상세 규칙은 [AGENTS.md](./AGENTS.md)를 참조하세요.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Styling:** Scoped CSS with CSS variables (no external framework)
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
- `contact.astro` - Contact form
- `faq.astro` - FAQ
- `resources.astro` - Resources
- `warranty.astro` - Warranty information
- `wholesale.astro` - Wholesale inquiries
- `guides.astro` - Guides listing

**Dynamic routes:**
- `products/index.astro`, `products/[slug].astro` - Product listing & detail
- `cases/index.astro`, `cases/[slug].astro` - Case study listing & detail
- `blog/index.astro`, `blog/[slug].astro` - Blog listing & detail

**SEO:** `/robots.txt.ts`, `/rss.xml.js` auto-generated

### Components

**Layouts** (`/src/layouts/`):
- **BaseLayout** - Master layout with Header/Footer, global CSS variables, OG meta, theme toggle

**Components** (`/src/components/`):
- **Header** - Global navigation with mobile menu, theme toggle
- **Footer** - Global footer with links and contact info
- **Hero** - Full-width hero with video/image support, scroll-triggered animation
- **Section** - Container wrapper with title/description
- **Card** - Product/case display cards
- **CTA** - Call-to-action buttons (primary/secondary variants)
- **Testimonial** - Customer testimonial display
- **ChatButton** - Floating chat widget button
- **Splash** - Initial splash screen animation

### CSS Variables

Defined in `BaseLayout.astro`:

**Colors (Light theme):**
- `--color-accent: #004250` (primary teal)
- `--color-accent-light: #005a6e`
- `--color-primary: #1a1a1a`
- `--color-text: #333333`
- `--color-bg: #ffffff`

**Colors (Dark theme):**
- `--color-accent: #00a3cc` (bright cyan)
- `--color-accent-light: #00c4f0`
- `--color-bg: #0f0f0f`

**Layout:**
- `--max-width: 1200px`

**Responsive breakpoints:** 1440px, 1280px, 1024px, 768px, 640px, 480px

**Design tokens:** Spacing scale (xs~3xl), Shadow scale (sm~xl), Z-index scale, Typography scale (xs~5xl)

## Adding Content

**New product:** Create `/src/content/products/product-name.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `features[]`, `applications[]`, `maintenance`, `ctaText`

**New blog post:** Create `/src/content/blog/post-slug.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `date`, `tags[]`, `author`
- Posts with tags '소재비교' or '가이드' appear on homepage.

**New case study:** Create `/src/content/cases/case-name.mdx` with frontmatter:
- Required: `title`, `excerpt`, `cover`, `location`, `area`, `material`, `duration`, `date`
- Optional: `gallery[]`

## External Integrations

- **Estimate Calculator:** https://calc.deckctr.com (linked from CTAs)
- **Sitemap:** Auto-generated via `@astrojs/sitemap`
- **RSS Feed:** Auto-generated via `@astrojs/rss`
- **Smooth Scroll:** Lenis library (reinitialized on view transitions)
- **Font CDN:** Paperlogy via `https://cdn.jsdelivr.net/gh/niceplugin/Paperlogy/Paperlogy.css`
