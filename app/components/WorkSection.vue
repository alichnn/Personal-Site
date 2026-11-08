<script setup lang="ts">
import { ref } from 'vue'
import { T } from '~/core/timeline'
import { state } from '~/core/state'
import { world } from '~/core/world'
import { roles, thread } from '~/data/content'
import { useFrame, useScrubbedBlock } from '~/composables/useStory'

const cards = ref<HTMLElement[]>([])
const threadEl = ref<HTMLElement | null>(null)
useScrubbedBlock(threadEl, T.thread)

const pt = { x: 0, y: 0 }
useFrame(() => {
  const pond = world?.pond
  const live = !!pond?.built && state.p > T.work[0] && state.p < T.work[3]
  cards.value.forEach((el, i) => {
    if (!live) {
      el.style.opacity = '0'
      return
    }
    const f = pond!.focus(i)
    const onScreen = world!.project(pond!.padAnchors[i]!, pt)
    el.style.opacity = onScreen ? String(f) : '0'
    el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%) translateY(${(1 - f) * 10 - 18}px) scale(${0.94 + f * 0.06})`
    el.classList.toggle('in-focus', f > 0.5)
  })
})
</script>

<template>
  <TextBlock :range="T.work" label="Work" class="work">
    <h2 class="work-title">Work</h2>
    <ul class="roles">
      <li v-for="(r, i) in roles" :key="i" ref="cards" class="role">
        <p class="role-name">{{ r.role }}</p>
        <p class="role-company">{{ r.company }}</p>
        <p class="role-line">{{ r.line }}</p>
      </li>
    </ul>
    <p ref="threadEl" class="thread lede scrim">{{ thread }}</p>
  </TextBlock>
</template>

<style scoped>
.work {
  justify-content: flex-start;
  align-items: flex-start;
}
.work-title {
  margin: 0;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: rgba(8, 30, 36, 0.72);
  color: #fff;
}
.roles {
  list-style: none;
  margin: 0;
  padding: 0;
}
.role {
  position: absolute;
  left: 0;
  top: 0;
  width: min(300px, 80vw);
  padding: 0.85rem 1.05rem 0.95rem;
  border-radius: 14px;
  background: rgba(7, 30, 36, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 10px 30px rgba(0, 20, 20, 0.3);
  text-align: left;
  opacity: 0;
  will-change: transform, opacity;
}
.role::after {
  /* a little stem down to the lily pad */
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  width: 16px;
  height: 16px;
  transform: translateX(-50%) rotate(45deg);
  background: rgba(7, 30, 36, 0.86);
  border-right: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}
.role p {
  margin: 0;
}
.role-name {
  font-size: 1.12rem;
  font-weight: 700;
}
.role-company {
  color: #a6ecdf;
  font-weight: 600;
  margin-bottom: 0.3rem !important;
}
.role-line {
  font-size: 0.97rem;
  color: rgba(255, 255, 255, 0.92);
}
.thread {
  /* centred with margins: anime.js owns this element's transform */
  position: absolute;
  left: 0;
  right: 0;
  margin: 0 auto;
  bottom: max(9vh, 64px);
  width: min(92vw, 34ch);
  max-width: none;
  font-size: clamp(1.25rem, 3vw, 2rem);
  opacity: 0;
  --scrim: rgba(4, 24, 30, 0.7);
}
</style>
