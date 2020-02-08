<template>
  <div class="tooltip-content" v-if="data">
    <template v-if="data.state.name && data.state.cases > 0">
      {{data.state.name}}
      <br>
      <small>确证病例</small> {{data.state.cases.toLocaleString()}} <small>起</small>
    </template>
    <template v-else>
      {{data.properties.name_chi_short}}
    </template>
  </div>
</template>

<script>
export default {
  data () {
    return {
      data: null
    }
  }
}
</script>

<style lang="scss">
.tooltip-content {
  z-index: 1;

  small {
    font-size: 0.8em;
  }
}
</style>
