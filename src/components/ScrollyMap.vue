<template>
  <st-scrolly class="scrolly-map">
    <template v-slot:background="{progress}">
      <interactive-map :progress="progress"></interactive-map>
    </template>
  </st-scrolly>
</template>

<script>
import '@st-graphics/scrolly/dist/bundle.css'
import StScrolly from '@st-graphics/scrolly'
import InteractiveMap from './InteractiveMap.vue'

export default {
  components: {
    StScrolly,
    InteractiveMap
  }
}
</script>

<style lang="scss">
.scrolly-map {
  .slide {
    height: 2400px;
  }
}
</style>
