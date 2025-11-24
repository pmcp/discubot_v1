export default defineNuxtPlugin((nuxtApp) => {
  // Log all errors
  nuxtApp.hook('vue:error', (error, instance, info) => {
    console.error('[ERROR LOGGER] Vue error:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      info,
      component: instance?.$options?.name || 'unknown',
      isSSR: !process.client
    })
  })

  // Hook into app errors
  nuxtApp.hook('app:error', (error) => {
    console.error('[ERROR LOGGER] App error:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      isSSR: !process.client,
      url: process.client ? window.location.href : 'SSR'
    })
  })

  // Hook into page errors
  nuxtApp.hook('page:start', () => {
    if (!process.client) {
      console.log('[ERROR LOGGER] SSR page rendering started')
    }
  })

  nuxtApp.hook('page:finish', () => {
    if (!process.client) {
      console.log('[ERROR LOGGER] SSR page rendering finished')
    }
  })

  // Catch unhandled promise rejections
  if (process.client) {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[ERROR LOGGER] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise
      })
    })
  }
})
