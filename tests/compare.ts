import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const LIVE_URL = 'https://thegrandtourists.net'
const LOCAL_URL = 'http://localhost:4321'
const REPORT_DIR = path.join(process.cwd(), 'tests', 'comparison-screenshots')
const REPORT_HTML = path.join(process.cwd(), 'tests', 'comparison-report.html')
const DIFF_JSON = path.join(process.cwd(), 'tests', 'comparison-diff.json')

const PAGES = [
  { path: '/', name: 'homepage' },
  { path: '/category/australia/', name: 'category-australia' },
  { path: '/page/2/', name: 'page-2' },
  {
    path: '/2016/09/29/clicking-with-dolphins-and-dugongs-shark-bay-and-monkey-mia/',
    name: 'shark-bay'
  },
  { path: '/2016/07/24/d-day-for-we-travel-preppers/', name: 'first-post' }
]

async function captureScreenshot(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>,
  url: string,
  outputPath: string
) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: outputPath, fullPage: true })
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  const results: {
    name: string
    livePath: string
    localPath: string
    liveUrl: string
    localUrl: string
  }[] = []

  for (const { path: urlPath, name } of PAGES) {
    console.log(`Capturing: ${name}`)
    const livePath = path.join(REPORT_DIR, `${name}-live.png`)
    const localPath = path.join(REPORT_DIR, `${name}-local.png`)

    try {
      await captureScreenshot(page, `${LIVE_URL}${urlPath}`, livePath)
    } catch (e) {
      console.warn(`  Live capture failed for ${name}: ${e}`)
      // Write placeholder
      fs.writeFileSync(livePath, Buffer.alloc(0))
    }

    try {
      await captureScreenshot(page, `${LOCAL_URL}${urlPath}`, localPath)
    } catch (e) {
      console.warn(`  Local capture failed for ${name}: ${e}`)
      fs.writeFileSync(localPath, Buffer.alloc(0))
    }

    results.push({
      name,
      livePath,
      localPath,
      liveUrl: `${LIVE_URL}${urlPath}`,
      localUrl: `${LOCAL_URL}${urlPath}`
    })
  }

  await browser.close()

  // Generate HTML report
  const rows = results
    .map(({ name, livePath, localPath, liveUrl, localUrl }) => {
      const liveExists = fs.existsSync(livePath) && fs.statSync(livePath).size > 0
      const localExists = fs.existsSync(localPath) && fs.statSync(localPath).size > 0
      const liveDataUrl = liveExists
        ? `data:image/png;base64,${fs.readFileSync(livePath).toString('base64')}`
        : ''
      const localDataUrl = localExists
        ? `data:image/png;base64,${fs.readFileSync(localPath).toString('base64')}`
        : ''

      return `
    <section>
      <h2>${name}</h2>
      <p>
        <a href="${liveUrl}" target="_blank">Live</a> vs
        <a href="${localUrl}" target="_blank">Local</a>
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div>
          <h3>Live (WordPress)</h3>
          ${liveExists ? `<img src="${liveDataUrl}" style="width:100%;border:1px solid #ccc" />` : '<p style="color:red">Capture failed</p>'}
        </div>
        <div>
          <h3>Local (Astro)</h3>
          ${localExists ? `<img src="${localDataUrl}" style="width:100%;border:1px solid #ccc" />` : '<p style="color:red">Capture failed</p>'}
        </div>
      </div>
    </section>`
    })
    .join('\n<hr>\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Visual Comparison Report — The Grand Tourists</title>
  <style>
    body { font-family: sans-serif; max-width: 1400px; margin: 0 auto; padding: 1rem; }
    section { margin-bottom: 3rem; }
    h2 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>Visual Comparison: WordPress vs Astro</h1>
  <p>Generated on ${new Date().toISOString()}</p>
  ${rows}
</body>
</html>`

  fs.writeFileSync(REPORT_HTML, html)
  console.log(`\nReport written to: ${REPORT_HTML}`)

  // Write diff JSON (no pixel-diff library here — just flag for human review)
  const diffResult = results.map(({ name, liveUrl, localUrl }) => ({
    name,
    liveUrl,
    localUrl,
    reviewRequired: true
  }))
  fs.writeFileSync(DIFF_JSON, JSON.stringify(diffResult, null, 2))
  console.log(`Diff JSON written to: ${DIFF_JSON}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
