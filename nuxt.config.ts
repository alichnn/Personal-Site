// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  app: {
    baseURL: '/Personal-Site/',
    head: {
      title: 'Alice Chen',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { href: 'https://fonts.googleapis.com/css2?family=Alice&display=swap', rel: 'stylesheet' },
      ],
    },
  },
  css: ['~/assets/global.css'],
  nitro: {
    preset: 'github_pages',
  },
})
