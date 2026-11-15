# alicechen.art: Four Elements

A single-page scroll story. The camera flies through one continuous low-poly toon world:
clouds (air) → night sky → dandelion seeds → meadow (earth) → koi pond (water) → project
lanterns on the pond → the lanterns rise into a sunset that burns into a campfire (fire) → back up
to the stars.

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
| All copy, work roles, signpost arrows, contact links | `app/data/content.ts` |
| Photo albums (name, photos, alt text) | `app/data/albums.ts` |
| Projects (one lantern each, and its case-study card) | `app/data/projects.ts` |
| Hero photo | `assets-src/hero/alice.jpg` → `npm run images` (framed in toon wood in `app/scenes/hero.ts`) |
| Album photos | `assets-src/albums/<album>/<slug>.jpg` → `npm run images`, then list in `albums.ts` |
| Project images and clips | `assets-src/projects/<slug>/<name>.jpg` (or `.mov`) → `npm run images` (writes `public/project-images/`), then list in `projects.ts` |

`npm run images` writes resized 4:5 AVIF/WebP variants to `public/` and strips EXIF/GPS. Project
images keep their own proportions (640 and 1280 wide, never enlarged), and their pixel sizes go to
`app/data/project-images.json` so every image has explicit dimensions.
`assets-src/` (the full-size originals) is gitignored on purpose; only the web variants are committed.

Adding a fourth work role is a one-line edit in `content.ts`: the pond spawns another lily pad
and the scroll timeline divides the hold between them.

Adding or removing a project is an edit in `projects.ts`: the lanterns are grouped by type
(UX, then data, then marketing), the arc rebalances for any count up to six, and the card's
previous/next order and the `#slug` deep links follow. `alicechen.art/#rexolve` opens the site
at the lantern plateau with that card open; the address follows as people move between cards.
Optional card fields (meta, context, results, links) are simply hidden when left out.

## Tuning

- **Scroll timing:** every progress range is in `app/core/timeline.ts`.
- **Nav chapters:** `SECTIONS` in `app/core/timeline.ts` sets each tab's label, where its highlight
  begins, and where a jump to it lands (`app/components/StoryNav.vue` draws the legend).
- **Scroll length:** `KNOTS` in `app/core/timeline.ts`: [story progress, screen heights scrolled] pairs.
  Each stretch between knots has its own pace (the cloud intro, the story through Work, the lantern
  arrival, the lantern plateau, and the rest), so a stretch can be lengthened without touching any
  other timing. The camera's eased plateau corners are measured in scroll, so they stay the same
  length everywhere.
- **Camera path:** keyframes in `app/core/camera.ts`. Pairs of nearby keys make the plateaus
  where text holds; the gaps between them are the fast flights.
- **Light and sky per moment:** keyframes in `app/core/atmosphere.ts`.
- **World layout** (sign, pond, fire positions): `app/core/layout.ts`.

URL switches for testing: `?quality=high|medium|low` pins the quality tier, and `?reduced` forces
reduced-motion mode. In dev only, `?msaa=`, `?dpr=`, `?shadows=0|1` and `?bloom=` override
individual quality settings.

## How it fits together

- `app/core/world.ts`: renderer, post-processing (bloom, grade, the case-study blur, FXAA), the single render loop,
  background streaming of later scenes, the quality probe and watchdog, and the reduced-motion crossfade.
- `app/scenes/*`: one module per part of the world. Each has a progress `range`, a `build()`
  and an `update()`.
- `app/scenes/lanterns.ts`: the project lanterns (lotus bases, glowing paper shades, the reeds they
  float out of), their arc layout, lighting, hover and open effects, and the rise into the sunset.
  Their light and wakes on the water are drawn by the pond's shader.
- `app/components/LanternLayer.vue` and `ProjectCard.vue`: the lanterns' real `<button>`s and
  titles, and the case-study card (the blurred, dimmed world behind it is World's post-processing).
- `app/scenes/words.ts`: all story text, floating in the world as crisp SDF text with an outline
  and soft halo (`app/core/flattext.ts`): the hero greeting and headlines
  in Redaction 50 Bold, everything else in Redaction 50 Regular (Italic for the role one-liners). Each line also exists as invisible "ghost" HTML in the same layout, for
  screen readers, search and keyboard focus; the module measures each ghost's box at its section's
  resting camera pose and places the letters there. To restyle a line, edit its CSS (size,
  position, wrap width) and the world text follows.
- `app/components/*`: the HTML layer (ghost text, album cards, contact links, sound toggle).
- `app/core/audio.ts`: the ambient soundscape, synthesised with Web Audio (no audio files).
