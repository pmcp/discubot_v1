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
  devServer: {
    host: '0.0.0.0', // Listen on all network interfaces for ngrok
  },
  vite: {
    server: {
      allowedHosts: [
        '.ngrok-free.app',  // Any ngrok free URL
        '.ngrok.io',        // Alternative ngrok domain
        'localhost',        // Always allow localhost
      ],
      hmr: {
        clientPort: 443,    // For ngrok HTTPS
      },
    },
  },
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'system',
  },
//   import { createEnv } from '@t3-oss/env-nuxt'
// import { z } from 'zod'

// export const env = createEnv({
//   server: {
//     MOCK_EMAIL: z
//       .string()
//       .transform((val) => val === 'true')
//       .pipe(z.boolean())
//       .optional(),
//     BASE_URL: z.string().url(),
//     APP_NAME: z.string(),
//     APP_DESCRIPTION: z.string(),
//     LOGO_URL: z.string().url(),
//     RESEND_API_TOKEN: z.string().min(1),
//     NUXT_OAUTH_GITHUB_CLIENT_ID: z.string().min(1),
//     NUXT_OAUTH_GITHUB_CLIENT_SECRET: z.string().min(1),
//     NUXT_OAUTH_GOOGLE_CLIENT_ID: z.string().min(1),
//     NUXT_OAUTH_GOOGLE_CLIENT_SECRET: z.string().min(1),
//     NUXT_SESSION_PASSWORD: z.string().min(32),
//     NUXT_STRIPE_SECRET_KEY: z.string().min(1),
//     NUXT_STRIPE_WEBHOOK_SECRET: z.string().min(1),
//     FROM_EMAIL: z.string().email(),
//     EMAIL_PROVIDER: z.enum([
//       'resend',
//       'mailgun',
//       'sendgrid',
//       'postmark',
//       'plunk',
//       'zeptomail',
//     ]),
//     PAYMENT_PROVIDER: z.enum(['stripe', 'lemonsqueezy']),
//     TWILIO_ACCOUNT_SID: z.string().min(1),
//     TWILIO_AUTH_TOKEN: z.string().min(1),
//     TWILIO_PHONE_NUMBER: z
//       .string()
//       .regex(
//         /^\+[1-9]\d{1,14}$/,
//         'Phone number must be in E.164 format (e.g. +12125551234)',
//       ),
//   },
// })

  runtimeConfig: {
    // AI Service
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // Slack OAuth
    slackClientId: process.env.SLACK_CLIENT_ID,
    slackClientSecret: process.env.SLACK_CLIENT_SECRET,
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
    },
  },
  future: { compatibilityVersion: 4 },
  compatibilityDate: "2024-09-19",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    },
    rollupConfig: {
      plugins: [vue()],
    },
    experimental: {
      tasks: true,
    },
  },
  hub: {
    database: true,
    blob: true,
    kv: true,
    workers: true
  },
  auth: {
    webAuthn: true,
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
