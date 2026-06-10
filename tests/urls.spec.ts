import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4321'

// Known post URLs — representative sample (full list tested after scrape)
const POST_URLS = [
  '/2019/02/07/a-walk-in-the-park-hiking-in-peru-australia-and-nz/',
  '/2018/11/18/the-last-leg-limping-from-byron-bay-to-cup-day/',
  '/2016/07/24/d-day-for-we-travel-preppers/',
  '/2016/09/29/clicking-with-dolphins-and-dugongs-shark-bay-and-monkey-mia/',
  '/2017/05/25/where-the-forest-meets-the-sea-daintree-rainforest/'
]

const STATIC_URLS = [
  '/',
  '/page/2/',
  '/category/australia/',
  '/category/new-zealand/',
  '/category/south-america/',
  '/sitemap-index.xml',
  '/robots.txt'
]

for (const url of [...POST_URLS, ...STATIC_URLS]) {
  test(`GET ${url} → 200`, async ({ page }) => {
    const response = await page.goto(`${BASE}${url}`)
    expect(response?.status()).toBe(200)
  })
}

test('404 page renders correctly', async ({ page }) => {
  const response = await page.goto(`${BASE}/this-page-does-not-exist-xyz/`)
  expect(response?.status()).toBe(404)
  const h1 = await page.locator('h1').textContent()
  expect(h1).toContain('404')
})
