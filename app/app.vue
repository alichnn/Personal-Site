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
          <div class="hero-copy">
            <h1 class="hero-title ghost headline">{{ hero.greeting }}</h1>
          </div>
          <img class="sr-only" :src="hero.photo.src" :alt="hero.photo.alt" :width="hero.photo.width" :height="hero.photo.height">
        </TextBlock>

        <TextBlock :range="T.people" passive>
          <p class="lede ghost people">{{ people }}</p>
        </TextBlock>

        <TextBlock :range="T.goal" class="goal" passive>
          <p class="lede ghost">{{ goal }}</p>
        </TextBlock>

        <SignText />
        <WorkSection />
        <AboutSection />
        <ContactStars />
      </main>
    </div>

    <LoaderOverlay />
    <StoryNav />
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
}
.hero-title {
  margin: 0;
  font-family: 'Redaction 50', var(--font-headline);
  font-size: clamp(2.6rem, 7vw, 5.6rem);
  line-height: 1.22;
  text-align: left;
  max-width: 44vw;
}
.goal .lede {
  max-width: 30ch;
}
.goal {
  justify-content: flex-end;
  padding-bottom: max(14vh, 80px);
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
    max-width: 88vw;
  }
}

/* Without WebGL: a plain, readable page. */
.no-webgl .ghost {
  color: #fff !important;
}
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
