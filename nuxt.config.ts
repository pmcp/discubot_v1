import vue from '@vitejs/plugin-vue'

export default defineNuxtConfig({
  modules: [
    '@nuxthub/core',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
    'nuxthub-ratelimit',
    '@nuxt/eslint',
  ],
  extends: [
    '@friendlyinternet/nuxt-crouton',
    './layers/discubot'
  ],
  devtools: { enabled: true },
  vite: {
    server: {
      allowedHosts: [
        'preternaturally-choosier-dodie.ngrok-free.dev',
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'system',
  },
  runtimeConfig: {
    // AI Service
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // Slack OAuth
    slackClientId: process.env.SLACK_CLIENT_ID,
    slackClientSecret: process.env.SLACK_CLIENT_SECRET,
    // Webhook Security
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
    mailgunSigningKey: process.env.MAILGUN_SIGNING_KEY, // Legacy - can be removed if using Resend
    resendWebhookSigningSecret: process.env.RESEND_WEBHOOK_SIGNING_SECRET,
    // Email Configuration
    resendApiToken: process.env.RESEND_API_TOKEN,
    email: {
      mock: process.env.MOCK_EMAIL,
      fromEmail: process.env.FROM_EMAIL,
      emailProvider: process.env.EMAIL_PROVIDER,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    // @ts-expect-error - We're just extending the type
    session: {
      maxAge: 60 * 60 * 24 * 7, // Session expires after 7 days - change it accordingly
    },
    public: {
      host: process.env.BASE_URL,
      baseUrl: process.env.BASE_URL,
      logoUrl: process.env.LOGO_URL,
      appName: process.env.APP_NAME,
      appDescription: process.env.APP_DESCRIPTION,
      emailDomain: process.env.EMAIL_DOMAIN, // Domain for config-specific email addresses
    },
  },
  future: { compatibilityVersion: 4 },
  compatibilityDate: "2024-09-23",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      compatibilityFlags: ["nodejs_compat"]
    },
    rollupConfig: {
      plugins: [vue()],
    },
    experimental: {
      tasks: true,
      openAPI: true
    },
    devServer: {
      watch: [],
    },
    // Ensure reflect-metadata is not externalized
    externals: {
      inline: ['reflect-metadata']
    },
    // Alias to ensure proper resolution
    alias: {
      'reflect-metadata': 'reflect-metadata'
    }
  },
  hub: {
    database: true,
    blob: true,
    kv: true,
    workers: true
  },
  auth: {
    webAuthn: false, // Disabled to avoid reflect-metadata/tsyringe dependency issues in Cloudflare Workers
  },
  eslint: {
    config: {
      standalone: true,
      typescript: {
        // Disables strict rules - recommended are still enabled
        strict: false,
        // Enables type-checking - this has a significant performance impact
        tsconfigPath: './tsconfig.json',
      },
      stylistic: {
        indent: 2,
        semi: false,
        quotes: 'single',
        commaDangle: 'always-multiline',
      },
    },
  },
  nuxtHubRateLimit: {
    routes: {
      '/api/auth/*': {
        maxRequests: 15,
        intervalSeconds: 60, // Minimum 60 seconds due to NuxtHub KV TTL limitation
      },
      '/api/**': {
        maxRequests: 150,
        intervalSeconds: 60, // Minimum 60 seconds due to NuxtHub KV TTL limitation
      },
    },
  },
})
