import { useEmail } from 'use-email'
const config = useRuntimeConfig()
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER as string
const emailService = useEmail(EMAIL_PROVIDER)

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
  try {
    await emailService.send({
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
