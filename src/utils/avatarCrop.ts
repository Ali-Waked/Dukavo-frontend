export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export interface CropSource {
  imageWidth: number
  imageHeight: number
  stageSize: number
  zoom: number
  offsetX: number
  offsetY: number
}

export interface CropGeometry {
  scale: number
  offsetX: number
  offsetY: number
  sourceX: number
  sourceY: number
  sourceSize: number
}

export function clamp(value: number, min: number, max: number): number {
  const result = Math.min(Math.max(value, min), max)

  return result === 0 ? 0 : result
}

export function calculateCropGeometry(input: CropSource): CropGeometry | null {
  const { imageWidth, imageHeight, stageSize, zoom, offsetX, offsetY } = input

  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    !Number.isFinite(stageSize) ||
    imageWidth < 1 ||
    imageHeight < 1 ||
    stageSize < 1
  ) {
    return null
  }

  const baseScale = Math.max(stageSize / imageWidth, stageSize / imageHeight)
  const scale = baseScale * clamp(Number.isFinite(zoom) ? zoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM)
  const displayedWidth = imageWidth * scale
  const displayedHeight = imageHeight * scale

  const maxOffsetX = Math.max(0, (displayedWidth - stageSize) / 2)
  const maxOffsetY = Math.max(0, (displayedHeight - stageSize) / 2)
  const clampedX = clamp(Number.isFinite(offsetX) ? offsetX : 0, -maxOffsetX, maxOffsetX)
  const clampedY = clamp(Number.isFinite(offsetY) ? offsetY : 0, -maxOffsetY, maxOffsetY)

  const sourceSize = stageSize / scale
  const maxSourceX = Math.max(0, imageWidth - sourceSize)
  const maxSourceY = Math.max(0, imageHeight - sourceSize)
  const sourceX = clamp(imageWidth / 2 - (stageSize / 2 + clampedX) / scale, 0, maxSourceX)
  const sourceY = clamp(imageHeight / 2 - (stageSize / 2 + clampedY) / scale, 0, maxSourceY)

  return {
    scale,
    offsetX: clampedX,
    offsetY: clampedY,
    sourceX,
    sourceY,
    sourceSize,
  }
}
