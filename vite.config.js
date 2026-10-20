import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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

})
