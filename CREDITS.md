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
System font stacks only.

## Libraries
- [Nuxt](https://nuxt.com) / [Vue](https://vuejs.org): MIT
- [three.js](https://threejs.org): MIT
- [anime.js](https://animejs.com): MIT
- [Lenis](https://github.com/darkroomengineering/lenis): MIT
- [sharp](https://sharp.pixelplumbing.com) (build-time image resizing): Apache-2.0
