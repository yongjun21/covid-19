<template>
  <div class="interactive-map">
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
  { provinceName: '湖北省', givenName: '恩施州', correctName: '恩施土家族苗族自治州' },
  { provinceName: '河南省', givenName: '长垣县', correctName: '长垣市' },
  { provinceName: '湖南省', givenName: '湘西自治州', correctName: '湘西土家族苗族自治州' },
  { provinceName: '重庆市', givenName: '石柱县', correctName: '石柱土家族自治县' },
  { provinceName: '重庆市', givenName: '秀山县', correctName: '秀山土家族苗族自治县' },
  { provinceName: '四川省', givenName: '甘孜州', correctName: '甘孜藏族自治州' },
  { provinceName: '四川省', givenName: '凉山州', correctName: '凉山彝族自治州' },
  { provinceName: '四川省', givenName: '阿坝州', correctName: '阿坝藏族羌族自治州' },
  { provinceName: '四川省', givenName: '凉山', correctName: '凉山彝族自治州' },
  { provinceName: '上海市', givenName: '浦东', correctName: '浦东新区' },
  { provinceName: '云南省', givenName: '西双版纳', correctName: '西双版纳傣族自治州' },
  { provinceName: '云南省', givenName: '德宏', correctName: '德宏傣族景颇族自治州' },
  { provinceName: '海南省', givenName: '陵水县', correctName: '陵水黎族自治县' },
  { provinceName: '海南省', givenName: '琼中县', correctName: '琼中黎族苗族自治县' },
  { provinceName: '海南省', givenName: '陵水', correctName: '陵水黎族自治县' },
  { provinceName: '海南省', givenName: '琼中', correctName: '琼中黎族苗族自治县' },
  { provinceName: '海南省', givenName: '昌江', correctName: '昌江黎族自治县' },
  { provinceName: '海南省', givenName: '乐东', correctName: '乐东黎族自治县' },
  { provinceName: '黑龙江省', givenName: '大兴安岭', correctName: '大兴安岭地区' },
  { provinceName: '吉林省', givenName: '延边', correctName: '延边朝鲜族自治州' },
  { provinceName: '新疆维吾尔自治区', givenName: '伊犁州', correctName: '伊犁哈萨克自治州' },
  { provinceName: '新疆维吾尔自治区', givenName: '第七师', correctName: '第七师（胡杨河市）' },
  { provinceName: '新疆维吾尔自治区', givenName: '第八师', correctName: '石河子市' },
  { provinceName: '新疆维吾尔自治区', givenName: '第九师', correctName: '额敏县' },
  { provinceName: '贵州省', givenName: '黔南州', correctName: '黔南布依族苗族自治州' },
  { provinceName: '贵州省', givenName: '黔西南州', correctName: '黔西南布依族苗族自治州' },
  { provinceName: '贵州省', givenName: '黔东南州', correctName: '黔东南苗族侗族自治州' },
  { provinceName: '天津市', givenName: '宁河区', correctName: '宁河县' },
  { provinceName: '内蒙古自治区', givenName: '赤峰', correctName: ['松山区', '红山区', '元宝山区', '林西县', '宁城县', '克什克腾旗', '巴林左旗', '巴林右旗', '阿鲁科尔沁旗', '翁牛特旗', '喀喇沁旗'] }
]

let colorScale = chroma.scale('OrRd').gamma(GAMMA.color)

export default {
  data () {
    return {
      lastUpdated: null
    }
  },
  filters: {
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
    map.addControl(nav, 'top-left')
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

      dataPending.then(([provinces, cities, lastUpdated]) => {
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
          const matched = Array.isArray(row.matched) ? row.matched : [row.matched]
          matched.forEach(name => {
            const lvl = name.level
            const state = {
              name: row.cityName || row.provinceName,
              confirmed: row.confirmedCount,
              dead: row.deadCount,
              color: colorScale(row.confirmedCount).hex()
            }
            map.setFeatureState({
              source: 'china',
              sourceLayer: 'china_boundaries_l' + lvl,
              id: name.id
            }, state)
            map.setFeatureState({
              source: 'china',
              sourceLayer: 'china_places_l' + lvl,
              id: name.id
            }, state)
          })
        })
      })

      // map.addLayer({
      //   id: 'l2_line',
      //   source: 'china',
      //   'source-layer': 'china_boundaries_l2',
      //   type: 'line',
      //   paint: {
      //     'line-color': 'darkgrey',
      //     'line-width': 1.2,
      //     'line-opacity': 0.8
      //   }
      // })

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
        const featuresL1 = map.queryRenderedFeatures(e.point, {
          layers: ['l1_data']
        })
        const featuresL2 = map.queryRenderedFeatures(e.point, {
          layers: ['l2_data']
        })
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
      if (row.level_1_parent) {
        provinceNames[row.level_1_parent].children.push(row)
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
    const lastUpdated = provinces.reduce((max, row) => row.modifyTime > max ? row.modifyTime : max, '')
    // cities.filter(row => !row.name).forEach(row => {
    //   console.log(row.provinceName, row.cityName)
    // })
    return [provinces, cities, lastUpdated]
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

  .attribution {
    display: block;
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 1;
    padding: 4px 8px;
  }
}
</style>
