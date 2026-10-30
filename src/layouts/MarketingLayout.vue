<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import PublicHeader from '@/components/marketing/PublicHeader.vue'
import MarketingFooter from '@/components/marketing/MarketingFooter.vue'

const route = useRoute()

// A page that renders its own newsletter capture opts the footer's copy out,
// so the same form never appears twice in one view.
const showFooterNewsletter = computed(() => route.meta.hideFooterNewsletter !== true)
</script>

<template>
  <div class="relative flex min-h-dvh flex-col bg-canvas">
    <PublicHeader />

    <main id="main-content" class="relative z-10 flex-1" tabindex="-1">
      <RouterView />
    </main>

    <MarketingFooter :show-newsletter="showFooterNewsletter" />
  </div>
</template>
