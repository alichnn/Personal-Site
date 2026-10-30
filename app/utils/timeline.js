// Shared scroll-progress breakpoints (fractions of total scroll), used by
// both the Three.js scene (Experience.vue) and the text overlay (app.vue)
// so the two stay in sync by construction instead of by copy-pasted numbers.
export const T = {
  heroFade: [0.03, 0.07],
  cloudClear: [0.07, 0.14],
  fog: [0.08, 0.11, 0.13, 0.16],
  starsIn: [0.14, 0.20, 0.28, 0.34],
  goal: [0.19, 0.23, 0.29, 0.33],
  earthScene: [0.30, 0.37, 0.54, 0.60],
  earthParagraph: [0.33, 0.38, 0.51, 0.57],
}
