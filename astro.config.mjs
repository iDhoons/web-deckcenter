// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import AstroPWA from '@vite-pwa/astro';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.deckctr.com',

  integrations: [
    sitemap(),
    mdx(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '데크센터',
        short_name: '데크센터',
        description: '데크 시공 입찰 정보 · 견적 시뮬레이터 · 소재 가이드',
        theme_color: '#0d9488',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'ko',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/api/, /^\/functions/],
        runtimeCaching: [
          {
            // 정적 페이지 — cache-first (빌드 시 생성된 HTML)
            urlPattern: /^https:\/\/www\.deckctr\.com\/(?!bids).*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7일
              },
            },
          },
          {
            // /bids 페이지 — network-first (데이터가 자주 변경)
            urlPattern: /^https:\/\/www\.deckctr\.com\/bids/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bids-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60, // 24시간
              },
              networkTimeoutSeconds: 3,
            },
          },
          {
            // CDN 폰트
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
              },
            },
          },
          {
            // 이미지
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
              },
            },
          },
        ],
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
