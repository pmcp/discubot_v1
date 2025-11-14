import { describe, it, expect } from 'vitest'
import {
  classifyFigmaEmail,
  classifyEmails,
  getMessageTypeDescription,
  getMessageTypeIcon,
  shouldForwardEmail,
  type EmailToClassify,
  type FigmaEmailType
} from '../../layers/discubot/server/utils/emailClassifier'

describe('emailClassifier', () => {
  describe('classifyFigmaEmail', () => {
    describe('account-verification emails', () => {
      it('should classify email with "verify your email" in subject', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Verify your email address',
          htmlBody: '<p>Click here to verify</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
        expect(result.confidence).toBeGreaterThan(0.9)
        expect(result.reason).toContain('verification')
      })

      it('should classify email with "verify account" in subject', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Verify your Figma account',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
      })

      it('should classify email with "confirm your email" in content', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Welcome to Figma',
          htmlBody: '<p>Please confirm your email address to continue</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
      })

      it('should classify email with "activate your account" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Activate your account',
          textBody: 'Click to activate your account'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
      })
    })

    describe('password-reset emails', () => {
      it('should classify email with "reset your password" in subject', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Reset your password',
          htmlBody: '<p>Click here to reset</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
        expect(result.confidence).toBeGreaterThan(0.9)
        expect(result.reason).toContain('password reset')
      })

      it('should classify email with "forgot your password" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Forgot your password?',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
      })

      it('should classify email with "password recovery" in content', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Account Security',
          htmlBody: '<p>Password recovery link: https://figma.com/reset</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
      })

      it('should classify email with "change your password" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Change your password',
          textBody: 'To change your password, click below'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
      })
    })

    describe('comment emails', () => {
      it('should classify email with "commented on" in subject', () => {
        const email: EmailToClassify = {
          from: 'comments@figma.com',
          to: 'bot@example.com',
          subject: 'John commented on Design System',
          htmlBody: '<p>John said: Great work!</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('comment')
        expect(result.confidence).toBeGreaterThan(0.8)
      })

      it('should classify email with "left a comment" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Jane left a comment in your file',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('comment')
      })

      it('should classify email with "mentioned you" pattern', () => {
        const email: EmailToClassify = {
          from: 'comments@figma.com',
          to: 'bot@example.com',
          subject: 'Alex mentioned you in a comment',
          htmlBody: '<p>@bot what do you think?</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('comment')
      })

      it('should classify email with "replied to" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Sarah replied to your comment',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('comment')
      })

      it('should NOT classify as comment if not from comments domain', () => {
        const email: EmailToClassify = {
          from: 'other@example.com',
          to: 'bot@example.com',
          subject: 'Someone commented on your blog',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).not.toBe('comment')
      })
    })

    describe('invitation emails', () => {
      it('should classify email with "invited you" in subject', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'John invited you to join the Design Team',
          htmlBody: '<p>Accept invitation</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('invitation')
        expect(result.confidence).toBeGreaterThan(0.8)
      })

      it('should classify email with "shared a file" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Jane shared a file with you',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('invitation')
      })

      it('should classify email with "join the team" in content', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Team Invitation',
          htmlBody: '<p>Click to join the team</p>'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('invitation')
      })

      it('should classify email with "you\'re invited" pattern', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'You\'re invited to collaborate',
          textBody: 'Start collaborating now'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('invitation')
      })
    })

    describe('notification emails', () => {
      it('should classify email with "notification" in subject from Figma', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Notification: File updated',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('notification')
      })

      it('should classify email with "update" from Figma', () => {
        const email: EmailToClassify = {
          from: 'news@figma.com',
          to: 'bot@example.com',
          subject: 'Product update: New features',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('notification')
      })

      it('should classify email with "announcement" from Figma', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Announcement: New pricing',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('notification')
      })

      it('should NOT classify as notification if not from Figma domain', () => {
        const email: EmailToClassify = {
          from: 'other@example.com',
          to: 'bot@example.com',
          subject: 'Notification: Something happened',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).not.toBe('notification')
      })
    })

    describe('other/unknown emails', () => {
      it('should classify unknown email as "other"', () => {
        const email: EmailToClassify = {
          from: 'random@example.com',
          to: 'bot@example.com',
          subject: 'Random subject',
          htmlBody: 'Random content'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('other')
        expect(result.confidence).toBeLessThan(0.6)
        expect(result.reason).toContain('Could not match')
      })

      it('should classify Figma email without recognizable patterns as "other"', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Some unknown subject',
          htmlBody: 'Some unknown content'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('other')
      })
    })

    describe('priority ordering', () => {
      it('should prioritize account-verification over comment', () => {
        const email: EmailToClassify = {
          from: 'comments@figma.com',
          to: 'bot@example.com',
          subject: 'Verify your email and see new comments',
          htmlBody: 'Someone commented'
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
      })

      it('should prioritize password-reset over notification', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Notification: Reset your password',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
      })
    })

    describe('case insensitivity', () => {
      it('should handle uppercase subjects', () => {
        const email: EmailToClassify = {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'VERIFY YOUR EMAIL',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('account-verification')
      })

      it('should handle mixed case patterns', () => {
        const email: EmailToClassify = {
          from: 'NO-REPLY@FIGMA.COM',
          to: 'bot@example.com',
          subject: 'Reset Your Password',
          htmlBody: ''
        }

        const result = classifyFigmaEmail(email)

        expect(result.messageType).toBe('password-reset')
      })
    })
  })

  describe('classifyEmails', () => {
    it('should classify multiple emails in batch', () => {
      const emails: EmailToClassify[] = [
        {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Verify your email',
          htmlBody: ''
        },
        {
          from: 'comments@figma.com',
          to: 'bot@example.com',
          subject: 'John commented on your file',
          htmlBody: ''
        },
        {
          from: 'no-reply@figma.com',
          to: 'bot@example.com',
          subject: 'Reset your password',
          htmlBody: ''
        }
      ]

      const results = classifyEmails(emails)

      expect(results).toHaveLength(3)
      expect(results[0].messageType).toBe('account-verification')
      expect(results[1].messageType).toBe('comment')
      expect(results[2].messageType).toBe('password-reset')
    })

    it('should handle empty array', () => {
      const results = classifyEmails([])

      expect(results).toHaveLength(0)
    })
  })

  describe('getMessageTypeDescription', () => {
    it('should return correct description for each message type', () => {
      expect(getMessageTypeDescription('comment')).toBe('Figma comment or mention')
      expect(getMessageTypeDescription('account-verification')).toBe('Account verification email')
      expect(getMessageTypeDescription('password-reset')).toBe('Password reset request')
      expect(getMessageTypeDescription('invitation')).toBe('Team or file invitation')
      expect(getMessageTypeDescription('notification')).toBe('General notification')
      expect(getMessageTypeDescription('other')).toBe('Other email type')
    })
  })

  describe('getMessageTypeIcon', () => {
    it('should return correct icon for each message type', () => {
      expect(getMessageTypeIcon('comment')).toBe('i-heroicons-chat-bubble-left-right')
      expect(getMessageTypeIcon('account-verification')).toBe('i-heroicons-shield-check')
      expect(getMessageTypeIcon('password-reset')).toBe('i-heroicons-lock-closed')
      expect(getMessageTypeIcon('invitation')).toBe('i-heroicons-user-plus')
      expect(getMessageTypeIcon('notification')).toBe('i-heroicons-bell')
      expect(getMessageTypeIcon('other')).toBe('i-heroicons-envelope')
    })
  })

  describe('shouldForwardEmail', () => {
    it('should return true for account-verification emails', () => {
      expect(shouldForwardEmail('account-verification')).toBe(true)
    })

    it('should return true for password-reset emails', () => {
      expect(shouldForwardEmail('password-reset')).toBe(true)
    })

    it('should return false for comment emails', () => {
      expect(shouldForwardEmail('comment')).toBe(false)
    })

    it('should return false for invitation emails', () => {
      expect(shouldForwardEmail('invitation')).toBe(false)
    })

    it('should return false for notification emails', () => {
      expect(shouldForwardEmail('notification')).toBe(false)
    })

    it('should return false for other emails', () => {
      expect(shouldForwardEmail('other')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle emails with empty subject', () => {
      const email: EmailToClassify = {
        from: 'no-reply@figma.com',
        to: 'bot@example.com',
        subject: '',
        htmlBody: 'Verify your email address'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('account-verification')
    })

    it('should handle emails with no body', () => {
      const email: EmailToClassify = {
        from: 'comments@figma.com',
        to: 'bot@example.com',
        subject: 'Someone commented on your file',
        htmlBody: '',
        textBody: ''
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('comment')
    })

    it('should handle emails with only htmlBody', () => {
      const email: EmailToClassify = {
        from: 'no-reply@figma.com',
        to: 'bot@example.com',
        subject: 'Welcome',
        htmlBody: 'Reset your password here'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('password-reset')
    })

    it('should handle emails with only textBody', () => {
      const email: EmailToClassify = {
        from: 'no-reply@figma.com',
        to: 'bot@example.com',
        subject: 'Important',
        textBody: 'Verify your account to continue'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('account-verification')
    })
  })

  describe('real-world examples', () => {
    it('should correctly classify typical Figma verification email', () => {
      const email: EmailToClassify = {
        from: 'no-reply@figma.com',
        to: 'bot@discubot.com',
        subject: 'Please verify your email address',
        htmlBody: '<html><body><h1>Verify your email</h1><p>Click the button below to verify your Figma account.</p><a href="https://figma.com/verify?token=abc123">Verify Email</a></body></html>'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('account-verification')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should correctly classify typical Figma password reset email', () => {
      const email: EmailToClassify = {
        from: 'no-reply@figma.com',
        to: 'bot@discubot.com',
        subject: 'Reset your Figma password',
        htmlBody: '<html><body><p>Someone requested a password reset for your account. If this was you, click below:</p><a href="https://figma.com/reset-password?token=xyz789">Reset Password</a></body></html>'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('password-reset')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should correctly classify typical Figma comment email', () => {
      const email: EmailToClassify = {
        from: 'comments@figma.com',
        to: 'bot@discubot.com',
        subject: 'John Smith commented on "Design System v2"',
        htmlBody: '<html><body><p><strong>John Smith</strong> left a comment:</p><blockquote>This looks great! Can we adjust the spacing?</blockquote><a href="https://figma.com/file/abc123?node-id=456">View in Figma</a></body></html>'
      }

      const result = classifyFigmaEmail(email)

      expect(result.messageType).toBe('comment')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
  })
})
