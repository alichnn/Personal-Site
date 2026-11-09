<script setup lang="ts">
import { T } from '~/core/timeline'
import { roles } from '~/data/content'
</script>

<template>
  <!-- each role's lettering floats above its lily pad (scenes/words.ts) -->
  <TextBlock :range="T.work" label="Work Experience" class="work">
    <h2 class="work-title ghost headline">Work Experience</h2>
    <ul class="sr-only">
      <li v-for="(r, i) in roles" :key="i">{{ r.role }}, {{ r.company }}, {{ r.line }}</li>
    </ul>
  </TextBlock>
</template>

<style scoped>
.work {
  justify-content: flex-start;
  align-items: flex-start;
  padding-top: max(17vh, 96px);
  padding-left: max(8vw, 24px);
}
.work-title {
  margin: 0;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.1;
  text-align: left;
}
</style>
