import { defineCollection, z } from 'astro:content';

const products = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    cover: z.string(),
    features: z.array(z.string()),
    applications: z.array(z.string()),
    maintenance: z.string(),
    ctaText: z.string(),
  }),
});

const cases = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    cover: z.string(),
    location: z.string(),
    area: z.string(),
    material: z.string(),
    duration: z.string(),
    date: z.date(),
    gallery: z.array(z.string()).optional(),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    cover: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    author: z.string(),
  }),
});

export const collections = { products, cases, blog };
