<template>
  <div class="tooltip-content" v-if="data">
    <template v-if="data[1].name">
      {{data[1].name}}
      <br>
      <small>确证病例</small> {{data[1].confirmed}} <small>起</small>
    </template>
    <template v-else>
      {{data[0].name_chi_short}}
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
