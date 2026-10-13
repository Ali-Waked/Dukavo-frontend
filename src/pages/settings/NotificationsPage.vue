<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bell, Mail, MessageCircle } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'
import { useToast } from '@/composables/useToast'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { ApiError } from '@/lib/axiosClient'
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/profileService'
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationPreferences,
} from '@/types/profile'

/**
 * The Notifications tab.
 *
 * The catalogue comes from the same constant the backend generates its rules
 * from, so the two can never disagree about which switches exist. Loading
 * returns the *resolved* set (defaults merged in), so a toggle always reflects
 * what will actually happen rather than an absent column.
 */

const { t, tDynamic } = useI18n()
const toast = useToast()

const preferences = ref<NotificationPreferences | null>(null)
const loading = ref(true)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

const CHANNEL_META: Record<
  NotificationChannel,
  { icon: typeof Mail; labelKey: MessageKey; descKey: MessageKey }
> = {
  email: { icon: Mail, labelKey: 'notifications.channel.email', descKey: 'notifications.channel.emailDesc' },
  whatsapp: {
    icon: MessageCircle,
    labelKey: 'notifications.channel.whatsapp',
    descKey: 'notifications.channel.whatsappDesc',
  },
}

const channels = computed(() =>
  (Object.keys(NOTIFICATION_CHANNELS) as NotificationChannel[]).map((channel) => ({
    key: channel,
    icon: CHANNEL_META[channel].icon,
    label: t(CHANNEL_META[channel].labelKey),
    description: t(CHANNEL_META[channel].descKey),
    events: NOTIFICATION_CHANNELS[channel].map((event) => ({
      key: event,
      label: tDynamic('notifications.event', event),
      hint: tDynamic('notifications.eventHint', event),
    })),
  })),
)

onMounted(async () => {
  try {
    preferences.value = await fetchNotificationPreferences()
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : t('notifications.loadFailed')
  } finally {
    loading.value = false
  }
})

function isOn(channel: NotificationChannel, event: string): boolean {
  return preferences.value?.[channel]?.[event] ?? false
}

function setOn(channel: NotificationChannel, event: string, value: boolean): void {
  if (!preferences.value) {
    return
  }

  preferences.value[channel][event] = value
}

async function save(): Promise<void> {
  if (!preferences.value) {
    return
  }

  saveError.value = null
  saving.value = true

  try {
    preferences.value = await updateNotificationPreferences(preferences.value)
    toast.success(t('notifications.saved'))
  } catch (error) {
    saveError.value = error instanceof ApiError ? error.message : t('notifications.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="grid place-items-center py-24">
      <BaseSpinner />
    </div>

    <BaseAlert v-else-if="loadError" tone="danger">{{ loadError }}</BaseAlert>

    <template v-else-if="preferences">
      <BaseAlert v-if="saveError" tone="danger" dismissible @dismiss="saveError = null">
        {{ saveError }}
      </BaseAlert>

      <section
        v-for="channel in channels"
        :key="channel.key"
        class="surface p-5"
        :aria-label="channel.label"
      >
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <component :is="channel.icon" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 class="text-h4 font-semibold text-ink">{{ channel.label }}</h2>
            <p class="mt-1 text-small text-muted">{{ channel.description }}</p>
          </div>
        </div>

        <div class="mt-4 space-y-4 border-t border-line pt-4">
          <BaseSwitch
            v-for="event in channel.events"
            :key="event.key"
            :model-value="isOn(channel.key, event.key)"
            :label="event.label"
            :hint="event.hint"
            @update:model-value="setOn(channel.key, event.key, $event)"
          />
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="flex items-center gap-2 text-small text-muted">
          <Bell class="size-4 shrink-0" aria-hidden="true" />
          {{ t('notifications.securityNote') }}
        </p>
        <BaseButton :loading="saving" @click="save">
          {{ t('action.saveChanges') }}
        </BaseButton>
      </div>
    </template>
  </div>
</template>
