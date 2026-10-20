<script setup lang="ts">
import { onMounted } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AOS from 'aos'
import 'aos/dist/aos.css'

onMounted(() => {
  AOS.init({
    duration: 600,
    easing: 'ease-out-quart',
    once: false,
  })
})
</script>

<template>
  <section class="relative overflow-hidden pb-20 pt-16 md:pb-32 md:pt-24">
    <div class="absolute inset-0 -z-10">
      <div class="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-brand-100/40 to-transparent dark:from-brand-700/20"></div>
    </div>
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted" data-aos="fade-up">
            <span class="size-1.5 rounded-full bg-brand-700"></span>
            <span>مصمم خصيصًا لتجار الواتساب</span>
          </div>
          <h1 class="text-display font-semibold tracking-tight text-ink" data-aos="fade-up" data-aos-delay="100">
            أدر متجرك بالكامل من مكان واحد
          </h1>
          <p class="mt-6 text-lead text-muted" data-aos="fade-up" data-aos-delay="150">
            المنتجات، المخزون، الطلبات، العملاء ومحادثات WhatsApp — كل ما تحتاجه لإدارة تجارتك في منصة واحدة.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3" data-aos="fade-up" data-aos-delay="200">
            <BaseButton size="lg" variant="secondary" to="/how-it-works">
              شاهد كيف يعمل Dukavo
            </BaseButton>
          </div>
        </div>
        <div class="relative" data-aos="fade-up" data-aos-delay="250">
          <div class="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div class="h-8 border-b border-line bg-surface-2"></div>
            <img
              src="/dashboard-preview.png"
              alt="Dukavo dashboard preview"
              class="w-full h-auto"
              onerror="this.src='https://placehold.co/1600/1200/e2e8f0/0f172a?text=Dukavo+Dashboard'"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
