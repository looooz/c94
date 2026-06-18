<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="900px"
    :close-on-click-modal="false"
    :append-to-body="true"
    :destroy-on-close="false"
    @close="handleClose"
    @opened="handleDialogOpened"
    class="pdf-preview-modal"
  >
    <div v-if="loading" class="modal-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p style="margin-top: 16px; color: #667eea;">正在加载PDF...</p>
    </div>
    <div v-if="error" class="modal-error">
      <el-icon :size="48" color="#f56c6c"><Warning /></el-icon>
      <p style="margin-top: 16px; color: #666;">无法加载PDF文件</p>
      <el-button type="primary" style="margin-top: 20px;" @click="retryLoad">
        <el-icon><Refresh /></el-icon>
        重新加载
      </el-button>
    </div>
    <div class="pdf-viewer" :style="{ display: error ? 'none' : 'flex' }">
      <div class="viewer-toolbar">
        <div class="toolbar-info">
          <el-icon><Document /></el-icon>
          <span v-if="totalPages > 0">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <span v-else>加载中...</span>
        </div>
        <div class="toolbar-controls">
          <el-button 
            :disabled="currentPage <= 1 || totalPages === 0" 
            @click="prevPage"
            size="small"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <el-pagination
            v-if="totalPages > 0"
            v-model:current-page="currentPage"
            :page-count="totalPages"
            :page-size="1"
            layout="prev, pager, next"
            size="small"
            @current-change="(p) => renderPage(p)"
          />
          <el-button 
            :disabled="currentPage >= totalPages || totalPages === 0" 
            @click="nextPage"
            size="small"
          >
            下一页 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
      <div class="canvas-container">
        <canvas ref="viewerCanvas" class="viewer-canvas" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  src: {
    type: [File, String],
    default: null
  },
  title: {
    type: String,
    default: 'PDF预览'
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)
const loading = ref(false)
const error = ref(false)
const totalPages = ref(0)
const currentPage = ref(1)
const viewerCanvas = ref(null)
let pdfDoc = null
let pendingLoad = false
let loadAttempts = 0
const MAX_LOAD_ATTEMPTS = 3

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    pendingLoad = true
    loadAttempts = 0
  } else {
    pendingLoad = false
  }
})

watch(() => props.src, () => {
  if (visible.value) {
    pendingLoad = true
    loadAttempts = 0
    tryStartLoad()
  }
})

const handleDialogOpened = async () => {
  await nextTick()
  if (pendingLoad && props.src) {
    tryStartLoad()
  }
}

const tryStartLoad = async () => {
  if (!viewerCanvas.value) {
    loadAttempts++
    if (loadAttempts <= MAX_LOAD_ATTEMPTS) {
      await nextTick()
      setTimeout(() => {
        tryStartLoad()
      }, 50 * loadAttempts)
    } else {
      console.error('Canvas element not available after multiple attempts')
      error.value = true
    }
    return
  }
  pendingLoad = false
  loadPdf()
}

const loadPdf = async () => {
  if (!props.src) {
    error.value = true
    return
  }

  loading.value = true
  error.value = false
  totalPages.value = 0
  currentPage.value = 1

  let maxAttempts = 3
  let attempt = 0

  while (attempt < maxAttempts) {
    try {
      let arrayBuffer
      if (props.src instanceof File) {
        arrayBuffer = await props.src.arrayBuffer()
      } else if (typeof props.src === 'string') {
        const response = await fetch(props.src)
        arrayBuffer = await response.arrayBuffer()
      }

      if (!arrayBuffer) {
        throw new Error('Invalid source')
      }

      pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: cMapBaseUrl,
        cMapPacked: true
      }).promise
      totalPages.value = pdfDoc.numPages

      await nextTick()
      if (!viewerCanvas.value) {
        await new Promise(resolve => setTimeout(resolve, 100))
        await nextTick()
      }
      await renderPage(1)
      error.value = false
      break
    } catch (err) {
      attempt++
      console.error(`Failed to load PDF (attempt ${attempt}/${maxAttempts}):`, err)
      if (attempt >= maxAttempts) {
        error.value = true
      } else {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt))
      }
    }
  }

  loading.value = false
}

const renderPage = async (pageNum) => {
  if (!viewerCanvas.value) {
    await nextTick()
    if (!viewerCanvas.value) {
      console.warn('Viewer canvas is not available')
      return
    }
  }

  if (!pdfDoc) {
    console.warn('PDF document is not loaded')
    return
  }

  try {
    const page = await pdfDoc.getPage(pageNum)
    const container = viewerCanvas.value.parentElement
    const containerWidth = container?.clientWidth || 900
    const containerHeight = container?.clientHeight || 600
    const padding = 40

    const availW = Math.max(containerWidth - padding * 2, 100)
    const availH = Math.max(containerHeight - padding * 2, 100)

    const rawViewport = page.getViewport({ scale: 1 })
    const scaleW = availW / rawViewport.width
    const scaleH = availH / rawViewport.height
    const fitScale = Math.min(scaleW, scaleH)

    const dpr = window.devicePixelRatio || 1
    const renderScale = fitScale * dpr
    
    const viewport = page.getViewport({ scale: renderScale })
    const context = viewerCanvas.value.getContext('2d')
    
    viewerCanvas.value.width = Math.floor(viewport.width)
    viewerCanvas.value.height = Math.floor(viewport.height)

    viewerCanvas.value.style.width = `${Math.floor(rawViewport.width * fitScale)}px`
    viewerCanvas.value.style.height = `${Math.floor(rawViewport.height * fitScale)}px`
    viewerCanvas.value.style.display = 'block'
    
    context.clearRect(0, 0, viewport.width, viewport.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, viewport.width, viewport.height)
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('Failed to render page:', err)
      throw err
    }
  }
}

const retryLoad = () => {
  loadAttempts = 0
  pendingLoad = true
  error.value = false
  tryStartLoad()
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    renderPage(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPage(currentPage.value)
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
  pendingLoad = false
  if (pdfDoc) {
    pdfDoc = null
  }
}

onBeforeUnmount(() => {
  pendingLoad = false
  if (pdfDoc) {
    pdfDoc = null
  }
})
</script>

<style scoped>
.pdf-preview-modal :deep(.el-dialog__body) {
  padding: 0;
}

.modal-loading,
.modal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.viewer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.toolbar-info {
  font-weight: 500;
  color: #333;
}

.canvas-container {
  flex: 1;
  overflow: auto;
  background: #e8e8e8;
  display: flex;
  justify-content: center;
  padding: 20px;
}

.viewer-canvas {
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 100%;
}
</style>
