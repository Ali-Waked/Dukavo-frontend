<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Store } from '@/components/icons'
import { useI18n, type MessageKey } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useToast } from '@/composables/useToast'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSpinner from '@/components/ui/BaseSpinner.vue'
import { ApiError } from '@/lib/axiosClient'
import { fetchWorkspaceSettings, updateWorkspaceSettings } from '@/services/tenantService'
import type { WorkspaceSettings } from '@/types/profile'

/**
 * The Workspace tab: the active tenant's identity and regional defaults.
 *
 * Read is gated on `settings.view`, write on `settings.manage` — the same slugs
 * the API enforces — so a viewer sees the values with every field disabled
 * rather than a form whose Save the server would refuse. The slug is shown but
 * never editable: it is the stable identifier other systems already hold.
 */

const { t } = useI18n()
const { store: auth } = useAuth()
const { can } = usePermissions()
const toast = useToast()

const settings = ref<WorkspaceSettings | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const generalError = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})

const form = reactive({
  name: '',
  contact_email: '',
  phone: '',
  currency: '',
  timezone: '',
  locale: '',
})

const canManage = computed(() => can('settings.manage'))

const languageOptions = computed(() => [
  { value: 'en', label: t('language.en') },
  { value: 'ar', label: t('language.ar') },
])

function applySettings(next: WorkspaceSettings): void {
  settings.value = next
  form.name = next.name
  form.contact_email = next.contact_email ?? ''
  form.phone = next.phone ?? ''
  form.currency = next.currency
  form.timezone = next.timezone
  form.locale = next.locale ?? ''
}

function clearErrors(): void {
  generalError.value = null
  for (const key of Object.keys(errors)) {
    delete errors[key]
  }
}

function captureApiError(error: unknown, fallbackKey: MessageKey): void {
  if (error instanceof ApiError && error.isValidation && error.fields) {
    for (const [field, messages] of Object.entries(error.fields)) {
      if (messages[0]) errors[field] = messages[0]
    }
    return
  }

  generalError.value = error instanceof ApiError ? error.message : t(fallbackKey)
}

onMounted(async () => {
  try {
    applySettings(await fetchWorkspaceSettings())
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : t('workspaceSettings.loadFailed')
  } finally {
    loading.value = false
  }
})

async function save(): Promise<void> {
  if (!canManage.value) {
    return
  }

  clearErrors()
  saving.value = true

  try {
    applySettings(
      await updateWorkspaceSettings({
        name: form.name.trim(),
        contact_email: form.contact_email.trim() || null,
        phone: form.phone.trim() || null,
        currency: form.currency.trim().toUpperCase(),
        timezone: form.timezone.trim(),
        locale: form.locale || null,
      }),
    )

    // The workspace name rides on the session, so refresh it to keep the
    // switcher and sidebar heading in step with the save.
    await auth.refreshSession()
    toast.success(t('workspaceSettings.saved'))
  } catch (error) {
    captureApiError(error, 'workspaceSettings.saveFailed')
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

    <template v-else-if="settings">
      <BaseAlert v-if="generalError" tone="danger" dismissible @dismiss="generalError = null">
        {{ generalError }}
      </BaseAlert>

      <BaseAlert v-if="!canManage" tone="info" :title="t('workspaceSettings.readOnlyTitle')">
        {{ t('workspaceSettings.readOnlyBody') }}
      </BaseAlert>

      <section class="surface p-5" :aria-label="t('workspaceSettings.identity')">
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <Store class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 class="text-h4 font-semibold text-ink">{{ t('workspaceSettings.identity') }}</h2>
            <p class="mt-1 text-small text-muted">{{ t('workspaceSettings.identityDesc') }}</p>
          </div>
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="save">
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="form.name"
              :label="t('common.name')"
              :error="errors.name"
              :disabled="!canManage"
              required
            />

            <BaseInput
              :model-value="settings.slug"
              :label="t('common.slug')"
              :hint="t('workspaceSettings.slugHint')"
              disabled
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="form.contact_email"
              type="email"
              :label="t('workspaceSettings.contactEmail')"
              :placeholder="t('common.optional')"
              :error="errors.contact_email"
              :disabled="!canManage"
            />

            <BaseInput
              v-model="form.phone"
              type="tel"
              :label="t('common.phone')"
              :placeholder="t('common.optional')"
              :error="errors.phone"
              :disabled="!canManage"
            />
          </div>

          <h3 class="pt-2 text-sm font-semibold text-ink">
            {{ t('workspaceSettings.region') }}
          </h3>

          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="form.currency"
              :label="t('common.currency')"
              :hint="t('workspaceSettings.currencyHint')"
              :error="errors.currency"
              :disabled="!canManage"
            />

            <BaseInput
              v-model="form.timezone"
              :label="t('common.timezone')"
              :hint="t('workspaceSettings.timezoneHint')"
              :error="errors.timezone"
              :disabled="!canManage"
            />
          </div>

          <BaseSelect
            v-model="form.locale"
            :label="t('common.locale')"
            :options="languageOptions"
            :error="errors.locale"
            :disabled="!canManage"
          />

          <div v-if="canManage" class="flex justify-end pt-1">
            <BaseButton type="submit" :loading="saving">
              {{ t('action.saveChanges') }}
            </BaseButton>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>
