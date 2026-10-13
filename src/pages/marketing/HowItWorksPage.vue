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
      <h1 class="text-h1 font-semibold text-ink">كيف يعمل Dukavo</h1>
      <p class="mt-3 text-muted">خطوات بسيطة للبدء</p>
    </div>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="surface p-6 text-center" data-aos="fade-up">
        <div class="mx-auto grid size-10 place-items-center rounded-full bg-brand-soft text-brand-ink">01</div>
        <h3 class="mt-4 text-h3 font-semibold text-ink">سجّل</h3>
        <p class="mt-2 text-muted">أنشئ حسابك في ثوانٍ</p>
      </div>
      <div class="surface p-6 text-center" data-aos="fade-up" data-aos-delay="50">
        <div class="mx-auto grid size-10 place-items-center rounded-full bg-brand-soft text-brand-ink">02</div>
        <h3 class="mt-4 text-h3 font-semibold text-ink">أضف منتجاتك</h3>
        <p class="mt-2 text-muted">أضف منتجاتك وصورك</p>
      </div>
      <div class="surface p-6 text-center" data-aos="fade-up" data-aos-delay="100">
        <div class="mx-auto grid size-10 place-items-center rounded-full bg-brand-soft text-brand-ink">03</div>
        <h3 class="mt-4 text-h3 font-semibold text-ink">اربط WhatsApp</h3>
        <p class="mt-2 text-muted">ابدأ في استقبال الطلبات</p>
      </div>
    </div>
  </div>
</template>
