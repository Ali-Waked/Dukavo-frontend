<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, RefreshCw, ZoomIn, ZoomOut } from '@/components/icons'
import { useI18n } from '@/i18n'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  calculateCropGeometry,
  clamp,
  type CropGeometry,
} from '@/utils/avatarCrop'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import BaseSpinner from './BaseSpinner.vue'

const OUTPUT_SIZE = 512
const PREVIEW_SIZE = 64
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const PAN_STEP = 14

const props = withDefaults(
  defineProps<{
    open: boolean
    file?: File | null
    saving?: boolean
    error?: string | null
  }>(),
  {
    file: null,
    saving: false,
    error: null,
  },
)

const emit = defineEmits<{
  close: []
  save: [file: File]
}>()

const { t } = useI18n()

const stage = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const preview = ref<HTMLCanvasElement | null>(null)
const stageSize = ref(0)
const zoom = ref(MIN_ZOOM)
const offsetX = ref(0)
const offsetY = ref(0)
const loading = ref(false)
const loaded = ref(false)
const localError = ref<string | null>(null)
const exporting = ref(false)

let image: HTMLImageElement | null = null
let objectUrl: string | null = null
let resizeObserver: ResizeObserver | null = null
let frameHandle = 0
let loadToken = 0
let webpSupport: boolean | null = null

interface PointerPosition {
  x: number
  y: number
}

interface DragOrigin {
  pointerId: number
  x: number
  y: number
  offsetX: number
  offsetY: number
}

interface PinchOrigin {
  distance: number
  zoom: number
  offsetX: number
  offsetY: number
  midpointX: number
  midpointY: number
}

const pointers = new Map<number, PointerPosition>()
let dragOrigin: DragOrigin | null = null
let pinchOrigin: PinchOrigin | null = null

const busy = computed(() => props.saving || exporting.value)
const shownError = computed(() => props.error ?? localError.value)
const canInteract = computed(() => loaded.value && stageSize.value > 0 && !busy.value)
const canSave = computed(() => canInteract.value && !loading.value)

function releaseObjectUrl(): void {
  if (objectUrl !== null) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function releaseImage(): void {
  if (image !== null) {
    image.onload = null
    image.onerror = null
    image.src = ''
    image = null
  }
}

function cleanup(): void {
  loadToken += 1
  cancelAnimationFrame(frameHandle)
  releaseObjectUrl()
  releaseImage()
  pointers.clear()
  dragOrigin = null
  pinchOrigin = null
  stageSize.value = 0
  zoom.value = MIN_ZOOM
  offsetX.value = 0
  offsetY.value = 0
  loading.value = false
  loaded.value = false
  exporting.value = false
  localError.value = null
}

async function load(file: File): Promise<void> {
  cleanup()
  loading.value = true
  localError.value = null

  const token = loadToken
  objectUrl = URL.createObjectURL(file)
  const next = new Image()
  next.decoding = 'async'
  next.onload = async (): Promise<void> => {
    if (token !== loadToken) {
      return
    }

    if (next.naturalWidth < 1 || next.naturalHeight < 1) {
      loading.value = false
      localError.value = t('profile.crop.loadFailed')
      releaseObjectUrl()
      next.src = ''
      return
    }

    image = next
    loaded.value = true
    loading.value = false
    releaseObjectUrl()
    await nextTick()
    clampOffsets()
    render()
  }
  next.onerror = (): void => {
    if (token !== loadToken) {
      return
    }

    loading.value = false
    localError.value = t('profile.crop.loadFailed')
    releaseObjectUrl()
    next.src = ''
  }
  next.src = objectUrl
}

function geometry(): CropGeometry | null {
  if (!image) {
    return null
  }

  return calculateCropGeometry({
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    stageSize: stageSize.value,
    zoom: zoom.value,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
  })
}

function clampOffsets(): void {
  const next = geometry()

  if (!next) {
    return
  }

  offsetX.value = next.offsetX
  offsetY.value = next.offsetY
}

function drawMain(target: CanvasRenderingContext2D, crop: CropGeometry): void {
  if (!image) {
    return
  }

  const size = stageSize.value
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const pixels = Math.round(size * dpr)
  const element = canvas.value

  if (!element) {
    return
  }

  if (element.width !== pixels || element.height !== pixels) {
    element.width = pixels
    element.height = pixels
  }

  target.setTransform(1, 0, 0, 1, 0, 0)
  target.clearRect(0, 0, pixels, pixels)
  target.setTransform(dpr, 0, 0, dpr, 0, 0)
  target.imageSmoothingEnabled = true
  target.imageSmoothingQuality = 'high'
  target.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceSize, crop.sourceSize, 0, 0, size, size)
}

function drawPreview(crop: CropGeometry): void {
  const element = preview.value

  if (!element || !image) {
    return
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixels = Math.round(PREVIEW_SIZE * dpr)

  if (element.width !== pixels || element.height !== pixels) {
    element.width = pixels
    element.height = pixels
  }

  const target = element.getContext('2d')

  if (!target) {
    return
  }

  target.setTransform(1, 0, 0, 1, 0, 0)
  target.clearRect(0, 0, pixels, pixels)
  target.setTransform(dpr, 0, 0, dpr, 0, 0)
  target.imageSmoothingEnabled = true
  target.imageSmoothingQuality = 'high'
  target.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
    0,
    0,
    PREVIEW_SIZE,
    PREVIEW_SIZE,
  )
}

function render(): void {
  cancelAnimationFrame(frameHandle)
  frameHandle = requestAnimationFrame(() => {
    const crop = geometry()
    const target = canvas.value?.getContext('2d')

    if (!crop || !target) {
      return
    }

    drawMain(target, crop)
    drawPreview(crop)
  })
}

function supportsWebp(): boolean {
  if (webpSupport !== null) {
    return webpSupport
  }

  try {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp')
    probe.width = 0
    probe.height = 0
  } catch {
    webpSupport = false
  }

  return webpSupport
}

function canvasToBlob(element: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    element.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('The browser could not export the cropped image.'))
        }
      },
      type,
      quality,
    )
  })
}

async function cropToFile(crop: CropGeometry): Promise<File> {
  if (!image) {
    throw new Error('No image is loaded.')
  }

  const element = document.createElement('canvas')
  element.width = OUTPUT_SIZE
  element.height = OUTPUT_SIZE
  const target = element.getContext('2d')

  if (!target) {
    throw new Error('The browser could not create the crop canvas.')
  }

  target.imageSmoothingEnabled = true
  target.imageSmoothingQuality = 'high'
  target.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  const preferredType = supportsWebp() ? 'image/webp' : 'image/png'
  const blob = await canvasToBlob(element, preferredType, preferredType === 'image/webp' ? 0.92 : undefined)
  element.width = 0
  element.height = 0

  const extension = blob.type === 'image/webp' ? 'webp' : 'png'

  return new File([blob], `avatar-${Date.now()}.${extension}`, { type: blob.type })
}

function beginPinch(): void {
  const positions = [...pointers.values()]
  const first = positions[0]
  const second = positions[1]

  if (!first || !second) {
    return
  }

  pinchOrigin = {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    zoom: zoom.value,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
    midpointX: (first.x + second.x) / 2,
    midpointY: (first.y + second.y) / 2,
  }
}

function onPointerDown(event: PointerEvent): void {
  if (!canInteract.value) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const element = stage.value

  if (!element) {
    return
  }

  element.setPointerCapture?.(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size === 1) {
    dragOrigin = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: offsetX.value,
      offsetY: offsetY.value,
    }
    pinchOrigin = null
  } else if (pointers.size === 2) {
    dragOrigin = null
    beginPinch()
  }

  event.preventDefault()
}

function onPointerMove(event: PointerEvent): void {
  if (!pointers.has(event.pointerId)) {
    return
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size >= 2) {
    const positions = [...pointers.values()]
    const first = positions[0]
    const second = positions[1]

    if (!first || !second || !pinchOrigin || pinchOrigin.distance <= 0) {
      return
    }

    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    const midpointX = (first.x + second.x) / 2
    const midpointY = (first.y + second.y) / 2

    zoom.value = clamp(
      pinchOrigin.zoom * (distance / pinchOrigin.distance),
      MIN_ZOOM,
      MAX_ZOOM,
    )
    offsetX.value = pinchOrigin.offsetX + (midpointX - pinchOrigin.midpointX)
    offsetY.value = pinchOrigin.offsetY + (midpointY - pinchOrigin.midpointY)
    clampOffsets()
    render()
    event.preventDefault()
    return
  }

  if (!dragOrigin || dragOrigin.pointerId !== event.pointerId) {
    return
  }

  offsetX.value = dragOrigin.offsetX + (event.clientX - dragOrigin.x)
  offsetY.value = dragOrigin.offsetY + (event.clientY - dragOrigin.y)
  clampOffsets()
  render()
  event.preventDefault()
}

function onPointerUp(event: PointerEvent): void {
  const element = stage.value
  pointers.delete(event.pointerId)

  if (element?.hasPointerCapture(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }

  if (pointers.size === 1) {
    const [remaining] = pointers.entries()
    const [pointerId, position] = remaining ?? []

    dragOrigin = pointerId !== undefined && position
      ? {
          pointerId,
          x: position.x,
          y: position.y,
          offsetX: offsetX.value,
          offsetY: offsetY.value,
        }
      : null
    pinchOrigin = null
  } else if (pointers.size === 0) {
    dragOrigin = null
    pinchOrigin = null
  }
}

function changeZoom(next: number): void {
  zoom.value = clamp(next, MIN_ZOOM, MAX_ZOOM)
  clampOffsets()
  render()
}

function stepZoom(direction: -1 | 1): void {
  changeZoom(zoom.value + direction * 0.15)
}

function resetCrop(): void {
  zoom.value = MIN_ZOOM
  offsetX.value = 0
  offsetY.value = 0
  render()
}

function onWheel(event: WheelEvent): void {
  if (!canInteract.value) {
    return
  }

  changeZoom(zoom.value * Math.exp(-event.deltaY * 0.0015))
}

function onKeydown(event: KeyboardEvent): void {
  if (!canInteract.value) {
    return
  }

  let handled = true

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      const move = event.shiftKey ? PAN_STEP * 3 : PAN_STEP
      if (event.key === 'ArrowLeft') offsetX.value -= move
      if (event.key === 'ArrowRight') offsetX.value += move
      if (event.key === 'ArrowUp') offsetY.value -= move
      if (event.key === 'ArrowDown') offsetY.value += move
      clampOffsets()
      render()
      break
    }
    case '+':
    case '=':
      stepZoom(1)
      break
    case '-':
    case '_':
      stepZoom(-1)
      break
    case '0':
      resetCrop()
      break
    default:
      handled = false
  }

  if (handled) {
    event.preventDefault()
  }
}

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  localError.value = null
  const crop = geometry()

  if (!crop) {
    localError.value = t('profile.crop.invalid')
    return
  }

  exporting.value = true

  try {
    const file = await cropToFile(crop)

    if (file.size > MAX_UPLOAD_BYTES) {
      localError.value = t('profile.crop.outputTooLarge')
      return
    }

    emit('save', file)
  } catch {
    localError.value = t('profile.crop.exportFailed')
  } finally {
    exporting.value = false
  }
}

function requestClose(): void {
  if (busy.value) {
    return
  }

  emit('close')
}

watch(
  [() => props.open, () => props.file],
  ([open, file]) => {
    if (open && file) {
      void load(file)
      return
    }

    cleanup()
  },
  { immediate: true },
)

watch(stage, (element, _, onCleanup) => {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (!element) {
    stageSize.value = 0
    return
  }

  const measure = (): void => {
    stageSize.value = Math.max(0, Math.round(element.getBoundingClientRect().width))
  }

  measure()

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(element)
  onCleanup(() => resizeObserver?.disconnect())
})

watch(stageSize, () => {
  clampOffsets()
  render()
})

watch(zoom, () => {
  clampOffsets()
  render()
})

watch([offsetX, offsetY], render)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cleanup()
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('profile.crop.title')"
    :description="t('profile.crop.description')"
    size="lg"
    :persistent="busy"
    @close="requestClose"
  >
    <div class="space-y-5">
      <BaseAlert v-if="shownError" tone="danger">
        {{ shownError }}
      </BaseAlert>

      <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
        <div
          ref="stage"
          class="relative aspect-square w-full max-w-[22rem] touch-none select-none overflow-hidden rounded-full bg-surface-3 shadow-xl outline outline-2 outline-white/80 dark:outline-line-strong"
          role="group"
          tabindex="0"
          :aria-label="t('profile.crop.stageLabel')"
          :aria-describedby="'avatar-crop-hint'"
          :class="canInteract ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
          @keydown="onKeydown"
        >
          <canvas ref="canvas" class="size-full" aria-hidden="true" />

          <div
            v-if="loading || !loaded"
            class="absolute inset-0 grid place-items-center bg-surface-3/90"
          >
            <BaseSpinner size="lg" :label="t('profile.crop.loading')" />
          </div>
        </div>

        <div class="flex shrink-0 flex-col items-center gap-2">
          <div class="size-16 overflow-hidden rounded-full border border-line bg-surface-3 shadow-inner">
            <canvas ref="preview" class="size-full" aria-hidden="true" />
          </div>
          <p class="text-caption font-semibold uppercase tracking-wide text-subtle">
            {{ t('profile.crop.preview') }}
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn-icon shrink-0 border border-line bg-surface"
            :disabled="!canInteract || zoom <= MIN_ZOOM"
            :aria-label="t('profile.crop.zoomOut')"
            @click="stepZoom(-1)"
          >
            <ZoomOut class="size-5" />
          </button>

          <label for="avatar-crop-zoom" class="sr-only">{{ t('profile.crop.zoom') }}</label>
          <input
            id="avatar-crop-zoom"
            v-model.number="zoom"
            type="range"
            :min="MIN_ZOOM"
            :max="MAX_ZOOM"
            step="0.01"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-brand-700 disabled:cursor-default disabled:opacity-50"
            :disabled="!canInteract"
            :aria-valuetext="t('profile.crop.zoomValue', { value: Math.round(zoom * 100) })"
            @input="clampOffsets(); render()"
          />

          <button
            type="button"
            class="btn-icon shrink-0 border border-line bg-surface"
            :disabled="!canInteract || zoom >= MAX_ZOOM"
            :aria-label="t('profile.crop.zoomIn')"
            @click="stepZoom(1)"
          >
            <ZoomIn class="size-5" />
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <p id="avatar-crop-hint" class="text-small text-muted">
            {{ t('profile.crop.dragHint') }}
          </p>
          <BaseButton
            variant="ghost"
            size="sm"
            :icon="RefreshCw"
            :disabled="!canInteract"
            @click="resetCrop"
          >
            {{ t('profile.crop.reset') }}
          </BaseButton>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="requestClose">
        {{ t('action.cancel') }}
      </BaseButton>
      <BaseButton :icon="Check" :loading="busy" :disabled="!canSave" @click="save">
        {{ t('profile.crop.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
