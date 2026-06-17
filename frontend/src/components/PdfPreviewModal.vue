<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="900px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="pdf-preview-modal"
  >
    <div v-if="loading" class="modal-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p style="margin-top: 16px; color: #667eea;">正在加载PDF...</p>
    </div>
    <div v-if="error" class="modal-error">
      <el-icon :size="48" color="#f56c6c"><Warning /></el-icon>
      <p style="margin-top: 16px; color: #666;">无法加载PDF文件</p>
    </div>
    <div class="pdf-viewer" :style="{ display: error ? 'none' : 'block' }">
      <div class="viewer-toolbar">
        <div class="toolbar-info">
          第 {{ currentPage }} / {{ totalPages }} 页
        </div>
        <div class="toolbar-controls">
          <el-button 
            :disabled="currentPage === 1" 
            @click="prevPage"
            size="small"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <el-button 
            :disabled="currentPage === totalPages" 
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

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.src) {
    loadPdf()
  }
})

watch(() => props.src, () => {
  if (visible.value) {
    loadPdf()
  }
})

const loadPdf = async () => {

  if (!props.src) {
    error.value = true
    return
  }

  loading.value = true
  error.value = false
  totalPages.value = 0
  currentPage.value = 1

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
    await renderPage(1)
  } catch (err) {
    console.error('Failed to load PDF for modal preview:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

const renderPage = async (pageNum) => {

  if (!viewerCanvas.value || !pdfDoc) return

  try {
    const page = await pdfDoc.getPage(pageNum)
    const scale = 2
    const viewport = page.getViewport({ scale })
    const context = viewerCanvas.value.getContext('2d')
    
    viewerCanvas.value.width = viewport.width
    viewerCanvas.value.height = viewport.height
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      throw err
    }
  }
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
  if (pdfDoc) {
    pdfDoc = null
  }
}

onBeforeUnmount(() => {
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
