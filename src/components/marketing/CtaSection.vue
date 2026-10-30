<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquare } from '@/components/icons'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useI18n } from '@/i18n'
import { useAuth } from '@/composables/useAuth'
import { useDashboardRoute } from '@/composables/useDashboardRoute'

/**
 * Shared call to action.
 *
 * Page authors may still choose an explicit destination; when they do not, the
 * defaults follow the visitor's session. A signed-in merchant must never be
 * invited to join the waitlist they have already left.
 */

const props = withDefaults(
  defineProps<{
    title: string
    body?: string
    primaryLabel?: string
    primaryTo?: string
    secondaryLabel?: string
    secondaryTo?: string
  }>(),
  {
    body: undefined,
    primaryLabel: undefined,
    primaryTo: undefined,
    secondaryLabel: undefined,
    secondaryTo: undefined,
  },
)

const { t } = useI18n()
const router = useRouter()
const { isAuthenticated } = useAuth()
const dashboardRoute = useDashboardRoute()

const resolvedPrimaryTo = computed(() =>
  props.primaryTo ?? (isAuthenticated.value ? dashboardRoute.value : '/waitlist'),
)
const resolvedPrimaryHref = computed(() => router.resolve(resolvedPrimaryTo.value).href)
const resolvedPrimaryLabel = computed(
  () =>
    props.primaryLabel ??
    (isAuthenticated.value ? t('nav.dashboard') : t('marketing.nav.waitlistCta')),
)
</script>

<template>
  <section class="pb-20 md:pb-28">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div
        class="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-14 text-center shadow-md md:px-12 md:py-16"
        data-aos="fade-up"
      >
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div class="absolute -start-16 -top-20 size-64 rounded-full bg-accent-400/10 blur-3xl" />
          <div class="absolute -bottom-24 -end-10 size-72 rounded-full bg-white/5 blur-3xl" />
        </div>

        <span class="relative mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-white/10 text-white">
          <slot name="icon">
            <MessageSquare class="size-6" aria-hidden="true" />
          </slot>
        </span>
        <h2 class="relative mx-auto max-w-xl text-h1 font-semibold tracking-tight text-white">
          {{ title }}
        </h2>
        <p v-if="body" class="relative mx-auto mt-3 max-w-xl text-lead text-white/80">
          {{ body }}
        </p>
        <div class="relative mt-8 flex flex-wrap justify-center gap-3">
          <slot name="actions">
            <BaseButton size="lg" variant="secondary" :to="resolvedPrimaryHref">
              {{ resolvedPrimaryLabel }}
            </BaseButton>
            <BaseButton
              v-if="secondaryLabel && secondaryTo"
              size="lg"
              variant="ghost"
              :to="secondaryTo"
              class="text-white hover:bg-white/10"
            >
              {{ secondaryLabel }}
            </BaseButton>
          </slot>
        </div>
      </div>
    </div>
  </section>
</template>
