import 'reflect-metadata'

/**
 * This plugin imports reflect-metadata polyfill required by tsyringe
 * (used by @peculiar/x509, a dependency of @simplewebauthn/server).
 *
 * The "0." prefix ensures this loads first (Nitro loads plugins alphabetically).
 */
export default defineNitroPlugin(() => {
  // Plugin body intentionally empty - we just need the import
})
