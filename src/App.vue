<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastHost from '@/components/feedback/ToastHost.vue'
</script>

<template>
  <a
    href="#main-content"
    class="sr-only z-[80] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
  >
    Skip to content
  </a>

  <RouterView v-slot="{ Component, route }">
    <Transition name="page" mode="out-in" appear>
      <component :is="Component" :key="route.name ?? route.path" />
    </Transition>
  </RouterView>

  <ToastHost />
</template>