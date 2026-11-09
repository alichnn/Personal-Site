// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  ssr: false,
  app: {
    baseURL: '/',
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Alice Chen',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Alice Chen — a scroll through air, earth, water and fire. Math/BBA at Waterloo and Laurier, thinking about people.' },
        { name: 'theme-color', content: '#cfe6ff' },
        { property: 'og:title', content: 'Alice Chen' },
        { property: 'og:description', content: 'A scroll through air, earth, water and fire.' },
        { property: 'og:url', content: 'https://alicechen.art' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  css: ['~/assets/main.css'],
  vite: {
    build: { chunkSizeWarningLimit: 1200 },
  },
  nitro: {
    preset: 'github_pages',
    // alicechen.art/intro, /work, /about and /contact each open the story at that chapter.
    // Written as work.html etc., which GitHub Pages serves at /work with no redirect.
    prerender: {
      routes: ['/intro', '/work', '/about', '/contact'],
      autoSubfolderIndex: false,
    },
  },
})
