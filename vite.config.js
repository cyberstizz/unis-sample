import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// ─── Google Fonts: one <link> instead of a dozen @imports ──────────────────
// The fonts load from a single <link> in index.html. Eleven style files also
// @import Google Fonts themselves, and the build stacked all of those at the
// top of the main CSS file. The browser could only find them after that file
// downloaded, then had to fetch each one before showing anything (about nine
// extra requests in a row before the first paint).
// This drops an @import when every family it asks for is already in the
// index.html link. An @import for a family that isn't there is kept (it still
// works, just slower) and the build prints a warning: add that family, with
// the weights it needs, to the link in index.html.
const fontFamiliesIn = (url) =>
  [...url.matchAll(/[?&]family=([^:&'")]+)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')))

const LINKED_FONT_FAMILIES = (() => {
  const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8')
  const href = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/)
  return new Set(href ? fontFamiliesIn(href[1].replace(/&amp;/g, '&')) : [])
})()

function googleFontImports() {
  return {
    postcssPlugin: 'unis-google-font-imports',
    AtRule: {
      import(rule) {
        if (!rule.params.includes('fonts.googleapis.com')) return
        const missing = fontFamiliesIn(rule.params).filter((f) => !LINKED_FONT_FAMILIES.has(f))
        if (missing.length === 0) {
          rule.remove()
        } else {
          console.warn(`[fonts] ${missing.join(', ')} is not in the Google Fonts link in index.html; kept the slower @import.`)
        }
      },
    },
  }
}
googleFontImports.postcss = true

// Google AdSense, switched on by one Netlify variable: VITE_ADSENSE_CLIENT
// (the publisher ID, "ca-pub-" followed by 16 digits). When it's set, every
// build:
//   • adds the AdSense site tag and the account meta tag to <head>, and
//   • publishes /ads.txt naming Unis's account as an authorized seller.
// When it's unset (today, and in local work and tests) nothing is added, and
// the ad spaces show local sponsors or Unis's own cards instead.
function adsense() {
  let client = ''
  const valid = () => /^ca-pub-\d{10,20}$/.test(client)
  return {
    name: 'unis-adsense',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), 'VITE_')
      client = String(env.VITE_ADSENSE_CLIENT || '').trim()
      if (client && !valid()) {
        config.logger.warn(`[adsense] VITE_ADSENSE_CLIENT doesn't look like "ca-pub-…"; AdSense left off.`)
      }
    },
    transformIndexHtml() {
      if (!valid()) return []
      return [
        { tag: 'meta', attrs: { name: 'google-adsense-account', content: client }, injectTo: 'head' },
        {
          tag: 'script',
          attrs: {
            async: true,
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`,
            crossorigin: 'anonymous',
          },
          injectTo: 'head',
        },
      ]
    },
    generateBundle() {
      if (!valid()) return
      this.emitFile({
        type: 'asset',
        fileName: 'ads.txt',
        source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adsense()],
  assetsInclude: ['**/*.mp4'],
  define: { global: 'globalThis' },
  css: {
    postcss: { plugins: [googleFontImports()] },
  },
  build: {
    rollupOptions: {
      output: {
        // React itself goes in its own file. It changes only when React is
        // upgraded, so after an ordinary deploy returning visitors keep it
        // from their browser cache and download just the app code that changed.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
        },
      },
    },
  },
})
