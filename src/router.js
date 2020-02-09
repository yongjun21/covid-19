import Vue from 'vue'
import VueRouter from 'vue-router'

import InteractiveMap from './components/InteractiveMap.vue'
import ScrollyMap from './components/ScrollyMap.vue'

Vue.use(VueRouter)

export default new VueRouter({
  mode: 'history',
  routes: [
    { path: '/', component: InteractiveMap },
    { path: '/scrolly', component: ScrollyMap },
    { path: '*', redirect: '/' }
  ]
})
