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
  waterScene: [0.58, 0.64, 0.80, 0.86],
  mistOpacity: [0.60, 0.66, 0.90, 0.97],
  mistToFireMix: [0.80, 0.92],
  work: [0.70, 0.74, 0.84, 0.88],
  about: [0.86, 0.89, 0.98, 1.00],
  fireIn: [0.90, 0.98],
}
