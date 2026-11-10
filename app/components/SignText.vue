<script setup lang="ts">
import { T } from '~/core/timeline'
import { earth } from '~/data/content'
</script>

<template>
  <!-- the lettering floats over the meadow beside the signpost (scenes/words.ts) -->
  <TextBlock :range="T.sign" label="In the meadow" passive>
    <p class="earth-copy ghost">{{ earth }}</p>
  </TextBlock>
</template>

<style scoped>
.earth-copy {
  position: absolute;
  /* just above the signpost's arrows */
  top: max(15vh, 84px);
  left: 0;
  right: 0;
  /* the same size as the earlier lines (.lede), wrapping to about three lines */
  width: min(24ch, 90vw);
  margin: 0 auto;
  font-size: clamp(1.6rem, 4.2vw, 3rem);
  line-height: 1.18;
  text-align: center;
}
</style>
