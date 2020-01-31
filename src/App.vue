<template>
  <div id="app">
    <interactive-map></interactive-map>
  </div>
</template>

<script>
import InteractiveMap from './components/InteractiveMap.vue'

export default {
  name: 'app',
  components: {
    InteractiveMap
  }
}
</script>

<style lang="scss">
html,
body,
#app {
  height: 100%;
  margin: 0;
}

#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
