<script setup lang="ts">
import logoIcon from '@/assets/logo/logo-icon.png'
import logoFull from '@/assets/logo/logo-full.png'

interface Props {
  variant: 'full' | 'icon'
  height?: number | string
  className?: string
  alt?: string
}

withDefaults(defineProps<Props>(), {
  height: 36,
  className: '',
  alt: 'Dukavo',
})
</script>

<template>
  <img
    v-if="variant === 'icon'"
    :src="logoIcon"
    :alt="alt"
    :height="height"
    :class="className"
    loading="lazy"
  />
  <img
    v-else-if="variant === 'full'"
    :src="logoFull"
    :alt="alt"
    :height="height"
    :class="className"
    loading="lazy"
  />
</template>
