import Vue from 'vue'

import { TRANSLATE, CORRECTIONS, MUNICIPALITIES } from './constants'

const store = Vue.observable({
  data: {},
  total: [],
  dates: [],
  ready: false,
  lastUpdated: null
})
export default store

const countdown = getCountdown('2020-01-23')
const yesterday = countdown.next().value

const NAMES_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/17aJc-9u2H_NRBGKsdbYIzQ-K87X1P4riSew1MBoGcVo/687669852.json'
const SUMMARY_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/2019-ncov/timeseries.json'
const DETAIL_URL = 'https://s3-st-graphics-json.s3-ap-southeast-1.amazonaws.com/2019-ncov/cities-timeseries/'

store.initialize = () => Promise.all([
  fetch(NAMES_URL).then(res => res.json()),
  fetch(SUMMARY_URL).then(res => res.json()),
  fetch(DETAIL_URL + yesterday + '.json').then(res => res.json())
]).then(([names, summary, detail]) => {
  const provinceNames = {}
  names.forEach(row => {
    if (row.id === row.level_1) {
      row.children = []
      provinceNames[row.province_name] = row
    } else {
      provinceNames[row.province_name].children.push(row)
    }
  })

  store.dates.push(yesterday)
  const total = summary.reduce((sum, row) => sum + (row.date === yesterday && row.country ? row.cases : 0), 0)
  store.total.push(total)
  store.lastUpdated = detail.reduce((max, row) => row.modifyTime > max ? row.modifyTime : max, '2020-01-23')

  prepareSummary(summary, provinceNames)
  prepareDetail(detail, provinceNames)

  summary.forEach(row => {
    if (!row.matched) return
    if (row.date !== yesterday) return
    if (MUNICIPALITIES.includes(row.provinceName)) {
      Vue.set(store.data, row.matched.id, {
        id: row.matched.id,
        name: row.provinceName,
        lvl: row.matched.level,
        cases: [row.confirmedCount]
      })
    }
  })
  detail.forEach(row => {
    if (!row.matched) return
    if (!MUNICIPALITIES.includes(row.provinceName)) {
      Vue.set(store.data, row.matched.id, {
        id: row.matched.id,
        name: row.cityName,
        lvl: row.matched.level,
        cases: [row.confirmedCount]
      })
    }
  })

  store.continue = function () {
    const next = countdown.next()

    if (next.done) {
      store.ready = true
      return
    }

    store.dates.push(next.value)
    const total = summary.reduce((sum, row) => sum + (row.date === next.value && row.country ? row.cases : 0), 0)
    store.total.push(total)

    return fetch(DETAIL_URL + next.value + '.json').then(res => res.json())
      .then(detail => {
        prepareDetail(detail, provinceNames)
        summary.forEach(row => {
          if (!row.matched) return
          if (row.date !== next.value) return
          if (MUNICIPALITIES.includes(row.provinceName)) {
            store.data[row.matched.id].cases.push(row.confirmedCount)
          }
        })
        detail.forEach(row => {
          if (!row.matched) return
          if (!MUNICIPALITIES.includes(row.provinceName)) {
            if (!(row.matched.id in store.data)) return
            store.data[row.matched.id].cases.push(row.confirmedCount)
          }
        })
        store.loaded++
        return store.continue()
      })
  }

  return store
})

function * getCountdown (until) {
  const d = new Date()
  d.setHours(d.getHours() + 8)
  let next
  do {
    d.setDate(d.getDate() - 1)
    next = d.toISOString().slice(0, 10)
    yield next
  } while (next > until)
}

function prepareSummary (summary, provinceNames) {
  summary.forEach(row => {
    if (!row.province) return
    row.provinceName = TRANSLATE[row.province]
    row.confirmedCount = row.cases
    row.matched = provinceNames[row.provinceName]
  })
  return summary
}

function prepareDetail (detail, provinceNames) {
  detail.forEach(row => {
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
    // if (!matched && !MUNICIPALITIES.includes(row.provinceName)) {
    //   console.log(row.provinceName, row.cityName)
    // }
    row.matched = matched
  })
  return detail
}
