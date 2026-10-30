import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  calculateCropGeometry,
} from '../src/utils/avatarCrop.ts'

test('a landscape image covers the frame and centres without empty space', () => {
  const crop = calculateCropGeometry({
    imageWidth: 1200,
    imageHeight: 600,
    stageSize: 300,
    zoom: MIN_ZOOM,
    offsetX: 0,
    offsetY: 0,
  })

  assert.ok(crop)
  assert.equal(crop.sourceSize, 600)
  assert.equal(crop.sourceX, 300)
  assert.equal(crop.sourceY, 0)
})

test('a portrait image uses its height as the limiting axis', () => {
  const crop = calculateCropGeometry({
    imageWidth: 400,
    imageHeight: 1200,
    stageSize: 300,
    zoom: MIN_ZOOM,
    offsetX: 0,
    offsetY: 0,
  })

  assert.ok(crop)
  assert.equal(crop.sourceSize, 400)
  assert.equal(crop.sourceX, 0)
  assert.equal(crop.sourceY, 400)
})

test('panning is clamped so the image always fills the crop frame', () => {
  const crop = calculateCropGeometry({
    imageWidth: 1200,
    imageHeight: 600,
    stageSize: 300,
    zoom: MIN_ZOOM,
    offsetX: 9999,
    offsetY: -9999,
  })

  assert.ok(crop)
  assert.equal(crop.offsetX, 150)
  assert.equal(crop.offsetY, 0)
  assert.equal(crop.sourceX, 0)
  assert.equal(crop.sourceY, 0)
})

test('zoom is clamped to the supported range and changes the source size', () => {
  const atMax = calculateCropGeometry({
    imageWidth: 1000,
    imageHeight: 1000,
    stageSize: 200,
    zoom: 99,
    offsetX: 0,
    offsetY: 0,
  })

  assert.ok(atMax)
  assert.equal(atMax.sourceSize, 200 / (0.2 * MAX_ZOOM))
})

test('invalid sources return null instead of an exportable blank crop', () => {
  assert.equal(
    calculateCropGeometry({
      imageWidth: 0,
      imageHeight: 600,
      stageSize: 300,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }),
    null,
  )
})

test('the source rectangle remains inside the original image', () => {
  const crop = calculateCropGeometry({
    imageWidth: 333,
    imageHeight: 777,
    stageSize: 241,
    zoom: 2.3,
    offsetX: -400,
    offsetY: 400,
  })

  assert.ok(crop)
  assert.ok(crop.sourceX >= 0)
  assert.ok(crop.sourceY >= 0)
  assert.ok(crop.sourceX + crop.sourceSize <= 333 + Number.EPSILON)
  assert.ok(crop.sourceY + crop.sourceSize <= 777 + Number.EPSILON)
})
