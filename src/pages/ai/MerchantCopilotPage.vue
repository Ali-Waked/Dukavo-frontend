<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Activity, Sparkles, FileText, AlertTriangle, ExternalLink } from '@/components/icons'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { askMerchantCopilot } from '@/services/aiService'
import { fetchStores } from '@/services/storeService'
import type { MerchantCopilotAnswer } from '@/types/merchant'
import type { Store } from '@/types/catalogue'
import { aiErrorMessage } from '@/utils/ai'

const { t } = useI18n()
const { store: auth } = useAuth()

const canUse = computed(() => auth.can('ai.use'))
const canViewDashboard = computed(() => auth.can('dashboard.view'))

const stores = ref<Store[]>([])
const storeId = ref<string>('')
const from = ref('')
const until = ref('')

const question = ref('')
const suggested = [
  'Which products drove revenue in this period?',
  'What is at risk of going out of stock?',
  'How healthy is gross margin right now?',
  'What should I focus on first this week?',
]

const loading = ref(false)
const error = ref<string | null>(null)
const answer = ref<MerchantCopilotAnswer | null>(null)

const storeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...stores.value.map((s) => ({ value: String(s.id), label: s.name })),
])

function defaultRange(): void {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  from.value = start.toISOString().slice(0, 10)
  until.value = end.toISOString().slice(0, 10)
}

function useSuggestion(s: string): void {
  question.value = s
}

async function loadStores(): Promise<void> {
  if (!canViewDashboard.value) return
  try {
    stores.value = await fetchStores({ activeOnly: false })
  } catch {
    stores.value = []
  }
}

async function ask(): Promise<void> {
  if (!canUse.value || loading.value || question.value.trim() === '' || from.value === '' || until.value === '') return
  loading.value = true
  error.value = null
  try {
    answer.value = await askMerchantCopilot({
      question: question.value.trim(),
      store_id: storeId.value === '' ? null : Number(storeId.value),
      from: from.value,
      until: until.value,
    })
  } catch (caught) {
    answer.value = null
    error.value = aiErrorMessage(caught, t)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  defaultRange()
  void loadStores()
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader :title="t('ai.merchantCopilot.title')" :description="t('ai.merchantCopilot.subtitle')" />

    <BaseAlert v-if="!canUse" tone="warning">
      {{ t('ai.merchantCopilot.noPermission') }}
    </BaseAlert>
    <BaseAlert v-else-if="!canViewDashboard" tone="warning">
      {{ t('ai.merchantCopilot.needDashboard') }}
    </BaseAlert>

    <template v-if="canUse && canViewDashboard">
      <BaseCard>
        <div class="space-y-4 p-5">
          <div class="flex flex-wrap items-end gap-3">
            <BaseSelect v-if="stores.length > 0" v-model="storeId" class="w-56" :label="t('common.store')" :options="storeOptions" />
            <BaseInput v-model="from" type="date" class="w-44" :label="t('common.from')" />
            <BaseInput v-model="until" type="date" class="w-44" :label="t('common.to')" />
          </div>
          <BaseInput v-model="question" :label="t('ai.merchantCopilot.questionLabel')" :placeholder="t('ai.merchantCopilot.questionPlaceholder')" />
          <div class="flex flex-wrap gap-2">
            <BaseButton v-for="s in suggested" :key="s" size="sm" variant="ghost" @click="useSuggestion(s)">
              {{ s }}
            </BaseButton>
          </div>
          <BaseButton :icon="Sparkles" :loading="loading" :disabled="question.trim() === ''" @click="ask">
            {{ t('ai.merchantCopilot.ask') }}
          </BaseButton>
        </div>
      </BaseCard>

      <BaseAlert v-if="error" tone="danger" dismissible @dismiss="error = null">
        {{ error }}
      </BaseAlert>

      <div v-if="loading" class="space-y-3">
        <BaseSkeleton height="h-4" block />
        <BaseSkeleton class="w-5/6" height="h-4" block />
        <BaseSkeleton height="h-24" block />
      </div>

      <template v-if="answer">
        <BaseCard>
          <div class="space-y-4 p-5">
            <div class="flex items-center gap-2">
              <Activity class="size-4 text-muted" />
              <h2 class="text-h4 font-semibold text-ink">{{ t('ai.merchantCopilot.answer') }}</h2>
            </div>
            <p class="whitespace-pre-wrap text-body leading-relaxed text-ink">{{ answer.answer }}</p>
            <p class="text-caption text-muted">
              {{ t('ai.merchantCopilot.period') }}: {{ answer.period.from }} – {{ answer.period.until }}
              <span v-if="answer.scope.store_name"> · {{ answer.scope.store_name }}</span>
              <span v-else> · {{ t('common.all') }}</span>
              <span v-if="answer.scope.currency"> · {{ answer.scope.currency }}</span>
            </p>
          </div>
        </BaseCard>

        <BaseCard v-if="answer.metric_explanations.length > 0">
          <div class="space-y-3 p-5">
            <div class="flex items-center gap-2">
              <FileText class="size-4 text-muted" />
              <h3 class="text-h5 font-semibold text-ink">{{ t('ai.merchantCopilot.metrics') }}</h3>
            </div>
            <ul class="space-y-2">
              <li v-for="m in answer.metric_explanations" :key="m.metric" class="rounded-lg border border-line p-3">
                <p class="text-sm font-medium text-ink">{{ m.metric }}</p>
                <p class="text-small text-muted">{{ m.definition }}</p>
                <p class="text-caption text-subtle">{{ t('ai.merchantCopilot.source') }}: {{ m.source }}</p>
              </li>
            </ul>
          </div>
        </BaseCard>

        <BaseCard v-if="answer.action_previews.length > 0">
          <div class="space-y-3 p-5">
            <div class="flex items-center gap-2">
              <ExternalLink class="size-4 text-muted" />
              <h3 class="text-h5 font-semibold text-ink">{{ t('ai.merchantCopilot.actions') }}</h3>
            </div>
            <ul class="space-y-2">
              <li v-for="a in answer.action_previews" :key="a.label" class="rounded-lg border border-line p-3">
                <p class="text-sm font-medium text-ink">{{ a.label }}</p>
                <p class="text-small text-muted">{{ a.reason }}</p>
                <p class="text-caption text-subtle">{{ a.link_hint }}</p>
              </li>
            </ul>
          </div>
        </BaseCard>

        <BaseCard v-if="answer.missing_or_insufficient.length > 0 || answer.data_gaps.length > 0">
          <div class="space-y-3 p-5">
            <div class="flex items-center gap-2">
              <AlertTriangle class="size-4 text-warning-ink" />
              <h3 class="text-h5 font-semibold text-ink">{{ t('ai.merchantCopilot.gaps') }}</h3>
            </div>
            <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
              <li v-for="g in answer.missing_or_insufficient" :key="g">{{ g }}</li>
              <li v-for="g in answer.data_gaps" :key="g">{{ g }}</li>
            </ul>
          </div>
        </BaseCard>

        <p class="text-caption text-subtle">
          {{ t('ai.merchantCopilot.usage', { model: answer.usage.model, tokens: answer.usage.total_tokens }) }}
        </p>
      </template>
    </template>
  </div>
</template>
