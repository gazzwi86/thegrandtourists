module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/category/australia/',
        'http://localhost:4321/2019/02/07/a-walk-in-the-park-hiking-in-peru-australia-and-nz/',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox',
        // Block image URLs so 404s (images are gitignored, not in CI build) don't appear
        // as console errors and fail the errors-in-console best-practices audit.
        blockedUrlPatterns: ['**/images/**'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1.0 }],
        'categories:best-practices': ['error', { minScore: 1.0 }],
        'categories:seo': ['error', { minScore: 1.0 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
