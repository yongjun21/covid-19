<template>
  <div class="interactive-map">
    <span class="title">
      新型冠状病毒肺炎
      <br v-if="window.innerWidth < 640">
      境内确证病例分布图
      <template v-if="date && totalCases">
        <br>
        <strong>{{date | formatDate}}</strong> <small>全球累积确证:</small> <strong>{{totalCases | formatNumber}}</strong>
      </template>
    </span>
    <span class="attribution">
      <strong>数据来源</strong>: <a href="https://ncov.dxy.cn/ncovh5/view/pneumonia">丁香园</a>
      <template v-if="lastUpdated"><br><strong>最近更新</strong>: {{lastUpdated | formatTimestamp}}</template>
    </span>
  </div>
</template>

<script>
import Vue from 'vue'
import chroma from 'chroma-js'

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import store from '../store'

import TooltipContent from './TooltipContent'

const DOMAIN = { color: [0, 1000] }
const GAMMA = { color: 0.2, height: 0.33 }

const CHINA = {
  center: window.innerWidth < 640 ? [114.384695, 30.667099] : [104.1375915, 31.1040363],
  zoom: 4
}

export default {
  props: ['progress'],
  data () {
    return {
      window: {
        innerWidth: window.innerWidth
      },
      date: null,
      totalCases: null
    }
  },
  computed: {
    lastUpdated () {
      return store.lastUpdated
    }
  },
  filters: {
    formatNumber (n) {
      return n.toLocaleString()
    },
    formatTimestamp (t) {
      const [date, time] = t.split('T')
      const [, m, d] = date.split('-').map(Number)
      return `${m}月${d}日 ${time}`
    },
    formatDate (date) {
      const [, m, d] = date.split('-').map(Number)
      return `${m}月${d}日`
    }
  },
  created () {
    this.storeInitialized = store.initialize()
    if (this.progress) {
      this.storeFullyLoaded = this.storeInitialized.then(() => store.continue())
    }
  },
  mounted () {
    const map = new mapboxgl.Map(Object.assign({
      container: this.$el,
      style: 'mapbox://styles/yongjun21/ck60blonc363g1ilbygjc6rer',
      pitch: 40,
      minZoom: 4,
      maxZoom: 8,
      scrollZoom: !this.progress,
      dragPan: true,
      dragRotate: false,
      accessToken: 'pk.eyJ1IjoieW9uZ2p1bjIxIiwiYSI6ImNpdTY5c2tyZzBqaDgyemxwYjk0Nnlic2UifQ.A5OHCYPcLTupbo1Qi3t5OQ'
    }, CHINA))

    const nav = new mapboxgl.NavigationControl({ showCompass: false })
    map.addControl(nav, 'top-right')
    map.removeControl(map._controls[0])

    const tooltip = createPopup(TooltipContent, {
      closeButton: false,
      closeOnClick: false
    })

    const colorScale = chroma.scale('OrRd').gamma(GAMMA.color).domain(DOMAIN.color)

    map.on('load', () => {
      map.addSource('china', {
        type: 'vector',
        url: 'mapbox://yongjun21.china'
      })

      if (this.progress) {
        this.storeFullyLoaded.then(() => {
          const n = store.dates.length
          this.$watch('progress', progress => {
            const p = progress(true)
            let index = Math.floor(p * (n - 1))
            const t = p * (n - 1) - index
            index = n - 1 - index
            Object.values(store.data).forEach(row => {
              const b = row.cases[index] || 0
              const a = (index === n - 1) ? b : row.cases[index + 1] || 0
              const interpolated = a * (1 - t) + b * t
              const state = {
                name: row.name,
                cases: a,
                height: interpolated,
                color: colorScale(interpolated).hex()
              }
              map.setFeatureState({
                source: 'china',
                sourceLayer: 'china_boundaries_l' + row.lvl,
                id: row.id
              }, state)
              map.setFeatureState({
                source: 'china',
                sourceLayer: 'china_places_l' + row.lvl,
                id: row.id
              }, state)
            })
            this.date = store.dates[index]
            this.totalCases = store.total[index]
          }, { immediate: true })
        })
      } else {
        this.storeInitialized.then(() => {
          Object.values(store.data).forEach(row => {
            const v = row.cases[0] || 0
            const state = {
              name: row.name,
              cases: v,
              height: v,
              color: colorScale(v).hex()
            }
            map.setFeatureState({
              source: 'china',
              sourceLayer: 'china_boundaries_l' + row.lvl,
              id: row.id
            }, state)
            map.setFeatureState({
              source: 'china',
              sourceLayer: 'china_places_l' + row.lvl,
              id: row.id
            }, state)
          })
          this.date = store.dates[0]
          this.totalCases = store.total[0]
        })
      }

      map.addLayer({
        id: 'l1_data',
        source: 'china',
        'source-layer': 'china_boundaries_l1',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-height': ['*',
            10000,
            ['^', ['number', ['feature-state', 'height'], 0], GAMMA.height]
          ],
          'fill-extrusion-color': ['to-color', ['feature-state', 'color'], colorScale(0).hex()],
          'fill-extrusion-opacity': 1
        }
      })

      map.addLayer({
        id: 'l2_data',
        source: 'china',
        'source-layer': 'china_boundaries_l2',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-height': ['*',
            10000,
            ['^', ['number', ['feature-state', 'height'], 0], GAMMA.height]
          ],
          'fill-extrusion-color': ['to-color', ['feature-state', 'color'], colorScale(0).hex()],
          'fill-extrusion-opacity': 1
        }
      })

      /*
      map.addLayer({
        id: 'l2_line',
        source: 'china',
        'source-layer': 'china_boundaries_l2',
        type: 'line',
        paint: {
          'line-color': 'darkgrey',
          'line-width': 1.2,
          'line-opacity': 0.8
        }
      })
      */

      map.addLayer({
        id: 'l1_label',
        source: 'china',
        'source-layer': 'china_places_l1',
        type: 'symbol',
        filter: ['all', ['!=', ['get', 'name_chi_short'], '香港'], ['!=', ['get', 'name_chi_short'], '澳門']],
        layout: {
          'text-field': ['get', 'name_chi_short'],
          'text-size': 12,
          'text-variable-anchor': ['center', 'bottom', 'top', 'left', 'right'],
          'text-radial-offset': 0.5,
          'text-justify': 'auto'
        }
      })

      map.on('mousemove', e => {
        const featuresL1 = map.queryRenderedFeatures(e.point, { layers: ['l1_data'] })
        const featuresL2 = map.queryRenderedFeatures(e.point, { layers: ['l2_data'] })
        if (featuresL2.length > 0 && featuresL2[0].state.cases > 0) {
          const data = {
            properties: featuresL2[0].properties,
            state: featuresL2[0].state
          }
          tooltip.setData(data).trackPointer().addTo(map)
        } else if (featuresL1.length > 0) {
          const data = {
            properties: featuresL1[0].properties,
            state: featuresL1[0].state
          }
          tooltip.setData(data).trackPointer().addTo(map)
        } else {
          tooltip.setData(null).remove()
        }
      })
      map.on('movestart', e => tooltip.setData(null).remove())
    })
  }
}

function createPopup (Content, options) {
  const popup = new mapboxgl.Popup(options)
  const $el = document.createElement('div')
  const vm = new Vue(Content)
  popup.setDOMContent($el)
  vm.$mount($el)
  popup.setData = function (data) {
    vm.data = Object.freeze(data)
    return this
  }
  popup.on = function (event, callback) {
    vm.$on(event, callback)
    return this
  }
  return popup
}
</script>

<style lang="scss">
.interactive-map {
  width: 100%;
  height: 100%;

  .title {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1;
    padding: 16px 24px;
    font-size: 32px;
    line-height: 1.2em;
    background-color: rgba(128, 128, 128, 0.6);
    color: white;
    text-shadow: 1px 1px 2px black;
    box-shadow: 0 1px 5px darkgrey;

    small {
      font-size: 0.6em;
    }
  }

  .attribution {
    display: block;
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 1;
    padding: 4px 8px;
  }

  .mapboxgl-popup {
    pointer-events: none;
  }
}
</style>
