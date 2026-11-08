# alicechen.art: Four Elements

A single-page scroll story. The camera flies through one continuous low-poly toon world:
clouds (air) → night sky → dandelion seeds → meadow (earth) → koi pond (water) → sunset that
burns into a campfire (fire) → back up to the stars.

Nuxt 4 (client-only, statically generated) · Three.js · anime.js · Lenis.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run generate   # static build in .output/public
npm run typecheck
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(`public/CNAME` keeps the `alicechen.art` domain).

## Editing content

| What | Where |
| --- | --- |
| All copy, work roles, contact links | `app/data/content.ts` |
| Photo albums (name, photos, alt text) | `app/data/albums.ts` |
| Hero photo | `assets-src/hero/alice.jpg` → `npm run images` |
| Album photos | `assets-src/albums/<album>/<slug>.jpg` → `npm run images`, then list in `albums.ts` |

`npm run images` writes resized 4:5 AVIF/WebP variants to `public/` and strips EXIF/GPS.
`assets-src/` (the full-size originals) is gitignored on purpose; only the web variants are committed.

Adding a fourth work role is a one-line edit in `content.ts`: the pond spawns another lily pad
and the scroll timeline divides the hold between them.

## Tuning

- **Scroll timing:** every progress range is in `app/core/timeline.ts`.
- **Camera path:** keyframes in `app/core/camera.ts`. Pairs of nearby keys make the plateaus
  where text holds; the gaps between them are the fast flights.
- **Light and sky per moment:** keyframes in `app/core/atmosphere.ts`.
- **World layout** (sign, pond, fire positions): `app/core/layout.ts`.

URL switches for testing: `?quality=high|medium|low` pins the quality tier, and `?reduced` forces
reduced-motion mode. In dev only, `?msaa=`, `?dpr=`, `?shadows=0|1` and `?bloom=` override
individual quality settings.

## How it fits together

- `app/core/world.ts`: renderer, post-processing (bloom, grade, FXAA), the single render loop,
  background streaming of later scenes, the quality probe and watchdog, and the reduced-motion crossfade.
- `app/scenes/*`: one module per part of the world. Each has a progress `range`, a `build()`
  and an `update()`.
- `app/scenes/words.ts` + `app/core/lettering.ts`: all story text as floating, toon-shaded 3D
  lettering (Fredoka). Each line also exists as invisible "ghost" HTML in the same layout, for
  screen readers, search and keyboard focus; the module measures each ghost's box at its section's
  resting camera pose and places the 3D letters there. To restyle a line, edit its CSS (size,
  position, wrap width) and the 3D text follows.
- `app/components/*`: the HTML layer (ghost text, album cards, contact links, sound toggle).
- `app/core/audio.ts`: the ambient soundscape, synthesised with Web Audio (no audio files).
