<script setup lang="ts">
import { ref } from 'vue'
import type { Range4 } from '~/core/timeline'
import { focusScroll, useScrubbedBlock } from '~/composables/useStory'

const props = defineProps<{
  range: Range4
  label?: string
  /** Never takes pointer events (pure text over the scene). */
  passive?: boolean
}>()
const emit = defineEmits<{ time: [t: number] }>()

const root = ref<HTMLElement | null>(null)
useScrubbedBlock(root, props.range, { onTime: (t) => emit('time', t) })
const onFocus = focusScroll(props.range)
</script>

<template>
  <section ref="root" class="block" :class="{ passive }" :aria-label="label" @focusin="onFocus">
    <slot />
  </section>
</template>
