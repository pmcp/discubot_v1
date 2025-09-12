import { validateBody } from '@@/server/utils/bodyValidation'
import { phoneSchema } from '@@/shared/validations/auth'
import { generateNumericCode } from '@@/server/utils/nanoid'
import { saveOneTimePassword } from '@@/server/database/queries/auth'
import { OneTimePasswordTypes } from '@@/constants'
import { findUserByPhoneNumber } from '@@/server/database/queries/users'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { user } = await requireUserSession(event)
  const data = await validateBody(event, phoneSchema)

  // Check if phone number is already in use by another user
  const existingUser = await findUserByPhoneNumber(data.phoneNumber)
  if (existingUser && existingUser.id !== user.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This phone number is already in use by another account',
    })
  }

  const oneTimePassword = generateNumericCode(6)

  await saveOneTimePassword({
    userId: user.id,
    identifier: data.phoneNumber,
    code: oneTimePassword,
    type: OneTimePasswordTypes.login,
    expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
  })
  try {
    await $fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Body: `Your verification code for ${config.public.appName} is: ${oneTimePassword}`,
          To: data.phoneNumber,
          From: config.twilio.phoneNumber,
        }).toString(),
      },
    )
  } catch (error) {
    console.log(error)
  }

  sendNoContent(event)
})
