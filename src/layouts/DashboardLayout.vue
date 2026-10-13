<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Topbar from '@/components/layout/Topbar.vue'
</script>

<template>
  <div class="min-h-dvh bg-canvas">
    <Sidebar />
    <div class="flex min-h-dvh flex-col lg:ps-72">
      <Topbar />
      <main id="main-content" class="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>