<script setup lang="ts">
import { SCROLL_SVH, T } from '~/core/timeline'
import { goal, hero, people } from '~/data/content'
import { ui } from '~/composables/useStory'

// Client-only app: decide reduced motion before the world is created.
ui.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('reduced')
</script>

<template>
  <div class="app">
    <WorldCanvas />

    <div class="story">
      <ConstellationLines />
      <main>
        <TextBlock :range="T.hero" class="hero" label="Introduction" passive>
          <div class="hero-copy scrim">
            <h1 class="hero-title">{{ hero.greeting }}</h1>
          </div>
          <img class="sr-only" :src="hero.photo.src" :alt="hero.photo.alt" width="800" height="1200">
        </TextBlock>

        <TextBlock :range="T.people" passive>
          <p class="lede scrim people">{{ people }}</p>
        </TextBlock>

        <TextBlock :range="T.goal" class="goal" passive>
          <p class="lede scrim">{{ goal }}</p>
        </TextBlock>

        <SignText />
        <WorkSection />
        <AboutSection />
        <ContactStars />
      </main>
    </div>

    <LoaderOverlay />
    <SoundToggle />
    <div class="scroll-space" :style="{ height: `${SCROLL_SVH}svh` }" aria-hidden="true" />
  </div>
</template>

<style>
.hero {
  align-items: flex-start;
}
.hero-copy {
  margin-left: 6vw;
  --scrim: rgba(7, 26, 78, 0.74);
  --scrim-core: 62%;
  --scrim-inset: -80% -24%;
}
.hero-title {
  margin: 0;
  font-size: clamp(2.6rem, 7vw, 5.6rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
  font-weight: 800;
  text-align: left;
  text-shadow: 0 2px 3px rgba(5, 18, 60, 0.55), 0 0 30px rgba(5, 18, 60, 0.45);
}
.people {
  --scrim: rgba(14, 18, 66, 0.66);
}
.goal {
  justify-content: flex-end;
  padding-bottom: max(14vh, 80px);
}
.goal .lede {
  --scrim: rgba(2, 4, 20, 0.55);
}

@media (max-aspect-ratio: 1/1) {
  .hero {
    align-items: center;
    justify-content: flex-start;
    padding-top: max(14vh, 72px);
  }
  .hero-copy {
    margin-left: 0;
  }
  .hero-title {
    text-align: center;
  }
}

/* Without WebGL: a plain, readable page. */
.no-webgl body {
  background: #0b1030;
}
.no-webgl .story {
  position: static;
  overflow: visible;
}
.no-webgl .block {
  position: relative;
  inset: auto;
  min-height: 60vh;
  opacity: 1 !important;
  filter: none !important;
  transform: none !important;
  pointer-events: auto;
}
.no-webgl .block * {
  pointer-events: auto;
}
.no-webgl .scroll-space,
.no-webgl .scroll-hint,
.no-webgl .constellation,
.no-webgl .loader {
  display: none;
}
.no-webgl .role,
.no-webgl .star-link {
  position: relative;
  opacity: 1 !important;
  transform: none !important;
  display: inline-block;
  width: auto;
  height: auto;
  margin: 0.5rem;
}
.no-webgl .star-label,
.no-webgl .star-dot {
  position: static;
}
.no-webgl .block .sr-only {
  position: static !important;
  width: auto;
  height: auto;
  margin: 0 auto 1rem;
  max-width: 40rem;
  clip: auto;
  clip-path: none;
  white-space: normal;
}
</style>
