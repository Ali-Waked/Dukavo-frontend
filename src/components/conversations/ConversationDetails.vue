<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  Clock,
  Mail,
  Phone,
  UserPlus,
  Users,
  X,
} from '@/components/icons'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useI18n } from '@/i18n'
import { fetchConversationEvents } from '@/services/conversationService'
import type { Conversation, ConversationEvent } from '@/types/inbox'
import { formatDateTime, formatRelative } from '@/utils/format'
import { statusTone } from '@/utils/status'

const props = withDefaults(
  defineProps<{
    conversation: Conversation
    canAssign?: boolean
    dismissible?: boolean
    showHeader?: boolean
  }>(),
  { canAssign: false, dismissible: false, showHeader: true },
)

const emit = defineEmits<{
  assign: []
  status: []
  assignToMe: []
  close: []
}>()

const { t, tDynamic } = useI18n()

/**
 * The audit trail is fetched separately from the conversation so a slow or
 * failing activity read never delays the details panel the agent is using.
 */
const events = ref<ConversationEvent[]>([])
const eventsLoading = ref(false)
const eventsError = ref(false)
let eventsRequest = 0

async function loadEvents(id: number): Promise<void> {
  const request = ++eventsRequest
  eventsLoading.value = true
  eventsError.value = false

  try {
    const result = await fetchConversationEvents(id, { per_page: 8 })
    if (request === eventsRequest) events.value = result.data
  } catch {
    if (request === eventsRequest) eventsError.value = true
  } finally {
    if (request === eventsRequest) eventsLoading.value = false
  }
}

watch(
  () => props.conversation.id,
  (id) => void loadEvents(id),
  { immediate: true },
)

const name = computed(
  () =>
    props.conversation.customer?.name ||
    props.conversation.display_name ||
    props.conversation.phone ||
    t('conversations.unknownCustomer'),
)
const phone = computed(() => props.conversation.customer?.phone ?? props.conversation.phone)
const email = computed(() => props.conversation.customer?.email ?? null)
const windowExpiry = computed(() => props.conversation.reply_window?.expires_at ?? null)
const lastInbound = computed(() => props.conversation.last_inbound_at ?? null)
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col bg-surface" :aria-label="t('conversations.details')">
    <header
      v-if="showHeader"
      class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3"
    >
      <h2 class="text-h4 font-semibold text-ink">{{ t('conversations.details') }}</h2>
      <button
        v-if="dismissible"
        type="button"
        class="btn-icon"
        :aria-label="t('action.close')"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="border-b border-line px-5 py-5 text-center">
        <UserAvatar :name="name" size="lg" class="mx-auto" />
        <p class="mt-3 truncate text-body font-semibold text-ink">{{ name }}</p>
        <p v-if="phone" class="mt-0.5 text-small text-muted" dir="ltr">{{ phone }}</p>

        <div class="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <BaseBadge size="sm" tone="neutral">{{ t(`channel.${conversation.channel}`) }}</BaseBadge>
          <BaseBadge size="sm" dot :tone="statusTone(conversation.status)">
            {{ t(`status.conversation.${conversation.status}`) }}
          </BaseBadge>
          <BaseBadge v-if="conversation.unread_count > 0" size="sm" tone="brand">
            {{ t('conversations.unreadCount', { count: conversation.unread_count }) }}
          </BaseBadge>
        </div>
      </div>

      <div v-if="canAssign" class="border-b border-line px-5 py-4">
        <div class="flex flex-wrap gap-2">
          <BaseButton
            v-if="canAssign"
            size="sm"
            variant="secondary"
            :icon="Users"
            class="flex-1"
            @click="emit('assign')"
          >
            {{ t('action.assign') }}
          </BaseButton>
          <BaseButton size="sm" variant="secondary" :icon="Check" class="flex-1" @click="emit('status')">
            {{ t('conversations.changeStatus') }}
          </BaseButton>
        </div>
        <BaseButton
          v-if="canAssign"
          size="sm"
          variant="ghost"
          :icon="UserPlus"
          block
          class="mt-2"
          @click="emit('assignToMe')"
        >
          {{ t('conversations.assignToMe') }}
        </BaseButton>
      </div>

      <dl class="space-y-4 px-5 py-4 text-small">
        <div>
          <dt class="font-medium text-subtle">{{ t('conversations.assignedTo') }}</dt>
          <dd class="mt-1 text-ink">
            {{ conversation.assignee?.name ?? t('conversations.notAssigned') }}
          </dd>
        </div>

        <div v-if="conversation.subject">
          <dt class="font-medium text-subtle">{{ t('conversations.subject') }}</dt>
          <dd class="mt-1 break-words text-ink">{{ conversation.subject }}</dd>
        </div>

        <div>
          <dt class="font-medium text-subtle">{{ t('conversations.lastInbound') }}</dt>
          <dd class="mt-1 text-ink">
            {{ lastInbound ? formatRelative(lastInbound) : t('conversations.never') }}
          </dd>
        </div>

        <div v-if="conversation.channel === 'whatsapp'">
          <dt class="flex items-center gap-1.5 font-medium text-subtle">
            <Clock class="size-3.5" aria-hidden="true" />
            {{ t('conversations.replyWindow') }}
          </dt>
          <dd class="mt-1">
            <span v-if="conversation.reply_window.is_open" class="text-success-ink">
              {{ t('conversations.windowOpen') }}
            </span>
            <span v-else class="text-warning-ink">{{ t('conversations.windowClosed') }}</span>
            <span v-if="windowExpiry" class="mt-0.5 block text-caption text-subtle">
              {{ formatDateTime(windowExpiry) }}
            </span>
          </dd>
        </div>

        <div>
          <dt class="font-medium text-subtle">{{ t('conversations.started') }}</dt>
          <dd class="mt-1 text-ink">
            {{ conversation.created_at ? formatDateTime(conversation.created_at) : '—' }}
          </dd>
        </div>

        <div v-if="email">
          <dt class="font-medium text-subtle">{{ t('conversations.email') }}</dt>
          <dd class="mt-1">
            <a :href="`mailto:${email}`" class="inline-flex min-w-0 items-center gap-1.5 text-brand-ink hover:underline">
              <Mail class="size-3.5 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ email }}</span>
            </a>
          </dd>
        </div>

        <div v-if="phone">
          <dt class="font-medium text-subtle">{{ t('conversations.phone') }}</dt>
          <dd class="mt-1">
            <a :href="`tel:${phone}`" class="inline-flex items-center gap-1.5 text-brand-ink hover:underline" dir="ltr">
              <Phone class="size-3.5" aria-hidden="true" />
              {{ phone }}
            </a>
          </dd>
        </div>
      </dl>

      <section class="border-t border-line px-5 py-4" :aria-label="t('conversations.activity')">
        <h3 class="text-caption font-semibold uppercase tracking-wide text-subtle">
          {{ t('conversations.activity') }}
        </h3>

        <p v-if="eventsLoading" class="mt-2 text-small text-muted">
          {{ t('state.loading') }}
        </p>
        <p v-else-if="eventsError" class="mt-2 text-small text-muted">
          {{ t('conversations.activityFailed') }}
        </p>
        <p v-else-if="events.length === 0" class="mt-2 text-small text-muted">
          {{ t('conversations.activityEmpty') }}
        </p>
        <ol v-else class="mt-3 space-y-3">
          <li v-for="event in events" :key="event.id" class="flex gap-2.5">
            <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
            <div class="min-w-0">
              <p class="text-small text-ink">{{ tDynamic('conversationEvent', event.action) }}</p>
              <p class="text-caption text-subtle">
                {{ event.user?.name ?? t('conversations.systemActor') }}
                <template v-if="event.created_at">
                  · {{ formatRelative(event.created_at) }}
                </template>
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </aside>
</template>
