<script setup lang="ts">
import { createTimeline, stagger, svg, type Timeline } from 'animejs'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Vector3 } from 'three'
import { LINES, starDirs } from '~/core/constellation'
import { state } from '~/core/state'
import { T, bell, ramp, smooth } from '~/core/timeline'
import { world } from '~/core/world'
import { ui, useFrame } from '~/composables/useStory'

// Signature moment #2: thin glowing lines join stars into "AC" while the goal text holds,
// drawn by anime.js and scrubbed by scroll. It returns at the very end around the contact links.

const lines = ref<SVGLineElement[]>([])
const root = ref<SVGSVGElement | null>(null)
let tl: Timeline | null = null
let lastDraw = -1
const pts = starDirs.map(() => ({ x: 0, y: 0, ok: false }))
const v = new Vector3()

onMounted(() => {
  const drawables = svg.createDrawable(lines.value)
  tl = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })
  tl.add(drawables, { draw: ['0 0', '0 1'], duration: 100, delay: stagger(90) }, 0)
  tl.seek(0)
})
onBeforeUnmount(() => tl?.revert())

useFrame(() => {
  const w = world
  const el = root.value
  if (!w || !el || !tl) return
  const p = state.p
  const night = bell(p, 0.3, 0.312, 0.392, 0.404)
  const finale = smooth(p, 0.955, 0.968)
  const opacity = Math.max(night, finale)
  el.style.opacity = opacity.toFixed(3)
  if (opacity <= 0.001) return

  // scrub the drawing
  const draw = p < 0.6 ? ramp(p, T.constellation[0], T.constellation[1]) : ramp(p, T.constellation2[0], T.constellation2[1])
  const d = ui.reduced ? (draw > 0 ? 1 : 0) : draw
  if (d !== lastDraw) {
    lastDraw = d
    tl.seek(d * tl.duration)
  }

  // follow the stars on screen
  const cam = w.camera.position
  starDirs.forEach((dir, i) => {
    v.copy(cam).addScaledVector(dir, 880)
    pts[i]!.ok = w.project(v, pts[i]!)
  })
  LINES.forEach(([a, b], i) => {
    const l = lines.value[i]
    if (!l) return
    const A = pts[a]!, B = pts[b]!
    l.setAttribute('x1', A.x.toFixed(1))
    l.setAttribute('y1', A.y.toFixed(1))
    l.setAttribute('x2', B.x.toFixed(1))
    l.setAttribute('y2', B.y.toFixed(1))
    l.style.visibility = A.ok && B.ok ? '' : 'hidden'
  })
})
</script>

<template>
  <svg ref="root" class="constellation" aria-hidden="true" width="100%" height="100%">
    <defs>
      <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <line v-for="(_, i) in LINES" :key="i" ref="lines" x1="0" y1="0" x2="0" y2="0" />
  </svg>
</template>

<style scoped>
.constellation {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  overflow: visible;
}
line {
  stroke: #dfe9ff;
  stroke-width: 1.4;
  stroke-linecap: round;
  filter: url(#line-glow);
}
</style>
