import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Merge from '../views/Merge.vue'
import Split from '../views/Split.vue'
import Compress from '../views/Compress.vue'
import ToImage from '../views/ToImage.vue'
import FromImage from '../views/FromImage.vue'
import Watermark from '../views/Watermark.vue'
import Pages from '../views/Pages.vue'
import History from '../views/History.vue'

const routes = [
  { path: '/', component: Home, meta: { title: 'PDF处理工具' } },
  { path: '/merge', component: Merge, meta: { title: 'PDF合并' } },
  { path: '/split', component: Split, meta: { title: 'PDF拆分' } },
  { path: '/compress', component: Compress, meta: { title: 'PDF压缩' } },
  { path: '/to-image', component: ToImage, meta: { title: 'PDF转图片' } },
  { path: '/from-image', component: FromImage, meta: { title: '图片转PDF' } },
  { path: '/watermark', component: Watermark, meta: { title: 'PDF加水印' } },
  { path: '/pages', component: Pages, meta: { title: 'PDF页面管理' } },
  { path: '/history', component: History, meta: { title: '历史记录' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'PDF处理工具'
  next()
})

export default router
