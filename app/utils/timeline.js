// Shared scroll-progress breakpoints (fractions of total scroll), used by
// both the Three.js scene (Experience.vue) and the text overlay (app.vue)
// so the two stay in sync by construction instead of by copy-pasted numbers.
export const T = {
  heroFade: [0.03, 0.07],
  cloudClear: [0.07, 0.14],
  fog: [0.08, 0.11, 0.13, 0.16],
  starsIn: [0.14, 0.20],
  goal: [0.19, 0.23, 0.29, 0.33],
}
