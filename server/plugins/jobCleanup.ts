import { eq, and, lt, or } from 'drizzle-orm'
import { discubotJobs } from '#layers/discubot/collections/jobs/server/database/schema'

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export default defineNitroPlugin(() => {
  // Run cleanup on startup
  cleanupOldJobs()

  // Schedule periodic cleanup
  setInterval(() => {
    cleanupOldJobs()
  }, CLEANUP_INTERVAL_MS)

  console.log(`[Job Cleanup] Scheduler initialized. Will run every ${CLEANUP_INTERVAL_MS / 1000 / 60 / 60} hours.`)
})

async function cleanupOldJobs() {
  try {
    const db = useDB()
    const cutoffDate = new Date(Date.now() - RETENTION_MS)

    console.log(`[Job Cleanup] Starting cleanup. Deleting jobs older than ${RETENTION_DAYS} days (before ${cutoffDate.toISOString()})`)

    // Delete old completed or failed jobs
    const result = await db
      .delete(discubotJobs)
      .where(
        and(
          or(
            eq(discubotJobs.status, 'completed'),
            eq(discubotJobs.status, 'failed')
          ),
          lt(discubotJobs.completedAt, cutoffDate)
        )
      )
      .returning({ id: discubotJobs.id })

    const deletedCount = result.length

    if (deletedCount > 0) {
      console.log(`[Job Cleanup] Successfully deleted ${deletedCount} old job(s)`)
    } else {
      console.log(`[Job Cleanup] No old jobs to cleanup`)
    }

    return { success: true, deletedCount }
  } catch (error) {
    console.error('[Job Cleanup] Error during cleanup:', error)
    return { success: false, error }
  }
}