import { getCollection } from 'astro:content'

export async function getSortedPosts() {
  return (await getCollection('posts')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )
}

export async function getPostsByCategory(categorySlug: string) {
  const all = await getSortedPosts()
  return all.filter((p) => p.data.categories.includes(categorySlug))
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

export function buildSrcset(src: string): string {
  if (!src.endsWith('.webp')) return src
  const base = src.slice(0, -5)
  return `${base}-600.webp 600w, ${base}-1200.webp 1200w, ${src} 1440w`
}

export function paginatePosts<T>(items: T[], page: number, perPage = 10) {
  const totalPages = Math.ceil(items.length / perPage)
  const start = (page - 1) * perPage
  return {
    posts: items.slice(start, start + perPage),
    page,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages
  }
}
