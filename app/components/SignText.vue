<script setup lang="ts">
import { createTimeline, stagger, type Timeline } from 'animejs'
import { onBeforeUnmount } from 'vue'
import { T } from '~/core/timeline'
import { state } from '~/core/state'
import { world } from '~/core/world'
import { earth } from '~/data/content'
import { blockTime, ui, useFrame } from '~/composables/useStory'

// The readable copy lives here in the story's reading order; the visible copy is carved onto
// the signpost (an aria-hidden CSS3D element built by the meadow scene). This scrubs the
// burn-in of the carved words with scroll.
let tl: Timeline | null = null
let last = -1

function build(el: HTMLElement) {
  const words = el.querySelectorAll<HTMLElement>('.sign-word')
  tl = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })
  if (ui.reduced) {
    tl.add(words, { opacity: [0, 1], duration: 300 }, 0).add(words, { opacity: [1, 0], duration: 300 }, 700)
  } else {
    tl.add(words, {
      opacity: [0, 1],
      color: ['#ffb24a', '#2a1204'],
      filter: ['brightness(2.2) blur(2px)', 'brightness(1) blur(0px)'],
      duration: 120,
      delay: stagger(9),
      ease: 'outQuad',
    }, 0).add(words, { opacity: [1, 0], duration: 300 }, 700)
  }
  tl.seek(0)
}

useFrame(() => {
  const el = world?.meadow.built ? world.meadow.signEl : null
  if (!el) return
  if (!tl) build(el)
  const t = blockTime(state.p, T.sign)
  if (t === last) return
  last = t
  tl!.seek(t)
})

onBeforeUnmount(() => tl?.revert())
</script>

<template>
  <TextBlock :range="T.sign" label="Carved into the signpost" passive>
    <p class="sr-only">{{ earth }}</p>
  </TextBlock>
</template>
