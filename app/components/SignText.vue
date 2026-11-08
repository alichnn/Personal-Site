<script setup lang="ts">
import { T } from '~/core/timeline'
import { earth } from '~/data/content'
</script>

<template>
  <!-- the 3D lettering floats over the meadow beside the signpost (scenes/words.ts) -->
  <TextBlock :range="T.sign" label="In the meadow" passive>
    <p class="earth-copy ghost">{{ earth }}</p>
  </TextBlock>
</template>

<style scoped>
.earth-copy {
  position: absolute;
  top: max(8vh, 48px);
  left: 0;
  right: 0;
  width: min(820px, 90vw);
  margin: 0 auto;
  font-size: clamp(1.2rem, 2.4vw, 1.85rem);
  line-height: 1.22;
  text-align: center;
}
</style>
