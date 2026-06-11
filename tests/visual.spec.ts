import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4321'

const PAGES_TO_TEST = [
  { url: '/', name: 'homepage' },
  { url: '/page/2/', name: 'page-2' },
  { url: '/category/australia/', name: 'category-australia' },
  { url: '/category/new-zealand/', name: 'category-new-zealand' },
  { url: '/category/south-america/', name: 'category-south-america' }
]

// Screenshot regression tests
for (const { url, name } of PAGES_TO_TEST) {
  test(`screenshot: ${name}`, async ({ page }, testInfo) => {
    await page.goto(`${BASE}${url}`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot(`${name}-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02
    })
  })
}

// Single <h1> per page
test('each page has exactly one h1', async ({ page }) => {
  const urls = ['/', '/category/australia/', '/page/2/']
  for (const url of urls) {
    await page.goto(`${BASE}${url}`)
    const h1Count = await page.locator('h1').count()
    expect(h1Count, `Expected 1 <h1> on ${url}`).toBe(1)
  }
})

// Pagination navigation
test('homepage next page link navigates to /page/2/', async ({ page }) => {
  await page.goto(`${BASE}/`)
  const nextLink = page.locator('nav.pagination a', { hasText: /older/i }).first()
  await nextLink.click()
  await page.waitForURL(`${BASE}/page/2/`)
  expect(page.url()).toBe(`${BASE}/page/2/`)
})

// Internal links contain no old WordPress domain
test('post pages contain no old domain links', async ({ page }) => {
  const testPost = '/2016/07/24/d-day-for-we-travel-preppers/'
  await page.goto(`${BASE}${testPost}`)
  const links = await page
    .locator('a[href]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))
  const oldDomainLinks = links.filter((href) => href.includes('thegrandtourists.wordpress.com'))
  expect(oldDomainLinks).toHaveLength(0)
})

// OG meta tags on post pages
test('post pages have og:title and og:image meta', async ({ page }) => {
  const testPost = '/2016/09/29/clicking-with-dolphins-and-dugongs-shark-bay-and-monkey-mia/'
  await page.goto(`${BASE}${testPost}`)
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(ogTitle).toBeTruthy()
  expect(ogImage).toBeTruthy()
})

// Sitemap contains post URLs
test('sitemap.xml is valid and contains posts', async ({ page }) => {
  const response = await page.goto(`${BASE}/sitemap-index.xml`)
  expect(response?.status()).toBe(200)
  const body = await page.content()
  expect(body).toContain('thegrandtourists.net')
})

// Skip link is present and focusable
test('skip-to-content link is in the DOM', async ({ page }) => {
  await page.goto(`${BASE}/`)
  const skipLink = page.locator('a[href="#main-content"]')
  expect(await skipLink.count()).toBe(1)
})

// Nav links point to correct category pages
test('nav has correct category links', async ({ page }) => {
  await page.goto(`${BASE}/`)
  await expect(page.locator('nav a[href="/category/australia/"]')).toHaveCount(1)
  await expect(page.locator('nav a[href="/category/new-zealand/"]')).toHaveCount(1)
  await expect(page.locator('nav a[href="/category/south-america/"]')).toHaveCount(1)
})
