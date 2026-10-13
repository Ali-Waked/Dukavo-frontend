import type { BadgeTone } from '@/components/ui/badgeTones'
import type { MessageKey } from '@/i18n'
import { CONTACT_STATUS, NEWSLETTER_STATUS, WAITLIST_STATUS, statusOptions } from './statuses'
import type { StatusMeta } from './statuses'
import type { ContactStatus, NewsletterStatus, WaitlistStatus } from '@/types/enums'

/**
 * Option shapes for <StatusSelect>, assembled once from the shared status
 * tables in `constants/statuses.ts`.
 *
 * `statuses.ts` remains the single source of truth for a status's tone and
 * label key — adding a server status there is one line — and this file only
 * translates that table into the shape the picker expects. There is no second
 * colour system here: `BadgeTone` is the same union the Orders badges use.
 */
export interface StatusSelectOption<T extends string = string> {
  value: T
  labelKey: MessageKey
  tone: BadgeTone
}

function fromGroup<T extends string>(group: Record<T, StatusMeta>): StatusSelectOption<T>[] {
  return statusOptions(group).map(({ value, meta }) => ({
    value,
    labelKey: meta.key,
    tone: meta.tone,
  }))
}

export const CONTACT_STATUS_OPTIONS: StatusSelectOption<ContactStatus>[] =
  fromGroup(CONTACT_STATUS)

export const NEWSLETTER_STATUS_OPTIONS: StatusSelectOption<NewsletterStatus>[] =
  fromGroup(NEWSLETTER_STATUS)

export const WAITLIST_STATUS_OPTIONS: StatusSelectOption<WaitlistStatus>[] =
  fromGroup(WAITLIST_STATUS)