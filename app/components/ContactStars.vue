<script setup lang="ts">
import { animate } from 'animejs'
import { ref } from 'vue'
import { Vector3 } from 'three'
import { ANCHORS, STAR_UV, starDirs } from '~/core/constellation'
import { state } from '~/core/state'
import { SECTIONS, T } from '~/core/timeline'
import { flyToProgress } from '~/core/scroll'
import { world } from '~/core/world'
import { contacts } from '~/data/content'
import { ui, useFrame } from '~/composables/useStory'

// The constellation's stars become the contact links: real <a> elements over the stars.

const links = ref<HTMLAnchorElement[]>([])
const v = new Vector3()
const pt = { x: 0, y: 0 }
const side = contacts.map((c) => (STAR_UV[ANCHORS[c.star]!]![0] < 0 ? 'left' : 'right'))

useFrame(() => {
  const w = world
  if (!w || state.p < T.contact[0] - 0.01) return
  contacts.forEach((c, i) => {
    const el = links.value[i]
    if (!el) return
    v.copy(w.camera.position).addScaledVector(starDirs[ANCHORS[c.star]!]!, 880)
    const ok = w.project(v, pt)
    el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`
    el.style.visibility = ok ? '' : 'hidden'
  })
})

function glow(e: Event, on: boolean) {
  const i = links.value.indexOf(e.currentTarget as HTMLAnchorElement)
  const g = world?.words.contactGlow[i]
  if (g) animate(g, { v: on ? 1.6 : 0, duration: 320, ease: 'outQuad' })
  const dot = (e.currentTarget as HTMLElement).querySelector('.star-dot')
  if (dot) animate(dot, { scale: on ? 1.7 : 1, opacity: on ? 1 : 0.85, duration: 320, ease: 'outQuad' })
}
</script>

<template>
  <TextBlock :range="T.contact" label="Contact" class="contact">
    <h2 class="sr-only">Say hello</h2>
    <ul class="contact-list">
      <li v-for="(c, i) in contacts" :key="c.label">
        <a
          ref="links"
          class="star-link"
          :class="side[i]"
          :href="c.href"
          :target="c.href.startsWith('http') ? '_blank' : undefined"
          :rel="c.href.startsWith('http') ? 'noopener' : undefined"
          @pointerenter="glow($event, true)"
          @pointerleave="glow($event, false)"
          @focus="glow($event, true)"
          @blur="glow($event, false)"
        >
          <span class="star-dot" aria-hidden="true" />
          <span class="star-label ghost">{{ c.label }}</span>
        </a>
      </li>
    </ul>
    <!-- the end of the story: say so, and offer the way back -->
    <button type="button" class="back-to-start" @click="flyToProgress(SECTIONS[0].to, ui.reduced)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      Back to the start
    </button>
  </TextBlock>
</template>

<style scoped>
.contact-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.star-link {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 0;
  height: 0;
  color: #fff;
  text-decoration: none;
  outline: none;
}
.star-dot {
  position: absolute;
  left: -22px;
  top: -22px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 9%, rgba(214, 228, 255, 0.85) 14%, rgba(150, 180, 255, 0.28) 34%, transparent 66%);
  opacity: 0.85;
}
.star-label {
  position: absolute;
  top: -0.8em;
  white-space: nowrap;
  font-size: clamp(1.15rem, 2vw, 1.45rem);
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
}
.star-link.right .star-label {
  left: 22px;
}
.star-link.left .star-label {
  right: 22px;
}
@media (max-width: 640px) {
  /* narrow screens: labels sit under their star so none run off the edge */
  .star-link.left .star-label,
  .star-link.right .star-label {
    left: 50%;
    right: auto;
    top: 16px;
    transform: translateX(-50%);
  }
}
.back-to-start {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(28px, 7vh, env(safe-area-inset-bottom));
  width: max-content;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 10px 18px;
  background: rgba(12, 18, 40, 0.3);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  color: rgba(255, 255, 255, 0.85);
  font: 500 0.9rem/1 var(--font);
  cursor: pointer;
  transition: background 0.25s ease, color 0.25s ease;
}
.back-to-start svg {
  width: 16px;
  height: 16px;
}
.back-to-start:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.back-to-start:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
.star-link:focus-visible .star-label {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
</style>
