<template>
  <div class="interactive-map">
    <span class="title">
      新型冠状病毒肺炎
      <br v-if="window.innerWidth < 640">
      境内确证病例分布图
      <template v-if="totalCases"><br><small>全球累积确证总数:</small> <strong>{{totalCases | formatNumber}}</strong></template>
    </span>
    <span class="attribution">
      <strong>数据来源</strong>: <a href="https://ncov.dxy.cn/ncovh5/view/pneumonia">丁香园</a>
      <template v-if="lastUpdated"><br><strong>最近更新</strong>: {{lastUpdated | formatTimestamp}}</template>
    </span>
  </div>
</template>

<script>
import Vue from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import chroma from 'chroma-js'

import TooltipContent from './TooltipContent'

const GAMMA = { color: 0.2, height: 0.3 }

const CHINA = {
  center: window.innerWidth < 640 ? [114.384695, 30.667099] : [104.1375915, 31.1040363],
  zoom: 4
}

const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市']

const CORRECTIONS = [
  { provinceName: '黑龙江省', givenName: '大兴安岭', correctName: '大兴安岭地区' }
]

let colorScale = chroma.scale('OrRd').gamma(GAMMA.color)

export default {
  data () {
    return {
      totalCases: null,
      lastUpdated: null,
      window: {
        innerWidth: window.innerWidth
      }
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
    }
  },
  mounted () {
    const dataPending = getData()

    const map = new mapboxgl.Map(Object.assign({
      container: this.$el,
      style: 'mapbox://styles/yongjun21/ck60blonc363g1ilbygjc6rer',
      pitch: 40,
      minZoom: 4,
      maxZoom: 8,
      scrollZoom: true,
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

    map.on('load', () => {
      map.addSource('china', {
        type: 'vector',
        url: 'mapbox://yongjun21.china'
      })

      dataPending.then(([provinces, cities, totalCases, lastUpdated]) => {
        this.totalCases = totalCases
        this.lastUpdated = lastUpdated
        const toPlot = []
        provinces.forEach(row => {
          if (!row.matched) return
          if (MUNICIPALITIES.includes(row.provinceName)) toPlot.push(row)
        })
        cities.forEach(row => {
          if (!row.matched) return
          if (!MUNICIPALITIES.includes(row.provinceName)) toPlot.push(row)
        })

        const max = toPlot.reduce((max, row) => row.confirmedCount > max ? row.confirmedCount : max, 0)
        colorScale.domain([0, max])

        toPlot.forEach(row => {
          const lvl = row.matched.level
          const state = {
            name: row.cityName || row.provinceName,
            confirmed: row.confirmedCount,
            dead: row.deadCount,
            color: colorScale(row.confirmedCount).hex()
          }
          map.setFeatureState({
            source: 'china',
            sourceLayer: 'china_boundaries_l' + lvl,
            id: row.matched.id
          }, state)
          map.setFeatureState({
            source: 'china',
            sourceLayer: 'china_places_l' + lvl,
            id: row.matched.id
          }, state)
        })
      })

      map.addLayer({
        id: 'l1_data',
        source: 'china',
        'source-layer': 'china_boundaries_l1',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-height': ['*',
            10000,
            ['^', ['number', ['feature-state', 'confirmed'], 0], GAMMA.height]
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
            ['^', ['number', ['feature-state', 'confirmed'], 0], GAMMA.height]
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
        if (featuresL2.length > 0 && featuresL2[0].state.confirmed > 0) {
          const data = [featuresL2[0].properties, featuresL2[0].state]
          tooltip.setData(data).trackPointer().addTo(map)
        } else if (featuresL1.length > 0) {
          const data = [featuresL1[0].properties, featuresL1[0].state]
          tooltip.setData(data).trackPointer().addTo(map)
        } else {
          tooltip.setData(null).remove()
        }
      })
      map.on('movestart', e => tooltip.setData(null).remove())
    })
  }
}

function getData () {
  const NAMES_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/17aJc-9u2H_NRBGKsdbYIzQ-K87X1P4riSew1MBoGcVo/687669852.json'
  const PROVINCES_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/wuhan_coronavirus/DXY.json'
  const CITIES_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/wuhan_coronavirus/DXY_detailed.json'
  return Promise.all([
    fetch(NAMES_URL).then(res => res.json()),
    fetch(PROVINCES_URL).then(res => res.json()),
    fetch(CITIES_URL).then(res => res.json())
  ]).then(([names, provinces, cities]) => {
    const provinceNames = {}
    names.forEach(row => {
      if (row.level_1) {
        provinceNames[row.level_1].children.push(row)
      } else {
        row.children = []
        provinceNames[row.id] = row
      }
    })
    Object.keys(provinceNames).forEach(key => {
      const value = provinceNames[key]
      delete provinceNames[key]
      provinceNames[value.name_chi] = value
    })
    provinces.forEach(row => {
      row.matched = provinceNames[row.provinceName]
    })
    cities.forEach(row => {
      const isCity = row.provinceName.endsWith('市')
      const children = provinceNames[row.provinceName].children
      let matched = children.find(c => c.name_chi === row.cityName)
      if (!matched && isCity) matched = children.find(c => c.name_chi === row.cityName + '区')
      if (!matched && !isCity) matched = children.find(c => c.name_chi === row.cityName + '市')
      if (!matched && !isCity) matched = children.find(c => c.name_chi === row.cityName + '县')
      if (!matched) {
        const test = row.cityName.replace(/(自治)?(县|州)$/, '')
        matched = children.find(c => c.name_chi.includes('自治') && c.name_chi.startsWith(test))
      }
      if (!matched) {
        const correction = CORRECTIONS.find(c => c.provinceName === row.provinceName && c.givenName === row.cityName)
        if (correction) {
          if (Array.isArray(correction.correctName)) {
            matched = []
            correction.correctName.forEach(n => {
              const found = children.find(c => c.name_chi === n)
              if (found) matched.push(found)
            })
          } else {
            matched = children.find(c => c.name_chi === correction.correctName)
          }
        }
      }
      row.matched = matched
    })
    const totalCases = provinces.reduce((sum, row) => sum + row.confirmedCount, 0)
    const lastUpdated = provinces.reduce((max, row) => row.modifyTime > max ? row.modifyTime : max, '')
    cities.forEach(row => {
      if (row.matched) return
      if (MUNICIPALITIES.includes(row.provinceName)) return
      console.log(row.provinceName, row.cityName)
    })
    return [provinces, cities, totalCases, lastUpdated]
  })
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
