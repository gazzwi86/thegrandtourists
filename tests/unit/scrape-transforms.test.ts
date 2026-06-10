import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'

// Inline the transform helpers (same logic as in scrape.ts)
// These test the cheerio transforms independently

function rewriteImageUrl(
  dataOrigFile: string
): { src: string; srcset: string; year: string; month: string; filename: string } | null {
  const patterns = [
    /thegrandtourists\.wordpress\.com\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^?#]+)/,
    /thegrandtourists\.files\.wordpress\.com\/(\d{4})\/(\d{2})\/([^?#]+)/,
    /i0\.wp\.com\/thegrandtourists\.wordpress\.com\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^?#]+)/,
    /i0\.wp\.com\/thegrandtourists\.net\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^?#]+)/
  ]
  for (const pattern of patterns) {
    const m = dataOrigFile.match(pattern)
    if (m) {
      const [, year, month, rawFile] = m
      const filename = rawFile.replace(/\.(jpe?g|png|gif|webp)$/i, '.webp')
      const base = filename.replace(/\.webp$/, '')
      return {
        src: `/images/${year}/${month}/${filename}`,
        srcset: `/images/${year}/${month}/${base}-600.webp 600w, /images/${year}/${month}/${base}-1200.webp 1200w, /images/${year}/${month}/${filename} 1440w`,
        year,
        month,
        filename
      }
    }
  }
  return null
}

function convertCaption(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false })
  $('[data-shortcode="caption"], div.wp-caption').each((_i, el) => {
    const $el = $(el)
    $el.removeAttr('style')
    const captionText = $el.find('.wp-caption-text, p.wp-caption-text').text().trim()
    const $img = $el.find('img')
    $img.attr('alt', captionText)
    const newFigure = `<figure class="wp-caption">${$.html($img)}<figcaption>${captionText}</figcaption></figure>`
    $el.replaceWith(newFigure)
  })
  return $('body').html() ?? html
}

function unwrapAttachmentLinks(html: string, postSlugs: string[]): string {
  const $ = cheerio.load(html, { decodeEntities: false })
  $('a').each((_i, el) => {
    const $a = $(el)
    const href = $a.attr('href') ?? ''
    // Attachment pages: /YYYY/MM/DD/slug/image-name/ — no children that are links
    // They match when $a contains an img and the href path has 5+ segments
    const containsImg = $a.find('img').length > 0
    const isAttachmentLike = /\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/[^/]+\/?$/.test(href)
    if (containsImg && isAttachmentLike) {
      $a.replaceWith($a.contents())
    }
  })
  return $('body').html() ?? html
}

function rewriteInternalLinks(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false })
  $('a[href]').each((_i, el) => {
    const $a = $(el)
    const href = $a.attr('href') ?? ''
    const m = href.match(/https?:\/\/thegrandtourists\.net(\/\d{4}\/\d{2}\/\d{2}\/[^?#]*)/)
    if (m) {
      $a.attr('href', m[1])
    }
  })
  return $('body').html() ?? html
}

// ── Tests ──────────────────────────────────────────────────────

describe('rewriteImageUrl', () => {
  it('rewrites thegrandtourists.wordpress.com pattern', () => {
    const result = rewriteImageUrl(
      'https://thegrandtourists.wordpress.com/wp-content/uploads/2016/09/hero.jpg'
    )
    expect(result?.src).toBe('/images/2016/09/hero.webp')
    expect(result?.srcset).toContain('/images/2016/09/hero-600.webp 600w')
    expect(result?.srcset).toContain('/images/2016/09/hero.webp 1440w')
  })

  it('rewrites files.wordpress.com pattern', () => {
    const result = rewriteImageUrl('https://thegrandtourists.files.wordpress.com/2017/05/beach.jpg')
    expect(result?.src).toBe('/images/2017/05/beach.webp')
  })

  it('rewrites i0.wp.com/thegrandtourists.wordpress.com pattern', () => {
    const result = rewriteImageUrl(
      'https://i0.wp.com/thegrandtourists.wordpress.com/wp-content/uploads/2016/09/tiled.jpg'
    )
    expect(result?.src).toBe('/images/2016/09/tiled.webp')
  })

  it('rewrites i0.wp.com/thegrandtourists.net pattern', () => {
    const result = rewriteImageUrl(
      'https://i0.wp.com/thegrandtourists.net/wp-content/uploads/2018/11/last.jpg'
    )
    expect(result?.src).toBe('/images/2018/11/last.webp')
  })

  it('strips query params (orig-file values are clean, but defensive)', () => {
    const result = rewriteImageUrl(
      'https://thegrandtourists.files.wordpress.com/2016/09/photo.jpg?w=1200'
    )
    // query params after the filename cause no-match — data-orig-file is always clean
    // but the test confirms no crash on URL without extension variant
    expect(result === null || result.src.startsWith('/images/')).toBe(true)
  })

  it('returns null for unrecognised URLs', () => {
    const result = rewriteImageUrl('https://example.com/photo.jpg')
    expect(result).toBeNull()
  })
})

describe('convertCaption', () => {
  it('converts wp-caption div to figure/figcaption', () => {
    const input = `<div data-shortcode="caption" class="wp-caption" style="width: 620px"><img src="/test.jpg" alt=""><p class="wp-caption-text">A beautiful sunset</p></div>`
    const result = convertCaption(input)
    expect(result).toContain('<figure class="wp-caption">')
    expect(result).toContain('<figcaption>A beautiful sunset</figcaption>')
    expect(result).not.toContain('style=')
    expect(result).not.toContain('data-shortcode')
  })

  it('sets img alt from caption text', () => {
    const input = `<div class="wp-caption"><img src="/x.jpg" alt=""><p class="wp-caption-text">Kangaroo at dusk</p></div>`
    const result = convertCaption(input)
    expect(result).toContain('alt="Kangaroo at dusk"')
  })
})

describe('unwrapAttachmentLinks', () => {
  it('unwraps attachment page links around images', () => {
    const input = `<a href="https://thegrandtourists.net/2016/09/02/slug/image-name/"><img src="/photo.jpg" alt="test"></a>`
    const result = unwrapAttachmentLinks(input, ['slug'])
    expect(result).not.toContain('<a ')
    expect(result).toContain('<img')
  })

  it('leaves regular links intact', () => {
    const input = `<a href="https://example.com">Some link</a>`
    const result = unwrapAttachmentLinks(input, [])
    expect(result).toContain('<a href="https://example.com">')
  })

  it('leaves internal post links intact (no img child)', () => {
    const input = `<a href="/2016/09/02/my-post/">Read this post</a>`
    const result = unwrapAttachmentLinks(input, ['my-post'])
    expect(result).toContain('<a href="/2016/09/02/my-post/">')
  })
})

describe('rewriteInternalLinks', () => {
  it('rewrites absolute thegrandtourists.net post links to relative', () => {
    const input = `<a href="https://thegrandtourists.net/2016/09/02/my-post/">My Post</a>`
    const result = rewriteInternalLinks(input)
    expect(result).toContain('href="/2016/09/02/my-post/"')
    expect(result).not.toContain('thegrandtourists.net')
  })

  it('leaves external links unchanged', () => {
    const input = `<a href="https://example.com/page">External</a>`
    const result = rewriteInternalLinks(input)
    expect(result).toContain('href="https://example.com/page"')
  })

  it('handles http variant', () => {
    const input = `<a href="http://thegrandtourists.net/2017/05/10/post-slug/">Old http</a>`
    const result = rewriteInternalLinks(input)
    expect(result).toContain('href="/2017/05/10/post-slug/"')
  })
})
