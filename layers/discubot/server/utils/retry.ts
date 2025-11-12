/**
 * Retry utility with exponential backoff
 *
 * Provides simple retry logic for async operations that may fail temporarily.
 * Used throughout Discubot for external API calls (Claude, Notion, Figma, Slack).
 *
 * @module retry
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts (including the first try)
   * @default 3
   */
  maxAttempts?: number

  /**
   * Base delay in milliseconds for exponential backoff
   * @default 1000 (1 second)
   */
  baseDelay?: number

  /**
   * Optional callback invoked before each retry
   * Useful for logging retry attempts
   */
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Delay helper function
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry an async function with exponential backoff
 *
 * Attempts to execute the provided function up to maxAttempts times.
 * On failure, waits with exponential backoff: 2s, 4s, 8s, etc.
 *
 * @example
 * ```typescript
 * // Simple usage
 * const result = await retryWithBackoff(() => fetchData())
 *
 * // With custom options
 * const result = await retryWithBackoff(
 *   () => callExternalAPI(),
 *   {
 *     maxAttempts: 5,
 *     baseDelay: 500,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error)
 *   }
 * )
 * ```
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's return value
 * @throws The last error if all attempts fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    onRetry
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw error
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error)
      }

      // Calculate exponential backoff: 2^attempt * baseDelay
      // Attempt 1: 2^1 * 1000 = 2000ms (2s)
      // Attempt 2: 2^2 * 1000 = 4000ms (4s)
      // Attempt 3: 2^3 * 1000 = 8000ms (8s)
      const backoffMs = Math.pow(2, attempt) * baseDelay

      // Wait before next retry
      await delay(backoffMs)
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError
}

/**
 * Retry a function with a simple fixed delay between attempts
 *
 * Alternative to exponential backoff when you want a consistent delay.
 *
 * @example
 * ```typescript
 * const result = await retryWithFixedDelay(() => fetchData(), {
 *   maxAttempts: 3,
 *   delayMs: 1000
 * })
 * ```
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration with fixed delay
 * @returns Promise resolving to the function's return value
 * @throws The last error if all attempts fail
 */
export async function retryWithFixedDelay<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delayMs?: number
    onRetry?: (attempt: number, error: unknown) => void
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    onRetry
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts) {
        throw error
      }

      if (onRetry) {
        onRetry(attempt, error)
      }

      await delay(delayMs)
    }
  }

  throw lastError
}