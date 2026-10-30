import { ref, onMounted, onBeforeUnmount } from 'vue'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Tracks scroll position as a 0..1 fraction of the page's scrollable height.
export function useScrollProgress() {
  const progress = ref(0)

  let ticking = false
  function compute() {
    const scrollable = document.body.scrollHeight - window.innerHeight
    progress.value = scrollable > 0 ? clamp01(window.scrollY / scrollable) : 0
    ticking = false
  }
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(compute)
      ticking = true
    }
  }

  onMounted(() => {
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', compute)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', compute)
  })

  return { progress }
}
