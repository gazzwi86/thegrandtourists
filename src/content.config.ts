import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const posts = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.md',
    base: './src/content/posts',
    // @ts-ignore retainBody is valid in Astro 6
    retainBody: false
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    slug: z.string(),
    permalink: z.string(),
    excerpt: z.string(),
    excerptHtml: z.string(),
    body: z.string(),
    featuredImage: z.string().optional(),
    featuredImageWidth: z.number().optional(),
    featuredImageHeight: z.number().optional(),
    featuredImageAlt: z.string().default(''),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    wpId: z.number().optional()
  })
})

export const collections = { posts }
