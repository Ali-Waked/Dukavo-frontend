<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    align?: 'center' | 'start'
    compact?: boolean
  }>(),
  {
    eyebrow: undefined,
    description: undefined,
    align: 'center',
    compact: false,
  },
)
</script>

<template>
  <section
    class="relative overflow-hidden border-b border-line/60"
    :class="compact ? 'py-12 md:py-16' : 'py-16 md:py-24'"
  >
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-700/20" />
      <div class="absolute -end-24 top-10 size-64 rounded-full bg-accent-400/5 blur-3xl" />
    </div>

    <div
      class="mx-auto max-w-5xl px-4 md:px-6"
      :class="align === 'center' ? 'text-center' : 'text-start'"
    >
      <span
        v-if="eyebrow"
        class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-caption font-medium text-muted shadow-xs"
        data-aos="fade-up"
      >
        <span class="size-1.5 rounded-full bg-brand-700" aria-hidden="true" />
        {{ eyebrow }}
      </span>

      <h1
        class="mt-5 text-display font-semibold tracking-tight text-ink"
        data-aos="fade-up"
        data-aos-delay="40"
      >
        {{ title }}
      </h1>

      <p
        v-if="description"
        class="mt-5 text-lead text-muted"
        :class="align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'"
        data-aos="fade-up"
        data-aos-delay="80"
      >
        {{ description }}
      </p>

      <div
        v-if="$slots.actions"
        class="mt-8 flex flex-wrap gap-3"
        :class="align === 'center' ? 'justify-center' : 'justify-start'"
        data-aos="fade-up"
        data-aos-delay="120"
      >
        <slot name="actions" />
      </div>

      <div v-if="$slots.default" class="mt-10" data-aos="fade-up" data-aos-delay="160">
        <slot />
      </div>
    </div>
  </section>
</template>
