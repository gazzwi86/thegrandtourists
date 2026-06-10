// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import pagefind from 'astro-pagefind'

export default defineConfig({
  site: 'https://thegrandtourists.net',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/page/') && !page.includes('/category/'),
    }),
    pagefind(),
  ],
  compressHTML: true,
  trailingSlash: 'always',
  build: { format: 'directory' },
})
