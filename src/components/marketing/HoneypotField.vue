<script setup lang="ts">
import { useId } from 'vue'

/**
 * A VPAT-out-of-the-way honeypot for the public lead-capture forms.
 *
 * The server ignores anything typed here and answers identically either way,
 * so the point of the field is to catch form-filling bots, not to block them.
 * It is visually hidden with the screen-reader clip so humans never see it,
 * and carries `tabindex="-1"` so keyboard flow skips it. `name="website"`
 * matches what the backend expects — the three forms share the wire format.
 */
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="sr-only" aria-hidden="true">
    <label :for="id">Leave this field empty</label>
    <input
      :id="id"
      v-model="model"
      type="text"
      name="website"
      tabindex="-1"
      autocomplete="off"
      aria-hidden="true"
    />
  </div>
</template>