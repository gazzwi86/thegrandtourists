import fs from 'fs'
import path from 'path'
import pLimit from 'p-limit'

const MANIFEST_PATH = path.resolve('scripts/image-manifest.json')
const FAILED_LOG = path.resolve('scripts/failed-downloads.json')
const CONCURRENCY = 5
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

interface ImageEntry {
  originalUrl: string
  localPath: string
  year: string
  month: string
  filename: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadWithRetry(url: string, retries = MAX_RETRIES): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { default: fetch } = await import('node-fetch')
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          if (attempt < retries) {
            await sleep(RETRY_DELAY_MS * attempt)
            continue
          }
        }
        throw new Error(`HTTP ${res.status}: ${url}`)
      }
      const arrayBuf = await res.arrayBuffer()
      return Buffer.from(arrayBuf)
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url}`)
}

async function isValidImage(filePath: string): Promise<boolean> {
  try {
    const { default: sharp } = await import('sharp')
    await sharp(filePath).metadata()
    return true
  } catch {
    return false
  }
}

async function processImage(entry: ImageEntry): Promise<{ url: string; error?: string }> {
  const { originalUrl, localPath, year, month } = entry
  const basename = path.basename(localPath, '.webp')

  const fullPath = path.resolve(localPath)
  const dir = path.dirname(fullPath)

  // Skip if exists and valid
  if (fs.existsSync(fullPath) && (await isValidImage(fullPath))) {
    return { url: originalUrl }
  }

  try {
    fs.mkdirSync(dir, { recursive: true })
    const buffer = await downloadWithRetry(originalUrl)

    const { default: sharp } = await import('sharp')

    // Write to .tmp first, then rename atomically
    const tmpPath = fullPath + '.tmp'

    // Generate all 3 sizes
    const sizes = [
      { suffix: '', maxWidth: 1440 },
      { suffix: '-1200', maxWidth: 1200 },
      { suffix: '-600', maxWidth: 600 }
    ]

    for (const { suffix, maxWidth } of sizes) {
      const outPath = path.join(dir, `${basename}${suffix}.webp`)
      const tmpOut = outPath + '.tmp'
      await sharp(buffer)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(tmpOut)
      fs.renameSync(tmpOut, outPath)
    }

    console.log(`  ✓ ${year}/${month}/${basename}.webp`)
    return { url: originalUrl }
  } catch (err) {
    const error = String(err)
    console.error(`  ✗ ${originalUrl}: ${error}`)
    return { url: originalUrl, error }
  }
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found at ${MANIFEST_PATH}. Run npm run scrape first.`)
    process.exit(1)
  }

  const manifest: ImageEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  console.log(`Processing ${manifest.length} images with concurrency ${CONCURRENCY}...`)

  const limit = pLimit(CONCURRENCY)
  const results = await Promise.all(manifest.map((entry) => limit(() => processImage(entry))))

  const failures = results.filter((r) => r.error)
  if (failures.length > 0) {
    fs.writeFileSync(FAILED_LOG, JSON.stringify(failures, null, 2), 'utf-8')
    console.error(`\n${failures.length} images failed — see ${FAILED_LOG}`)
    process.exit(1)
  } else {
    if (fs.existsSync(FAILED_LOG)) fs.unlinkSync(FAILED_LOG)
    console.log(`\nAll ${manifest.length} images processed successfully`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
