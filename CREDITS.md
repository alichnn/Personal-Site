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
[Fredoka](https://github.com/hafontia/Fredoka-One) by the Fredoka Project Authors, SIL Open Font License 1.1
(`public/fonts/OFL.txt`). Instanced at SemiBold with overlaps removed and subset to Latin
(`assets-fonts/`); `npm run font` converts it to `public/fonts/fredoka.json` for the 3D lettering.
Everything else uses the system font stack.

## Libraries
- [Nuxt](https://nuxt.com) / [Vue](https://vuejs.org): MIT
- [three.js](https://threejs.org): MIT
- [anime.js](https://animejs.com): MIT
- [Lenis](https://github.com/darkroomengineering/lenis): MIT
- [sharp](https://sharp.pixelplumbing.com) (build-time image resizing): Apache-2.0
- [opentype.js](https://opentype.js.org) (build-time font conversion): MIT
