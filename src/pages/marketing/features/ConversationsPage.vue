<script setup lang="ts">
import AOS from 'aos'
import 'aos/dist/aos.css'
import { onMounted } from 'vue'

onMounted(() => {
  AOS.init({ duration: 600, once: false })
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
    <div class="text-center" data-aos="fade-up">
      <h1 class="text-h1 font-semibold text-ink">ميزة قيد التطوير</h1>
      <p class="mt-3 text-muted">ستتوفر قريبًا</p>
    </div>
  </div>
</template>
