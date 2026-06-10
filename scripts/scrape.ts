import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'
import * as cheerio from 'cheerio'
import he from 'he'

const API_URL =
  'https://public-api.wordpress.com/rest/v1.1/sites/thegrandtourists.net/posts?number=100&fields=ID,title,slug,date,content,excerpt,categories,tags,featured_image,post_thumbnail'

const POSTS_DIR = path.resolve('src/content/posts')
const MANIFEST_PATH = path.resolve('scripts/image-manifest.json')
const WP_CDN_DOMAINS = [
  /https?:\/\/thegrandtourists\.wordpress\.com\/wp-content\/uploads\//,
  /https?:\/\/thegrandtourists\.files\.wordpress\.com\//,
  /https?:\/\/i0\.wp\.com\/thegrandtourists\.wordpress\.com\/wp-content\/uploads\//,
  /https?:\/\/i0\.wp\.com\/thegrandtourists\.net\/wp-content\/uploads\//
]

interface ImageEntry {
  originalUrl: string
  localPath: string
  year: string
  month: string
  filename: string
}

function extractDatePath(url: string): { year: string; month: string; filename: string } | null {
  // Strip query params
  const cleanUrl = url.split('?')[0]
  // Match /YYYY/MM/filename.ext
  const match = cleanUrl.match(/\/(\d{4})\/(\d{2})\/([^/]+)$/)
  if (!match) return null
  return { year: match[1], month: match[2], filename: match[3] }
}

function isWpImageUrl(url: string): boolean {
  return WP_CDN_DOMAINS.some((re) => re.test(url))
}

function getOriginalUrl(img: cheerio.Cheerio<cheerio.Element>): string | null {
  const origFile = img.attr('data-orig-file')
  if (origFile) return origFile.split('?')[0]
  const src = img.attr('src')
  if (src && isWpImageUrl(src)) return src.split('?')[0]
  return null
}

function localImagePath(year: string, month: string, basename: string): string {
  const name = basename.replace(/\.[^.]+$/, '')
  return `/images/${year}/${month}/${name}.webp`
}

function rewriteImages(
  $: cheerio.CheerioAPI,
  manifest: Map<string, ImageEntry>,
  isFirst: { value: boolean }
): void {
  $('img').each((_, el) => {
    const img = $(el)
    const origUrl = getOriginalUrl(img)
    if (!origUrl) return

    const parts = extractDatePath(origUrl)
    if (!parts) return

    const { year, month, filename } = parts
    const basename = filename.replace(/\.[^.]+$/, '')
    const localPath = `public/images/${year}/${month}/${basename}.webp`
    const webpSrc = localImagePath(year, month, filename)

    if (!manifest.has(origUrl)) {
      manifest.set(origUrl, { originalUrl: origUrl, localPath, year, month, filename })
    }

    // Derive width/height from data-orig-size if present
    const origSize = img.attr('data-orig-size') || ''
    const [w, h] = origSize.split(',').map(Number)
    const width = w || undefined
    const height = h || undefined

    const alt = img.attr('alt') || ''
    const loading = isFirst.value ? 'eager' : 'lazy'
    const priority = isFirst.value ? ' fetchpriority="high"' : ''
    isFirst.value = false

    img.attr('src', webpSrc)
    img.attr(
      'srcset',
      `${webpSrc.replace('.webp', '-600.webp')} 600w, ${webpSrc.replace('.webp', '-1200.webp')} 1200w, ${webpSrc} 1440w`
    )
    img.attr('sizes', '(max-width: 600px) 600px, (max-width: 1200px) 1200px, 1440px')
    img.attr('loading', loading)
    if (priority) img.attr('fetchpriority', 'high')
    img.attr('alt', alt)
    if (width) img.attr('width', String(width))
    if (height) img.attr('height', String(height))

    // Strip all data-* attributes
    const attribs = el.attribs
    for (const key of Object.keys(attribs)) {
      if (key.startsWith('data-')) img.removeAttr(key)
    }
  })
}

function convertCaptions($: cheerio.CheerioAPI): void {
  $('div[data-shortcode="caption"], div.wp-caption').each((_, el) => {
    const div = $(el)
    div.removeAttr('style')
    const captionText = div.find('p.wp-caption-text').text().trim()
    div.find('p.wp-caption-text').remove()

    const inner = div.html() || ''
    const figure = `<figure class="wp-caption">${inner}${captionText ? `<figcaption>${captionText}</figcaption>` : ''}</figure>`
    div.replaceWith(figure)
  })
}

function convertTiledGallery($: cheerio.CheerioAPI, manifest: Map<string, ImageEntry>): void {
  $('.tiled-gallery').each((_, galleryEl) => {
    const gallery = $(galleryEl)
    const figures: string[] = []

    gallery.find('.tiled-gallery-item').each((_, itemEl) => {
      const item = $(itemEl)
      const img = item.find('img')
      const caption = item.find('.tiled-gallery-caption').text().trim()
      const origFile =
        img.attr('data-orig-file')?.split('?')[0] || img.attr('src')?.split('?')[0] || ''
      const parts = origFile ? extractDatePath(origFile) : null
      let imgHtml = ''
      if (parts) {
        const { year, month, filename } = parts
        const localPath = `public/images/${year}/${month}/${filename.replace(/\.[^.]+$/, '')}.webp`
        if (origFile && !manifest.has(origFile)) {
          manifest.set(origFile, { originalUrl: origFile, localPath, year, month, filename })
        }
        const src = localImagePath(year, month, filename)
        imgHtml = `<img src="${src}" srcset="${src.replace('.webp', '-600.webp')} 600w, ${src.replace('.webp', '-1200.webp')} 1200w, ${src} 1440w" sizes="(max-width: 600px) 600px, 1200px" loading="lazy" alt="${he.encode(caption || '')}">`
      }
      figures.push(
        `<figure class="gallery-item">${imgHtml}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
      )
    })

    gallery.replaceWith(
      `<div role="group" aria-label="Photo gallery" class="tiled-gallery-static">${figures.join('\n')}</div>`
    )
  })
}

function unwrapAttachmentLinks($: cheerio.CheerioAPI): void {
  // WP attachment links: /YYYY/MM/DD/post-slug/image-name/ — all dead on static site
  $('a[href]').each((_, el) => {
    const a = $(el)
    const href = a.attr('href') || ''
    if (/thegrandtourists\.net\/\d{4}\/\d{2}\/\d{2}\//.test(href) && a.find('img').length > 0) {
      a.replaceWith(a.contents())
    }
  })
}

function rewriteInternalLinks($: cheerio.CheerioAPI): void {
  $('a[href]').each((_, el) => {
    const a = $(el)
    const href = a.attr('href') || ''
    const match = href.match(/https?:\/\/thegrandtourists\.(?:net|wordpress\.com)(\/\d{4}\/\d{2}\/\d{2}\/[^"'\s]+)/)
    if (match) {
      a.attr('href', match[1])
    }
  })
}

function cleanupHtml($: cheerio.CheerioAPI): void {
  // Strip Apple-converted-space spans
  $('span.Apple-converted-space').each((_, el) => $(el).replaceWith($(el).text()))

  // Downgrade h1 → h2 in body (page h1 is the post title)
  $('h1').each((_, el) => {
    const h = $(el)
    h.replaceWith(
      `<h2${Object.entries(el.attribs || {})
        .map(([k, v]) => ` ${k}="${v}"`)
        .join('')}>${h.html()}</h2>`
    )
  })

  // Strip class from <p> tags
  $('p').removeAttr('class')

  // Strip inline style from wp-caption figures
  $('figure.wp-caption').removeAttr('style')

  // Wrap tables for responsive overflow
  $('table').each((_, el) => {
    const t = $(el)
    if (!t.parent().hasClass('table-wrapper')) {
      t.wrap('<div class="table-wrapper"></div>')
    }
  })
}

function buildExcerpt(html: string): string {
  const text = he.decode(
    html
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
  return text.slice(0, 160)
}

async function main() {
  console.log('Fetching posts from WordPress.com API...')
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = (await res.json()) as { found: number; posts: any[] }

  if (data.found !== data.posts.length) {
    throw new Error(`API pagination issue: found=${data.found} but received ${data.posts.length}`)
  }

  console.log(`Found ${data.found} posts`)

  fs.mkdirSync(POSTS_DIR, { recursive: true })

  const manifest = new Map<string, ImageEntry>()
  let written = 0

  for (const post of data.posts) {
    // Extract date from API's local-time string directly (avoids UTC timezone offset shifting the day)
    const [yyyy, mm, dd] = post.date.substring(0, 10).split('-')
    const permalink = `${yyyy}/${mm}/${dd}/${post.slug}`

    const $ = cheerio.load(post.content || '', { xmlMode: false })
    const isFirst = { value: true }

    rewriteImages($, manifest, isFirst)
    convertCaptions($)
    convertTiledGallery($, manifest)
    unwrapAttachmentLinks($)
    rewriteInternalLinks($)
    cleanupHtml($)

    const bodyHtml = $('body').html() || ''

    // Featured image
    let featuredImage: string | undefined
    let featuredImageWidth: number | undefined
    let featuredImageHeight: number | undefined
    let featuredImageAlt = ''

    const fi = post.featured_image || post.post_thumbnail?.URL || post.post_thumbnail?.guid
    if (fi) {
      const fiClean = fi.split('?')[0]
      const parts = extractDatePath(fiClean)
      if (parts) {
        const { year, month, filename } = parts
        featuredImage = localImagePath(year, month, filename)
        featuredImageAlt = post.post_thumbnail?.title || ''
        const localPath = `public/images/${year}/${month}/${filename.replace(/\.[^.]+$/, '')}.webp`
        if (!manifest.has(fiClean)) {
          manifest.set(fiClean, { originalUrl: fiClean, localPath, year, month, filename })
        }
        if (post.post_thumbnail?.width) featuredImageWidth = post.post_thumbnail.width
        if (post.post_thumbnail?.height) featuredImageHeight = post.post_thumbnail.height
      }
    }

    // Categories — always use slug from value, not key
    const categories: string[] = Object.values(post.categories || {}).map(
      (cat: any) => cat.slug as string
    )

    // Tags
    const tags: string[] = Object.keys(post.tags || {})

    // Excerpt
    const excerptHtml = post.excerpt || ''
    const excerpt = buildExcerpt(excerptHtml)

    // Build frontmatter object — js-yaml handles escaping
    const frontmatter: Record<string, any> = {
      title: post.title,
      date: `${yyyy}-${mm}-${dd}`,
      slug: post.slug,
      permalink,
      excerpt,
      excerptHtml,
      featuredImage,
      featuredImageWidth,
      featuredImageHeight,
      featuredImageAlt,
      categories,
      tags,
      wpId: post.ID,
      body: bodyHtml
    }

    // Remove undefined fields
    for (const key of Object.keys(frontmatter)) {
      if (frontmatter[key] === undefined) delete frontmatter[key]
    }

    const yamlStr = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true })
    const fileContent = `---\n${yamlStr}---\n`

    // Round-trip validation
    let parsed: any
    try {
      parsed = yaml.load(yamlStr)
    } catch (e) {
      throw new Error(`YAML round-trip failed for post ${post.slug}: ${e}`)
    }
    if (parsed?.body !== bodyHtml) {
      // Attempt to detect obvious truncation
      if (parsed?.body && parsed.body.length < bodyHtml.length * 0.9) {
        throw new Error(`YAML body truncation detected for post ${post.slug}`)
      }
    }

    const filename = `${yyyy}-${mm}-${dd}-${post.slug}.md`
    const filepath = path.join(POSTS_DIR, filename)
    fs.writeFileSync(filepath, fileContent, 'utf-8')
    written++
    console.log(`  ✓ ${filename}`)
  }

  // Write image manifest
  const manifestArr = Array.from(manifest.values())
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestArr, null, 2), 'utf-8')

  console.log(`\nDone: ${written} posts written, ${manifestArr.length} images in manifest`)

  // Verify no old WP URLs remain in any written file
  console.log('\nVerifying no old WP URLs remain...')
  const patterns = ['i0.wp.com', 'wp-content/uploads', 'thegrandtourists.wordpress.com']
  let clean = true
  for (const f of fs.readdirSync(POSTS_DIR)) {
    const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf-8')
    for (const pat of patterns) {
      if (content.includes(pat)) {
        console.error(`  ✗ ${f} still contains: ${pat}`)
        clean = false
      }
    }
  }
  if (clean) {
    console.log('  ✓ All URLs rewritten correctly')
  } else {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
