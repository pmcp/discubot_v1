import { useEmail } from 'use-email'

// Lazy-initialize email service to avoid build-time issues with env vars
let emailService: ReturnType<typeof useEmail> | null = null

function getEmailService() {
  if (!emailService) {
    const config = useRuntimeConfig()
    const provider = config.email.emailProvider
    if (!provider) {
      throw createError({
        statusCode: 500,
        statusMessage: 'EMAIL_PROVIDER environment variable is not set',
      })
    }
    emailService = useEmail(provider as any)
  }
  return emailService
}

export interface BaseEmailPayload {
  to: string | string[]
  subject: string
}

export interface TextEmailPayload extends BaseEmailPayload {
  text: string
  html?: string
}

export interface HtmlEmailPayload extends BaseEmailPayload {
  text?: string
  html: string
}

export type EmailPayload = TextEmailPayload | HtmlEmailPayload

export async function sendEmail({ to, subject, text, html }: EmailPayload) {
  const config = useRuntimeConfig()
  const service = getEmailService()

  try {
    await service.send({
      from: config.email.fromEmail,
      to,
      subject,
      text,
      html,
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to send email',
    })
  }
}
