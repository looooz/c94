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
      <div class="upload-section">
        <div 
          class="upload-area"
          :class="{ dragover: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
          v-if="!file"
        >
          <div class="upload-icon-wrapper">
            <el-icon :size="56" color="#667eea"><UploadFilled /></el-icon>
          </div>
          <p class="upload-title">拖拽PDF文件到此处，或点击选择文件</p>
          <p class="upload-hint">支持 PDF 格式文件</p>
          <input 
            ref="fileInput"
            type="file" 
            accept=".pdf"
            style="display: none;"
            @change="handleFileSelect"
          />
        </div>

        <div v-if="file" class="selected-file-card">
          <div class="file-info-wrapper">
            <PdfPreview 
              :src="file" 
              width="100px" 
              height="130px" 
              :scale="1"
              class="file-thumbnail"
              @click="openPreviewModal(file, file.name)"
            />
            <div class="file-details">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-meta">
                <span class="file-size">
                  <el-icon><Document /></el-icon>
                  {{ formatFileSize(file.size) }}
                </span>
                <span v-if="totalPages > 0" class="file-pages">
                  <el-icon><Files /></el-icon>
                  {{ totalPages }} 页
                </span>
              </div>
              <div class="file-status">
                <el-tag type="success" size="small" effect="light">
                  <el-icon><CircleCheckFilled /></el-icon>
                  已上传
                </el-tag>
              </div>
            </div>
          </div>
          <el-button type="danger" @click="removeFile" class="remove-btn">
            <el-icon><Delete /></el-icon>
            移除文件
          </el-button>
        </div>
      </div>

      <div v-if="file" class="settings-container">
        <div class="settings-section">
          <div class="section-header">
            <div class="section-title">
              <el-icon color="#667eea"><SetUp /></el-icon>
              <span>基础设置</span>
            </div>
          </div>
          <div class="section-content">
            <div class="setting-row">
              <span class="setting-label">水印类型</span>
              <el-radio-group v-model="watermarkType" class="type-radio-group">
                <el-radio-button value="text">
                  <el-icon><EditPen /></el-icon>
                  文字水印
                </el-radio-button>
                <el-radio-button value="image">
                  <el-icon><Picture /></el-icon>
                  图片水印
                </el-radio-button>
              </el-radio-group>
            </div>
          </div>
        </div>

        <div v-if="watermarkType === 'text'" class="settings-section">
          <div class="section-header">
            <div class="section-title">
              <el-icon color="#667eea"><EditPen /></el-icon>
              <span>文字设置</span>
            </div>
          </div>
          <div class="section-content">
            <div class="setting-row">
              <span class="setting-label">水印文字</span>
              <div class="setting-control">
                <el-input v-model="watermarkText" placeholder="请输入水印文字" maxlength="50" show-word-limit />
                <div v-if="hasChinese" class="chinese-warning">
                  <el-icon color="#e6a23c"><Warning /></el-icon>
                  <span>检测到中文，将自动生成图片水印</span>
                </div>
              </div>
            </div>

            <div v-if="!hasChinese" class="setting-row">
              <span class="setting-label">字体</span>
              <el-select v-model="fontFamily" class="control-select">
                <el-option label="Helvetica" value="Helvetica" />
                <el-option label="Helvetica Bold" value="Helvetica-Bold" />
                <el-option label="Times Roman" value="Times-Roman" />
                <el-option label="Times Bold" value="Times-Bold" />
                <el-option label="Courier" value="Courier" />
                <el-option label="Courier Bold" value="Courier-Bold" />
              </el-select>
            </div>

            <div class="setting-row">
              <span class="setting-label">字体大小</span>
              <div class="setting-control-inline">
                <el-input-number v-model="fontSize" :min="12" :max="200" :step="2" />
                <span class="control-unit">px</span>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">文字颜色</span>
              <div class="setting-control-inline">
                <el-color-picker v-model="fontColor" show-alpha size="default" />
                <span class="color-value">{{ fontColor }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="watermarkType === 'image'" class="settings-section">
          <div class="section-header">
            <div class="section-title">
              <el-icon color="#667eea"><Picture /></el-icon>
              <span>图片设置</span>
            </div>
          </div>
          <div class="section-content">
            <div class="setting-row">
              <span class="setting-label">水印图片</span>
              <div class="setting-control">
                <el-upload
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/jpeg,image/png,image/jpg"
                  @change="handleWatermarkImageSelect"
                >
                  <el-button type="primary" plain>
                    <el-icon><Upload /></el-icon>
                    选择水印图片
                  </el-button>
                </el-upload>
                <div v-if="watermarkImage" class="image-info">
                  <div class="image-preview-thumb">
                    <img :src="watermarkImagePreview" />
                  </div>
                  <div class="image-details">
                    <span class="image-name">{{ watermarkImage.name }}</span>
                    <span class="image-size">{{ formatFileSize(watermarkImage.size) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">图片缩放</span>
              <div class="setting-control-inline">
                <el-slider v-model="imageScale" :min="0.1" :max="2" :step="0.1" class="control-slider" />
                <el-tag type="info" effect="plain" class="scale-tag">{{ imageScale.toFixed(1) }}x</el-tag>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <div class="section-title">
              <el-icon color="#667eea"><Location /></el-icon>
              <span>位置与效果</span>
            </div>
          </div>
          <div class="section-content">
            <div class="setting-row">
              <span class="setting-label">水印位置</span>
              <el-select v-model="position" class="control-select">
                <el-option label="左上角" value="top-left">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 16px; height: 16px; border: 1px solid #ddd; position: relative;">
                      <span style="position: absolute; top: 0; left: 0; width: 6px; height: 6px; background: #667eea;"></span>
                    </span>
                    左上角
                  </span>
                </el-option>
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
              <span class="setting-label">透明度</span>
              <div class="setting-control-inline">
                <el-slider v-model="opacity" :min="0.1" :max="1" :step="0.05" class="control-slider" />
                <el-tag type="info" effect="plain" class="scale-tag">{{ Math.round(opacity * 100) }}%</el-tag>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">旋转角度</span>
              <el-select v-model="rotation" class="control-select-sm">
                <el-option label="0°" :value="0" />
                <el-option label="15°" :value="15" />
                <el-option label="30°" :value="30" />
                <el-option label="45°" :value="45" />
                <el-option label="60°" :value="60" />
                <el-option label="90°" :value="90" />
                <el-option label="180°" :value="180" />
                <el-option label="-15°" :value="-15" />
                <el-option label="-30°" :value="-30" />
                <el-option label="-45°" :value="-45" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="settings-section preview-section-card">
          <div class="section-header">
            <div class="section-title">
              <el-icon color="#667eea"><View /></el-icon>
              <span>水印预览</span>
            </div>
            <span class="section-hint">预览效果仅供参考，实际效果以生成的PDF为准</span>
          </div>
          <div class="section-content">
            <div class="watermark-preview-wrapper">
              <div class="preview-page" ref="previewPageRef">
                <div class="page-lines">
                  <div v-for="i in 8" :key="i" class="page-line"></div>
                </div>
                <template v-if="isTiledPosition">
                  <div 
                    v-for="(wm, idx) in tiledWatermarkList" 
                    :key="idx"
                    class="watermark-layer tiled-watermark"
                    :style="wm.style"
                  >
                    <template v-if="watermarkType === 'text'">
                      {{ watermarkText || '水印文字' }}
                    </template>
                    <template v-else-if="watermarkImagePreview">
                      <img :src="watermarkImagePreview" class="watermark-img" />
                    </template>
                  </div>
                </template>
                <template v-else>
                  <div 
                    v-if="watermarkType === 'text'"
                    class="watermark-layer"
                    :style="previewStyle"
                  >
                    {{ watermarkText || '水印文字' }}
                  </div>
                  <div 
                    v-else-if="watermarkImagePreview"
                    class="watermark-layer"
                    :style="previewStyle"
                  >
                    <img :src="watermarkImagePreview" class="watermark-img" />
                  </div>
                  <div v-else class="watermark-placeholder">
                    <el-icon color="#ccc"><Picture /></el-icon>
                    <span>请选择水印图片</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="action-section">
          <div class="action-tip" v-if="!canSubmit">
            <el-icon color="#e6a23c"><InfoFilled /></el-icon>
            <span>{{ watermarkType === 'image' ? '请选择水印图片' : '请输入水印文字' }}</span>
          </div>
          <button class="action-button primary-large" @click="addWatermark" :disabled="loading || !canSubmit">
            <el-icon style="margin-right: 10px;"><Stamp /></el-icon>
            {{ loading ? '正在添加水印...' : '添加水印' }}
          </button>
        </div>
      </div>

      <div v-if="file && !result" class="original-preview-section">
        <div class="section-header">
          <div class="section-title">
            <el-icon color="#667eea"><Document /></el-icon>
            <span>原始PDF预览</span>
          </div>
        </div>
        <div class="pdf-preview-container">
          <canvas ref="beforePreviewCanvas" class="preview-canvas"></canvas>
        </div>
        <div v-if="totalPages > 1" class="page-navigation">
          <el-button 
            :disabled="currentPage === 1" 
            @click="currentPage--; renderPreviewPage('before', currentPage)"
            size="small"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <el-pagination
            v-model:current-page="currentPage"
            :page-count="totalPages"
            :page-size="1"
            layout="prev, pager, next"
            size="small"
            @current-change="(p) => renderPreviewPage('before', p)"
          />
          <el-button 
            :disabled="currentPage === totalPages" 
            @click="currentPage++; renderPreviewPage('before', currentPage)"
            size="small"
          >
            下一页 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="result" class="result-section">
        <div class="result-success-banner">
          <div class="success-icon">
            <el-icon :size="32"><CircleCheckFilled /></el-icon>
          </div>
          <div class="success-info">
            <h3>水印添加成功！</h3>
            <div class="success-meta">
              <span><el-icon><Document /></el-icon> {{ result.fileName }}</span>
              <span><el-icon><FolderOpened /></el-icon> {{ formatFileSize(result.fileSize) }}</span>
            </div>
          </div>
        </div>
        
        <div class="preview-comparison">
          <div class="preview-column">
            <div class="column-header before">
              <el-icon><Document /></el-icon>
              <span>处理前</span>
            </div>
            <div class="pdf-preview-container">
              <canvas ref="beforeCompareCanvas" class="preview-canvas"></canvas>
            </div>
          </div>
          <div class="preview-column">
            <div class="column-header after">
              <el-icon><CircleCheckFilled /></el-icon>
              <span>处理后</span>
            </div>
            <div class="pdf-preview-container">
              <canvas ref="afterPreviewCanvas" class="preview-canvas"></canvas>
            </div>
          </div>
        </div>
        
        <div v-if="totalPages > 1" class="page-navigation">
          <el-button 
            :disabled="comparePage === 1" 
            @click="comparePage--; renderComparePages(comparePage)"
            size="small"
          >
            <el-icon><ArrowLeft /></el-icon> 上一页
          </el-button>
          <el-pagination
            v-model:current-page="comparePage"
            :page-count="totalPages"
            :page-size="1"
            layout="prev, pager, next"
            size="small"
            @current-change="(p) => renderComparePages(p)"
          />
          <el-button 
            :disabled="comparePage === totalPages" 
            @click="comparePage++; renderComparePages(comparePage)"
            size="small"
          >
            下一页 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div class="result-actions">
          <button class="action-button primary-large" @click="downloadResult">
            <el-icon style="margin-right: 10px;"><Download /></el-icon>
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
import { ref, computed, watch, nextTick, onMounted } from 'vue'
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
const previewPageRef = ref(null)
const pdfDoc = ref(null)
const afterPdfDoc = ref(null)
const totalPages = ref(0)
const currentPage = ref(1)
const comparePage = ref(1)

const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const PREVIEW_BOX_WIDTH = 500
const PREVIEW_BOX_HEIGHT = 350

const hasChinese = computed(() => {
  return /[\u4e00-\u9fa5]/.test(watermarkText.value)
})

const canSubmit = computed(() => {
  if (watermarkType.value === 'image' && !watermarkImage.value) return false
  if (watermarkType.value === 'text' && !watermarkText.value.trim()) return false
  return true
})

const isTiledPosition = computed(() => {
  return position.value === 'tiled' || position.value === 'full-tiled'
})

const getWatermarkBaseStyle = () => {
  const baseFontSize = watermarkType.value === 'text' ? Math.max(fontSize.value / 3, 14) : undefined
  return {
    opacity: opacity.value,
    color: watermarkType.value === 'text' ? fontColor.value : undefined,
    fontSize: baseFontSize ? `${baseFontSize}px` : undefined,
    fontFamily: fontFamily.value,
    fontWeight: fontFamily.value.includes('Bold') ? 'bold' : 'normal',
    whiteSpace: 'nowrap'
  }
}

const previewStyle = computed(() => {
  if (isTiledPosition.value) {
    return {}
  }
  const baseStyle = getWatermarkBaseStyle()
  
  const positions = {
    'top-left': { top: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'top-right': { top: '20px', right: '20px' },
    'center-left': { top: '50%', left: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'center': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation.value}deg)` },
    'center-right': { top: '50%', right: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-center': { bottom: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'bottom-right': { bottom: '20px', right: '20px' }
  }
  
  return { ...baseStyle, ...positions[position.value], position: 'absolute' }
})

const tiledWatermarkList = computed(() => {
  if (!isTiledPosition.value) return []
  
  const result = []
  const baseStyle = getWatermarkBaseStyle()
  const isFullTiled = position.value === 'full-tiled'
  const rotateAngle = isFullTiled ? -45 : -30
  
  const text = watermarkText.value || '水印文字'
  const approxFontSize = watermarkType.value === 'text' ? Math.max(fontSize.value / 3, 14) : 50
  const charWidth = approxFontSize * 0.6
  const approxWidth = watermarkType.value === 'text' 
    ? Math.max(text.length * charWidth, 80)
    : 100 * imageScale.value
  const approxHeight = watermarkType.value === 'text'
    ? approxFontSize * 1.5
    : 60 * imageScale.value
  
  const spacingX = isFullTiled ? approxWidth * 1.2 : approxWidth * 1.6
  const spacingY = isFullTiled ? approxHeight * 2.0 : approxHeight * 2.5
  
  const cols = Math.ceil(PREVIEW_BOX_WIDTH / spacingX) + 4
  const rows = Math.ceil(PREVIEW_BOX_HEIGHT / spacingY) + 4
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 0 ? 0 : spacingX / 2
      result.push({
        style: {
          ...baseStyle,
          position: 'absolute',
          left: `${c * spacingX - approxWidth * (isFullTiled ? 2 : 1.5) + offsetX}px`,
          top: `${r * spacingY - approxHeight * 1.5}px`,
          transform: `rotate(${rotateAngle}deg)`,
          transformOrigin: 'center center'
        }
      })
    }
  }
  
  return result
})

const computeAdaptiveScale = (page, targetMaxWidth = 900, targetMaxHeight = 1200) => {
  const viewport = page.getViewport({ scale: 1 })
  const isLandscape = viewport.width > viewport.height
  
  let maxWidth = targetMaxWidth
  let maxHeight = targetMaxHeight
  
  if (isLandscape) {
    maxWidth = targetMaxHeight
    maxHeight = targetMaxWidth
  }
  
  const scaleX = maxWidth / viewport.width
  const scaleY = maxHeight / viewport.height
  const baseScale = Math.min(scaleX, scaleY)
  
  return Math.max(baseScale, 1.5)
}

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
    comparePage.value = 1
    await nextTick()
    
    let attempts = 0
    while (!beforePreviewCanvas.value && attempts < 10) {
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      attempts++
    }
    
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
    
    let attempts = 0
    while ((!beforeCompareCanvas.value || !afterPreviewCanvas.value) && attempts < 10) {
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      attempts++
    }
    
    await renderComparePages(1)
  } catch (error) {
    console.error('Failed to load processed PDF for preview:', error)
  }
}

const renderPreviewPage = async (type, pageNum) => {
  let canvas = null
  let doc = null
  
  if (type === 'before') {
    canvas = beforePreviewCanvas.value
    doc = pdfDoc.value
  } else if (type === 'before-compare') {
    canvas = beforeCompareCanvas.value
    doc = pdfDoc.value
  }
  
  if (!canvas || !doc) return
  
  try {
    const page = await doc.getPage(pageNum)
    const scale = computeAdaptiveScale(page)
    const viewport = page.getViewport({ scale })
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('Failed to render preview page:', err)
    }
  }
}

const renderComparePages = async (pageNum) => {
  await renderPreviewPage('before-compare', pageNum)
  
  const canvas = afterPreviewCanvas.value
  if (!canvas || !afterPdfDoc.value) return
  
  try {
    const page = await afterPdfDoc.value.getPage(pageNum)
    const scale = computeAdaptiveScale(page)
    const viewport = page.getViewport({ scale })
    const context = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error('Failed to render compare page:', err)
    }
  }
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
.upload-section {
  margin-bottom: 32px;
}

.upload-icon-wrapper {
  width: 96px;
  height: 96px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: #999;
}

.selected-file-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
  border-radius: 12px;
  border: 1px solid #667eea25;
}

.file-info-wrapper {
  display: flex;
  align-items: center;
  gap: 20px;
}

.file-thumbnail {
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #666;
  font-size: 13px;
}

.file-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.file-status {
  display: flex;
  align-items: center;
}

.remove-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  background: #fafbfc;
  border-radius: 12px;
  border: 1px solid #eef0f3;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #eef0f3;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.section-title .el-icon {
  font-size: 18px;
}

.section-hint {
  font-size: 12px;
  color: #999;
}

.section-content {
  padding: 20px;
}

.type-radio-group {
  --el-radio-button-bg-color: white;
}

.setting-control {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 300px;
}

.setting-control-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-select {
  width: 280px;
}

.control-select-sm {
  width: 160px;
}

.control-slider {
  width: 280px;
}

.control-unit {
  color: #666;
  font-size: 14px;
}

.color-value {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 4px 10px;
  border-radius: 4px;
}

.scale-tag {
  min-width: 60px;
  justify-content: center;
}

.chinese-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 6px;
  font-size: 13px;
  color: #e6a23c;
}

.chinese-warning .el-icon {
  flex-shrink: 0;
}

.image-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 12px;
  background: white;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}

.image-preview-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.image-preview-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-size {
  font-size: 12px;
  color: #999;
}

.preview-section-card {
  background: linear-gradient(135deg, #f8f9ff 0%, #fdf8ff 100%);
}

.watermark-preview-wrapper {
  display: flex;
  justify-content: center;
}

.preview-page {
  width: 500px;
  height: 350px;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  position: relative;
  padding: 30px;
  overflow: hidden;
}

.page-lines {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
}

.page-line {
  height: 8px;
  background: linear-gradient(90deg, #eef0f3 0%, #eef0f350 100%);
  border-radius: 4px;
}

.page-line:nth-child(1) { width: 60%; }
.page-line:nth-child(2) { width: 90%; }
.page-line:nth-child(3) { width: 75%; }
.page-line:nth-child(4) { width: 85%; }
.page-line:nth-child(5) { width: 70%; }
.page-line:nth-child(6) { width: 95%; }
.page-line:nth-child(7) { width: 65%; }
.page-line:nth-child(8) { width: 80%; }

.watermark-layer {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.watermark-img {
  max-width: 150px;
  max-height: 100px;
  object-fit: contain;
}

.watermark-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #bbb;
  font-size: 14px;
}

.watermark-placeholder .el-icon {
  font-size: 48px;
}

.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 0;
}

.action-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 10px 20px;
  background: #fdf6ec;
  border-radius: 8px;
  border: 1px solid #faecd8;
  font-size: 14px;
  color: #e6a23c;
}

.primary-large {
  padding: 16px 48px;
  font-size: 16px;
}

.original-preview-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eef0f3;
}

.original-preview-section .section-header {
  padding: 0 0 16px 0;
  background: transparent;
  border-bottom: none;
  margin-bottom: 16px;
}

.pdf-preview-container {
  background: #f5f5f5;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: auto;
  max-height: 500px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
}

.preview-canvas {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  background: white;
  max-width: 100%;
  border-radius: 4px;
}

.page-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  gap: 12px;
}

.result-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eef0f3;
}

.result-success-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f0f9eb 0%, #67c23a10 100%);
  border: 1px solid #67c23a30;
  border-radius: 12px;
  margin-bottom: 24px;
}

.success-icon {
  width: 56px;
  height: 56px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #67c23a;
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.2);
  flex-shrink: 0;
}

.success-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 6px;
}

.success-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #529b2e;
  font-size: 13px;
}

.success-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.preview-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.preview-column {
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px 8px 0 0;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 0;
}

.column-header.before {
  background: #f5f5f5;
  color: #666;
}

.column-header.after {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  color: #667eea;
}

.result-actions {
  text-align: center;
  margin-top: 24px 0 8px;
}

@media (max-width: 900px) {
  .preview-page {
    width: 100%;
    height: 280px;
  }

  .preview-comparison {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .selected-file-card {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .file-info-wrapper {
    flex-direction: column;
    align-items: flex-start;
  }

  .file-name {
    max-width: 100%;
  }

  .section-content {
    padding: 16px;
  }

  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .setting-control,
  .setting-control-inline {
    width: 100%;
  }

  .control-select,
  .control-slider {
    width: 100%;
  }

  .control-select-sm {
    width: 100%;
  }

  .setting-label {
    min-width: auto;
  }

  .preview-page {
    height: 240px;
    padding: 20px;
  }

  .page-lines {
    gap: 14px;
  }

  .primary-large {
    width: 100%;
    padding: 14px 24px;
  }

  .success-banner {
    flex-direction: column;
    text-align: center;
  }
}
</style>
