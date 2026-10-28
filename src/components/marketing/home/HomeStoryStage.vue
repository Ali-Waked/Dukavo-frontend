<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useLocale } from '@/composables/useLocale'
import StorySceneConversation from './scenes/StorySceneConversation.vue'
import StorySceneCustomer from './scenes/StorySceneCustomer.vue'
import StorySceneOrder from './scenes/StorySceneOrder.vue'
import StorySceneInventory from './scenes/StorySceneInventory.vue'
import StorySceneTeam from './scenes/StorySceneTeam.vue'

const props = defineProps<{
  /** Which scene to show — matches the step ids of the story. */
  stepId: string
  /** Direction of the step change — `1` forward, `-1` backward. */
  direction: 1 | -1
}>()

const { dir } = useLocale()

const SCENES: Record<string, Component> = {
  conversation: StorySceneConversation,
  customer: StorySceneCustomer,
  order: StorySceneOrder,
  inventory: StorySceneInventory,
  team: StorySceneTeam,
}

const scene = computed<Component>(() => SCENES[props.stepId] ?? StorySceneConversation)

// Direction-aware slide: forward enters from the side the reading starts in,
// so the motion mirrors naturally for RTL scripts.
const slide = computed(() => {
  const forward = props.direction * (dir.value === 'rtl' ? -1 : 1)
  return forward > 0 ? 'story-slide-right' : 'story-slide-left'
})
</script>

<template>
  <div
    class="story-stage flex min-h-[252px] items-center justify-center rounded-xl border border-line bg-canvas p-5 md:min-h-[268px]"
  >
    <Transition :name="slide" mode="out-in">
      <component :is="scene" :key="stepId" class="w-full" />
    </Transition>
  </div>
</template>

<style scoped>
.story-slide-right-enter-active {
  transition:
    opacity 0.32s var(--ease-out-quart),
    transform 0.32s var(--ease-out-quart);
}

.story-slide-right-leave-active {
  transition: opacity 0.18s ease;
}

.story-slide-right-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}

.story-slide-right-leave-to {
  opacity: 0;
  transform: translateX(-0.5rem);
}

.story-slide-left-enter-active {
  transition:
    opacity 0.32s var(--ease-out-quart),
    transform 0.32s var(--ease-out-quart);
}

.story-slide-left-leave-active {
  transition: opacity 0.18s ease;
}

.story-slide-left-enter-from {
  opacity: 0;
  transform: translateX(-1rem);
}

.story-slide-left-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}

/*
 * Reduced motion: one switch stops every scene choreography inside the stage.
 * Each scene's resting (no-animation) styles are its finished state, so
 * everything simply reads as complete — no autoplay, no partial reveals.
 */
@media (prefers-reduced-motion: reduce) {
  .story-stage :deep(*),
  .story-stage :deep(*::before),
  .story-stage :deep(*::after) {
    animation: none !important;
  }
}
</style>
