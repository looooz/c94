<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF加水印</h1>
      <p>添加文字或图片水印，支持自定义位置和透明度</p>
    </div>

    <div class="tool-card">
      <div class="setting-row">
        <span class="setting-label">水印类型：</span>
        <el-radio-group v-model="watermarkType">
          <el-radio value="text">文字水印</el-radio>
          <el-radio value="image">图片水印</el-radio>
        </el-radio-group>
      </div>

      <div 
        class="upload-area"
        :class="{ dragover: isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
        v-if="!file"
      >
        <el-icon :size="48" color="#667eea"><UploadFilled /></el-icon>
        <p style="font-size: 18px; margin-top: 16px; color: #333;">
          拖拽PDF文件到此处，或点击选择文件
        </p>
        <input 
          ref="fileInput"
          type="file" 
          accept=".pdf"
          style="display: none;"
          @change="handleFileSelect"
        />
      </div>

      <div v-if="file" class="file-item" style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <PdfPreview 
            :src="file" 
            width="80px" 
            height="100px" 
            :scale="1"
            @click="openPreviewModal(file, file.name)"
          />
          <div>
            <span style="font-weight: 500; color: #333;">{{ file.name }}</span>
            <div style="color: #999; font-size: 13px; margin-top: 4px;">
              {{ formatFileSize(file.size) }}
            </div>
          </div>
        </div>
        <el-button type="danger" text @click="removeFile">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>

      <div v-if="file">
        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">水印文字：</span>
          <el-input v-model="watermarkText" placeholder="请输入水印文字" style="width: 300px;" />
          <span v-if="hasChinese" style="color: #e6a23c; margin-left: 10px; font-size: 13px;">
            <el-icon><Warning /></el-icon>
            检测到中文，将自动生成图片水印
          </span>
        </div>

        <div v-if="watermarkType === 'text' && !hasChinese" class="setting-row">
          <span class="setting-label">字体：</span>
          <el-select v-model="fontFamily" style="width: 200px;">
            <el-option label="Helvetica" value="Helvetica" />
            <el-option label="Helvetica Bold" value="Helvetica-Bold" />
            <el-option label="Times Roman" value="Times-Roman" />
            <el-option label="Times Bold" value="Times-Bold" />
            <el-option label="Courier" value="Courier" />
            <el-option label="Courier Bold" value="Courier-Bold" />
          </el-select>
        </div>

        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">字体大小：</span>
          <el-input-number v-model="fontSize" :min="12" :max="200" />
        </div>

        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">文字颜色：</span>
          <el-color-picker v-model="fontColor" show-alpha />
        </div>

        <div v-if="watermarkType === 'image'" class="setting-row">
          <span class="setting-label">水印图片：</span>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept="image/jpeg,image/png,image/jpg"
            @change="handleWatermarkImageSelect"
          >
            <el-button>
              <el-icon><Upload /></el-icon>
              选择水印图片
            </el-button>
          </el-upload>
          <span v-if="watermarkImage" style="color: #67c23a;">
            <el-icon><CircleCheckFilled /></el-icon>
            已选择: {{ watermarkImage.name }}
          </span>
        </div>

        <div v-if="watermarkType === 'image'" class="setting-row">
          <span class="setting-label">图片缩放：</span>
          <el-slider v-model="imageScale" :min="0.1" :max="2" :step="0.1" style="width: 200px;" />
          <span>{{ imageScale.toFixed(1) }}x</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">水印位置：</span>
          <el-select v-model="position" style="width: 200px;">
            <el-option label="左上角" value="top-left" />
            <el-option label="顶部居中" value="top-center" />
            <el-option label="右上角" value="top-right" />
            <el-option label="中间靠左" value="center-left" />
            <el-option label="居中" value="center" />
            <el-option label="中间靠右" value="center-right" />
            <el-option label="左下角" value="bottom-left" />
            <el-option label="底部居中" value="bottom-center" />
            <el-option label="右下角" value="bottom-right" />
            <el-option label="平铺" value="tiled" />
            <el-option label="满屏" value="full-tiled" />
          </el-select>
        </div>

        <div class="setting-row">
          <span class="setting-label">透明度：</span>
          <el-slider v-model="opacity" :min="0.1" :max="1" :step="0.1" style="width: 200px;" />
          <span>{{ Math.round(opacity * 100) }}%</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">旋转角度：</span>
          <el-select v-model="rotation" style="width: 150px;">
            <el-option label="0°" :value="0" />
            <el-option label="45°" :value="45" />
            <el-option label="90°" :value="90" />
            <el-option label="180°" :value="180" />
            <el-option label="-45°" :value="-45" />
          </el-select>
        </div>

        <div class="watermark-preview">
          <h4 style="margin-bottom: 16px;">预览效果</h4>
          <div class="watermark-preview-box">
            <div 
              v-if="watermarkType === 'text'"
              :style="previewStyle"
            >
              {{ watermarkText || '水印文字' }}
            </div>
            <div 
              v-else-if="watermarkImagePreview"
              :style="previewStyle"
            >
              <img :src="watermarkImagePreview" style="max-width: 100px; max-height: 60px;" />
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="addWatermark" :disabled="loading || !canSubmit">
            <el-icon style="margin-right: 8px;"><Stamp /></el-icon>
            添加水印
          </button>
        </div>
      </div>

      <div v-if="file && !result" class="preview-section">
        <h3 style="margin-bottom: 16px; color: #333;">
          <el-icon style="margin-right: 8px;"><View /></el-icon>
          原始PDF预览
        </h3>
        <div class="pdf-preview-container">
          <canvas ref="beforePreviewCanvas" class="preview-canvas"></canvas>
        </div>
        <div v-if="totalPages > 1" class="page-navigation">
          <el-button 
            :disabled="currentPage === 1" 
            @click="currentPage--; renderPreviewPage('before', currentPage)"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <span style="margin: 0 16px;">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <el-button 
            :disabled="currentPage === totalPages" 
            @click="currentPage++; renderPreviewPage('before', currentPage)"
          >
            下一页 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          水印添加成功！
        </h3>
        <p style="margin-bottom: 12px;">
          文件名：{{ result.fileName }}
        </p>
        <p style="margin-bottom: 16px;">
          文件大小：{{ formatFileSize(result.fileSize) }}
        </p>
        
        <div class="preview-comparison">
          <div class="preview-column">
            <h4 style="margin-bottom: 12px; color: #999;">处理前</h4>
            <div class="pdf-preview-container">
              <canvas ref="beforeCompareCanvas" class="preview-canvas"></canvas>
            </div>
          </div>
          <div class="preview-column">
            <h4 style="margin-bottom: 12px; color: #667eea;">处理后</h4>
            <div class="pdf-preview-container">
              <canvas ref="afterPreviewCanvas" class="preview-canvas"></canvas>
            </div>
          </div>
        </div>
        
        <div v-if="totalPages > 1" class="page-navigation">
          <el-button 
            :disabled="comparePage === 1" 
            @click="comparePage--; renderComparePages(comparePage)"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <span style="margin: 0 16px;">第 {{ comparePage }} / {{ totalPages }} 页</span>
          <el-button 
            :disabled="comparePage === totalPages" 
            @click="comparePage++; renderComparePages(comparePage)"
          >
            下一页 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="downloadResult">
            <el-icon style="margin-right: 8px;"><Download /></el-icon>
            下载带水印的PDF
          </button>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在添加水印..." />
    
    <PdfPreviewModal 
      v-model="previewModalVisible" 
      :src="previewModalSrc" 
      :title="previewModalTitle"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  addWatermark as addWatermarkApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)

const watermarkType = ref('text')
const watermarkText = ref('CONFIDENTIAL')
const fontFamily = ref('Helvetica')
const fontSize = ref(48)
const fontColor = ref('#ff0000')
const watermarkImage = ref(null)
const watermarkImagePreview = ref(null)
const generatedWatermarkImage = ref(null)
const imageScale = ref(0.5)
const position = ref('center')
const opacity = ref(0.3)
const rotation = ref(0)

const beforePreviewCanvas = ref(null)
const beforeCompareCanvas = ref(null)
const afterPreviewCanvas = ref(null)
const pdfDoc = ref(null)
const afterPdfDoc = ref(null)
const totalPages = ref(0)
const currentPage = ref(1)
const comparePage = ref(1)

const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const hasChinese = computed(() => {
  return /[\u4e00-\u9fa5]/.test(watermarkText.value)
})

const canSubmit = computed(() => {
  if (watermarkType.value === 'image' && !watermarkImage.value) return false
  if (watermarkType.value === 'text' && !watermarkText.value.trim()) return false
  return true
})

const previewStyle = computed(() => {
  const baseStyle = {
    opacity: opacity.value,
    transform: `rotate(${rotation.value}deg)`,
    color: watermarkType.value === 'text' ? fontColor.value : undefined,
    fontSize: watermarkType.value === 'text' ? `${fontSize.value / 3}px` : undefined,
    fontFamily: fontFamily.value,
    fontWeight: fontFamily.value.includes('Bold') ? 'bold' : 'normal'
  }
  
  const positions = {
    'top-left': { top: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'top-right': { top: '20px', right: '20px' },
    'center-left': { top: '50%', left: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'center': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation.value}deg)` },
    'center-right': { top: '50%', right: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-center': { bottom: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'bottom-right': { bottom: '20px', right: '20px' },
    'tiled': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(-30deg)` },
    'full-tiled': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(-45deg)` }
  }
  
  return { ...baseStyle, ...positions[position.value], position: 'absolute' }
})

const generateWatermarkImage = () => {
  if (!hasChinese.value || !watermarkText.value.trim()) {
    generatedWatermarkImage.value = null
    return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSize.value}px "Microsoft YaHei", "SimHei", sans-serif`
  const textWidth = tempCtx.measureText(watermarkText.value).width
  
  const padding = 40
  canvas.width = textWidth + padding * 2
  canvas.height = fontSize.value + padding * 2
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  ctx.font = `${fontSize.value}px "Microsoft YaHei", "SimHei", sans-serif`
  ctx.fillStyle = fontColor.value
  ctx.globalAlpha = 1
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(watermarkText.value, canvas.width / 2, canvas.height / 2)
  
  const dataUrl = canvas.toDataURL('image/png')
  
  fetch(dataUrl)
    .then(res => res.blob())
    .then(blob => {
      generatedWatermarkImage.value = new File([blob], 'chinese-watermark.png', { type: 'image/png' })
      watermarkImagePreview.value = dataUrl
    })
}

watch([watermarkText, fontSize, fontColor], () => {
  if (watermarkType.value === 'text' && hasChinese.value) {
    generateWatermarkImage()
  }
}, { immediate: true })

watch(watermarkType, () => {
  if (watermarkType.value === 'text' && hasChinese.value) {
    generateWatermarkImage()
  } else {
    generatedWatermarkImage.value = null
  }
})

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = async (e) => {
  const selectedFile = e.target.files[0]
  if (selectedFile && selectedFile.type === 'application/pdf') {
    file.value = selectedFile
    result.value = null
    await loadPdfForPreview(selectedFile)
  }
  e.target.value = ''
}

const handleDrop = async (e) => {
  isDragging.value = false
  const droppedFile = e.dataTransfer.files[0]
  if (droppedFile && droppedFile.type === 'application/pdf') {
    file.value = droppedFile
    result.value = null
    await loadPdfForPreview(droppedFile)
  } else {
    ElMessage.warning('请拖入PDF文件')
  }
}

const loadPdfForPreview = async (pdfFile) => {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    pdfDoc.value = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: cMapBaseUrl,
      cMapPacked: true
    }).promise
    totalPages.value = pdfDoc.value.numPages
    currentPage.value = 1
    await nextTick()
    await renderPreviewPage('before', 1)
  } catch (error) {
    console.error('Failed to load PDF for preview:', error)
  }
}

const loadAfterPdfForPreview = async (downloadUrl) => {
  try {
    const response = await fetch(downloadUrl)
    const arrayBuffer = await response.arrayBuffer()
    afterPdfDoc.value = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: cMapBaseUrl,
      cMapPacked: true
    }).promise
    comparePage.value = 1
    await nextTick()
    await renderComparePages(1)
  } catch (error) {
    console.error('Failed to load processed PDF for preview:', error)
  }
}

const renderPreviewPage = async (type, pageNum) => {
  const canvas = type === 'before' ? beforePreviewCanvas.value : beforeCompareCanvas.value
  if (!canvas || !pdfDoc.value) return
  
  const page = await pdfDoc.value.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1.5 })
  const context = canvas.getContext('2d')
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise
}

const renderComparePages = async (pageNum) => {
  await renderPreviewPage('before-compare', pageNum)
  
  const canvas = afterPreviewCanvas.value
  if (!canvas || !afterPdfDoc.value) return
  
  const page = await afterPdfDoc.value.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1.5 })
  const context = canvas.getContext('2d')
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise
}

const handleWatermarkImageSelect = (uploadFile) => {
  watermarkImage.value = uploadFile.raw
  const reader = new FileReader()
  reader.onload = (e) => {
    watermarkImagePreview.value = e.target.result
  }
  reader.readAsDataURL(uploadFile.raw)
}

const removeFile = () => {
  file.value = null
  result.value = null
  pdfDoc.value = null
  afterPdfDoc.value = null
  totalPages.value = 0
}

const addWatermark = async () => {
  if (!file.value) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  if (!canSubmit.value) {
    ElMessage.warning('请完善水印设置')
    return
  }

  let uploadWatermarkImage = watermarkImage.value
  if (watermarkType.value === 'text' && hasChinese.value) {
    if (!generatedWatermarkImage.value) {
      generateWatermarkImage()
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    uploadWatermarkImage = generatedWatermarkImage.value
  }

  const options = {
    type: watermarkType.value,
    text: watermarkText.value,
    fontFamily: fontFamily.value,
    fontSize: fontSize.value,
    color: fontColor.value,
    opacity: opacity.value,
    position: position.value,
    rotation: rotation.value,
    imageScale: hasChinese.value ? 1.0 : imageScale.value
  }

  loading.value = true
  result.value = null

  try {
    const response = await addWatermarkApi(file.value, uploadWatermarkImage, options)
    result.value = response.data
    ElMessage.success('水印添加成功！')
    await loadAfterPdfForPreview(response.data.downloadUrl)
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '添加水印失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `watermarked_${Date.now()}.pdf`)
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}
</script>

<style scoped>
.preview-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.pdf-preview-container {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: auto;
  max-height: 500px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}

.preview-canvas {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  background: white;
  max-width: 100%;
}

.page-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 16px;
}

.preview-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 24px 0;
}

.preview-column {
  text-align: center;
}

.preview-column h4 {
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .preview-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
