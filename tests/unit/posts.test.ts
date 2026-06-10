import { describe, it, expect } from 'vitest'
import { formatDate, paginatePosts } from '../../src/lib/posts'

describe('formatDate', () => {
  it('formats a date with explicit en-GB locale', () => {
    const d = new Date('2019-02-07T00:00:00Z')
    const result = formatDate(d)
    expect(result).toBe('7 February 2019')
  })

  it('is locale-independent (consistent in any CI environment)', () => {
    const d = new Date('2016-07-24T00:00:00Z')
    expect(formatDate(d)).toBe('24 July 2016')
  })
})

describe('paginatePosts', () => {
  const makePosts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) })) as any[]

  it('returns first 10 items on page 1', () => {
    const posts = makePosts(32)
    const result = paginatePosts(posts, 1)
    expect(result.posts).toHaveLength(10)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(4)
    expect(result.hasPrev).toBe(false)
    expect(result.hasNext).toBe(true)
  })

  it('returns correct slice on last page', () => {
    const posts = makePosts(32)
    const result = paginatePosts(posts, 4)
    expect(result.posts).toHaveLength(2)
    expect(result.hasPrev).toBe(true)
    expect(result.hasNext).toBe(false)
  })

  it('handles exactly 10 posts (single page)', () => {
    const posts = makePosts(10)
    const result = paginatePosts(posts, 1)
    expect(result.posts).toHaveLength(10)
    expect(result.totalPages).toBe(1)
    expect(result.hasNext).toBe(false)
    expect(result.hasPrev).toBe(false)
  })

  it('handles 11 posts (two pages)', () => {
    const posts = makePosts(11)
    const page1 = paginatePosts(posts, 1)
    const page2 = paginatePosts(posts, 2)
    expect(page1.posts).toHaveLength(10)
    expect(page2.posts).toHaveLength(1)
    expect(page1.hasNext).toBe(true)
    expect(page2.hasPrev).toBe(true)
  })

  it('handles 0 posts', () => {
    const result = paginatePosts([], 1)
    expect(result.posts).toHaveLength(0)
    expect(result.totalPages).toBe(0)
    expect(result.hasNext).toBe(false)
    expect(result.hasPrev).toBe(false)
  })

  it('handles 1 post', () => {
    const result = paginatePosts(makePosts(1), 1)
    expect(result.posts).toHaveLength(1)
    expect(result.totalPages).toBe(1)
  })
})
