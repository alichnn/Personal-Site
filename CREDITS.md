# Credits

## 3D models and textures
None imported. Every model (clouds, sunflowers, bird, squirrels, signpost, koi, lily pads,
lotus, trees, rocks, campfire) is built procedurally in `app/scenes/models.ts` and related
scene files, so there are no third-party model licenses.

If CC0 models are swapped in later (Kenney, Quaternius, Poly Pizza), list each one here with
its source URL and license, and re-material it with `toon()` from `app/core/toon.ts`.

## Audio
None imported. The ambient soundscape is synthesised at runtime with the Web Audio API
(`app/core/audio.ts`).

## Photos
All photos are © Alice Chen.

## Fonts
[Redaction](https://www.redaction.us) (Redaction Bold for headlines, Redaction 20 for other text),
© 2019 MCKL Inc., SIL Open Font License 1.1 (`public/fonts/OFL.txt`), via Fontsource.
UI chrome uses the system font stack.

## Libraries
- [Nuxt](https://nuxt.com) / [Vue](https://vuejs.org): MIT
- [three.js](https://threejs.org): MIT
- [anime.js](https://animejs.com): MIT
- [Lenis](https://github.com/darkroomengineering/lenis): MIT
- [sharp](https://sharp.pixelplumbing.com) (build-time image resizing): Apache-2.0
- [opentype.js](https://opentype.js.org) (build-time font conversion): MIT
- [troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text) (crisp in-world text): MIT
