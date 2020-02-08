<template>
  <div id="app">
    <st-scrolly>
      <template v-slot:background="{progress}">
        <interactive-map :progress="progress"></interactive-map>
      </template>
    </st-scrolly>
  </div>
</template>

<script>
import '@st-graphics/scrolly/dist/bundle.css'
import StScrolly from '@st-graphics/scrolly'
import InteractiveMap from './components/InteractiveMap.vue'

export default {
  name: 'app',
  components: {
    StScrolly,
    InteractiveMap
  }
}
</script>

<style lang="scss">
html,
body {
  height: 100%;
  margin: 0;
}

#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;

  .slide {
    height: 2400px;
  }
}
</style>
