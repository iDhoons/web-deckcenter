# CLAUDE.md

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
- **Font:** Pretendard (Korean) via CDN

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
- Static pages: `about.astro`, `guides.astro`
- Dynamic routes: `[slug].astro` files use `getStaticPaths()` for pre-rendering
- SEO: `/robots.txt.ts`, `/rss.xml.js` auto-generated

### Components

Located in `/src/components/`:
- **BaseLayout** (`/src/layouts/`) - Master layout with Header/Footer, global CSS variables, OG meta
- **Hero** - Full-width hero with video/image support, scroll-triggered animation
- **Section** - Container wrapper with title/description
- **Card** - Product/case display cards
- **CTA** - Call-to-action buttons (primary/secondary variants)

### CSS Variables

Defined in `BaseLayout.astro`:
- `--color-accent: #8B5A2B` (primary brown/wood tone)
- `--max-width: 1200px`
- Responsive breakpoint: `768px`

## Adding Content

**New product:** Create `/src/content/products/product-name.mdx` with frontmatter (title, excerpt, cover, features[], applications[], maintenance, ctaText)

**New blog post:** Create `/src/content/blog/post-slug.mdx` with frontmatter (title, excerpt, cover, date, tags[], author). Posts with tags '소재비교' or '가이드' appear on homepage.

**New case study:** Create `/src/content/cases/case-name.mdx` with frontmatter (title, excerpt, cover, location, area, material, duration, gallery[])

## External Integrations

- **Estimate Calculator:** https://calc.deckctr.com (linked from CTAs)
- **Sitemap:** Auto-generated via `@astrojs/sitemap`
- **RSS Feed:** Auto-generated via `@astrojs/rss`
