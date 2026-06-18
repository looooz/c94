<template>
  <div 
    class="pdf-preview-wrapper"
    :class="{ clickable: clickable }"
    :style="{ width: width, height: height }"
    @click="handleClick"
  >
    <canvas 
      ref="previewCanvas" 
      class="preview-canvas"
      :style="{ display: error ? 'none' : 'block' }"
    />
    <div v-if="loading" class="preview-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
    <div v-if="error" class="preview-error">
      <el-icon><Warning /></el-icon>
      <span>无法预览</span>
    </div>
    <div v-if="showPageInfo && totalPages > 0" class="page-info">
      {{ totalPages }} 页
    </div>
    <div v-if="clickable" class="preview-overlay">
      <div class="overlay-content">
        <el-icon><View /></el-icon>
        <span class="overlay-text">点击预览</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

const props = defineProps({
  src: {
    type: [File, String],
    default: null
  },
  width: {
    type: String,
    default: '120px'
  },
  height: {
    type: String,
    default: '160px'
  },
  scale: {
    type: Number,
    default: 1.5
  },
  clickable: {
    type: Boolean,
    default: true
  },
  showPageInfo: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])

const previewCanvas = ref(null)
const loading = ref(false)
const error = ref(false)
const totalPages = ref(0)
let pdfDoc = null

const loadPdf = async () => {

  if (!props.src) {
    error.value = true
    return
  }

  loading.value = true
  error.value = false
  totalPages.value = 0

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
    console.error('Failed to load PDF for preview:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

const renderPage = async (pageNum) => {

  if (!previewCanvas.value || !pdfDoc) {
    return
  }

  try {
    const page = await pdfDoc.getPage(pageNum)
    const rawViewport = page.getViewport({ scale: 1 })
    
    const wrapperWidth = previewCanvas.value.parentElement.clientWidth
    const wrapperHeight = previewCanvas.value.parentElement.clientHeight
    
    const padding = 8
    const availableWidth = Math.max(wrapperWidth - padding * 2, 50)
    const availableHeight = Math.max(wrapperHeight - padding * 2, 50)
    
    const scaleX = availableWidth / rawViewport.width
    const scaleY = availableHeight / rawViewport.height
    const adaptiveScale = Math.min(scaleX, scaleY)
    
    const finalScale = Math.max(adaptiveScale, props.scale * 0.5, 0.5)
    const viewport = page.getViewport({ scale: finalScale })
    const context = previewCanvas.value.getContext('2d')
    
    previewCanvas.value.width = viewport.width
    previewCanvas.value.height = viewport.height
    
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

const handleClick = () => {
  if (props.clickable && !error.value && !loading.value) {
    emit('click', props.src)
  }
}

watch(() => props.src, () => {
  if (pdfDoc) {
    pdfDoc = null
  }
  loadPdf()
}, { immediate: false })

onMounted(() => {
  if (props.src) {
    loadPdf()
  }
})

onBeforeUnmount(() => {
  if (pdfDoc) {
    pdfDoc = null
  }
})

defineExpose({
  loadPdf
})
</script>

<style scoped>
.pdf-preview-wrapper {
  position: relative;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.pdf-preview-wrapper.clickable {
  cursor: pointer;
}

.pdf-preview-wrapper.clickable:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  background: white;
  display: block;
  object-fit: contain;
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 24px;
}

.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 12px;
  gap: 4px;
}

.page-info {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 2;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 3;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  background: rgba(102, 126, 234, 0.8);
  padding: 10px 16px;
  border-radius: 8px;
  backdrop-filter: blur(4px);
  font-size: 13px;
  font-weight: 500;
}

.overlay-content .el-icon {
  font-size: 24px;
}

.pdf-preview-wrapper.clickable:hover .preview-overlay {
  opacity: 1;
}
</style>
