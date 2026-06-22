<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF加水印</h1>
      <p>添加文字或图片水印，支持批量处理、自定义位置和透明度</p>
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
        >
          <div class="upload-icon-wrapper">
            <el-icon :size="56" color="#667eea"><UploadFilled /></el-icon>
          </div>
          <p class="upload-title">拖拽PDF文件到此处，或点击选择文件</p>
          <p class="upload-hint">支持 PDF 格式文件，可批量选择多个文件</p>
          <input 
            ref="fileInput"
            type="file" 
            accept=".pdf"
            multiple
            style="display: none;"
            @change="handleFileSelect"
          />
        </div>

        <div v-if="files.length > 0" class="file-list">
          <div 
            v-for="(fileItem, index) in files" 
            :key="getFileKey(fileItem)"
            class="selected-file-card"
          >
            <div class="file-info-wrapper">
              <PdfPreview 
                :src="fileItem" 
                width="100px" 
                height="130px" 
                :scale="1"
                class="file-thumbnail"
                @click="openPreviewModal(fileItem, fileItem.name)"
              />
              <div class="file-details">
                <div class="file-name">{{ fileItem.name }}</div>
                <div class="file-meta">
                  <span class="file-size">
                    <el-icon><Document /></el-icon>
                    {{ formatFileSize(fileItem.size) }}
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
            <el-button type="danger" @click="removeFile(index)" class="remove-btn">
              <el-icon><Delete /></el-icon>
              移除
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="files.length > 0" class="settings-container">
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

            <div class="setting-row" v-if="isTiledPosition">
              <span class="setting-label">水平间距</span>
              <div class="setting-control-inline">
                <el-slider v-model="watermarkSpacingX" :min="0.5" :max="3.0" :step="0.1" class="control-slider" />
                <el-tag type="info" effect="plain" class="scale-tag">{{ watermarkSpacingX.toFixed(1) }}x</el-tag>
              </div>
            </div>

            <div class="setting-row" v-if="isTiledPosition">
              <span class="setting-label">垂直间距</span>
              <div class="setting-control-inline">
                <el-slider v-model="watermarkSpacingY" :min="0.5" :max="3.0" :step="0.1" class="control-slider" />
                <el-tag type="info" effect="plain" class="scale-tag">{{ watermarkSpacingY.toFixed(1) }}x</el-tag>
              </div>
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
              <div class="preview-page" ref="previewPageRef" :style="previewPageStyle">
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
            {{ loading ? '正在添加水印...' : `添加水印（${files.length}个文件）` }}
          </button>
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
              <template v-if="isBatch">
                <span><el-icon><Files /></el-icon> 共处理 {{ result.fileCount }} 个文件，打包为ZIP下载</span>
              </template>
              <template v-else>
                <span><el-icon><Document /></el-icon> {{ result.fileName }}</span>
                <span><el-icon><FolderOpened /></el-icon> {{ formatFileSize(result.fileSize) }}</span>
              </template>
            </div>
          </div>
        </div>

        <template v-if="isBatch && result.results">
          <div class="batch-result-list">
            <div 
              v-for="(item, index) in result.results" 
              :key="index"
              class="batch-result-item"
            >
              <div class="batch-item-icon">
                <el-icon :color="item.success ? '#67c23a' : '#f56c6c'">
                  <CircleCheckFilled v-if="item.success" />
                  <CircleCloseFilled v-else />
                </el-icon>
              </div>
              <div class="batch-item-info">
                <div class="batch-item-name">{{ item.originalName }}</div>
                <div v-if="item.success" class="batch-item-size">
                  <el-icon><FolderOpened /></el-icon>
                  {{ formatFileSize(item.fileSize) }}
                </div>
                <div v-else class="batch-item-error">
                  处理失败：{{ item.error }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-if="!isBatch">
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

          <div v-if="compareTotalPages > 1" class="page-navigation">
            <el-button 
              :disabled="comparePage === 1" 
              @click="comparePage--; renderComparePages(comparePage)"
              size="small"
            >
              <el-icon><ArrowLeft /></el-icon> 上一页
            </el-button>
            <el-pagination
              v-model:current-page="comparePage"
              :page-count="compareTotalPages"
              :page-size="1"
              layout="prev, pager, next"
              size="small"
              @current-change="(p) => renderComparePages(p)"
            />
            <el-button 
              :disabled="comparePage === compareTotalPages" 
              @click="comparePage++; renderComparePages(comparePage)"
              size="small"
            >
              下一页 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </template>

        <div class="result-actions">
          <button class="action-button primary-large" @click="downloadResult">
            <el-icon style="margin-right: 10px;"><Download /></el-icon>
            {{ isBatch ? '下载 ZIP 压缩包' : '下载带水印的PDF' }}
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
import { CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

const fileInput = ref(null)
const files = ref([])
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)
const isBatch = computed(() => result.value?.isBatch || false)

const watermarkType = ref('text')
const watermarkText = ref('CONFIDENTIAL')
const fontFamily = ref('Helvetica')
const fontSize = ref(48)
const fontColor = ref('#ff0000')
const watermarkImage = ref(null)
const watermarkImagePreview = ref(null)
const generatedWatermarkImage = ref(null)
const imageScale = ref(0.5)
const watermarkImageWidth = ref(100)
const watermarkImageHeight = ref(60)
const position = ref('center')
const opacity = ref(0.3)
const rotation = ref(0)
const watermarkSpacingX = ref(1.0)
const watermarkSpacingY = ref(1.0)

const beforeCompareCanvas = ref(null)
const afterPreviewCanvas = ref(null)
const previewPageRef = ref(null)
const pdfDocs = ref({})
const totalPagesMap = ref({})
const afterPdfDoc = ref(null)
const compareTotalPages = ref(0)
const comparePage = ref(1)

const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const pdfPageWidth = ref(595)
const pdfPageHeight = ref(842)

const PREVIEW_BOX_WIDTH = 500
const PREVIEW_BOX_HEIGHT = 350

const hasChinese = computed(() => {
  return /[\u4e00-\u9fa5]/.test(watermarkText.value)
})

const canSubmit = computed(() => {
  if (files.value.length === 0) return false
  if (watermarkType.value === 'image' && !watermarkImage.value) return false
  if (watermarkType.value === 'text' && !watermarkText.value.trim()) return false
  return true
})

const isTiledPosition = computed(() => {
  return position.value === 'tiled' || position.value === 'full-tiled'
})

const previewPageStyle = computed(() => {
  const pageW = pdfPageWidth.value
  const pageH = pdfPageHeight.value
  const maxWidth = PREVIEW_BOX_WIDTH
  const maxHeight = PREVIEW_BOX_HEIGHT
  
  const scaleW = maxWidth / pageW
  const scaleH = maxHeight / pageH
  const fitScale = Math.min(scaleW, scaleH)
  
  return {
    width: `${Math.floor(pageW * fitScale)}px`,
    height: `${Math.floor(pageH * fitScale)}px`
  }
})

const previewScale = computed(() => {
  const pageW = pdfPageWidth.value
  const pageH = pdfPageHeight.value
  const maxWidth = PREVIEW_BOX_WIDTH
  const maxHeight = PREVIEW_BOX_HEIGHT
  
  const scaleW = maxWidth / pageW
  const scaleH = maxHeight / pageH
  return Math.min(scaleW, scaleH)
})

const getWatermarkActualSize = () => {
  const text = watermarkText.value || '水印文字'
  
  if (watermarkType.value === 'text' && !hasChinese.value) {
    const fontSizeNum = fontSize.value
    const avgCharWidth = fontSizeNum * 0.55
    const width = Math.max(text.length * avgCharWidth, 40)
    const height = fontSizeNum
    return { width, height, fontSize: fontSizeNum }
  } else {
    const scale = imageScale.value
    const width = watermarkImageWidth.value * scale
    const height = watermarkImageHeight.value * scale
    return { width, height, fontSize: 0 }
  }
}

const getWatermarkBaseStyle = () => {
  const scale = previewScale.value
  const actualSize = getWatermarkActualSize()
  
  if (watermarkType.value === 'text') {
    const previewFontSize = Math.max(actualSize.fontSize * scale, 10)
    return {
      opacity: opacity.value,
      color: fontColor.value,
      fontSize: `${previewFontSize}px`,
      fontFamily: fontFamily.value,
      fontWeight: fontFamily.value.includes('Bold') ? 'bold' : 'normal',
      whiteSpace: 'nowrap',
      lineHeight: 1.2
    }
  } else {
    return {
      opacity: opacity.value
    }
  }
}

const getWatermarkPreviewSize = () => {
  const scale = previewScale.value
  const actualSize = getWatermarkActualSize()
  return {
    width: actualSize.width * scale,
    height: actualSize.height * scale
  }
}

const previewStyle = computed(() => {
  if (isTiledPosition.value) {
    return {}
  }
  const baseStyle = getWatermarkBaseStyle()
  const scale = previewScale.value
  const wmSize = getWatermarkPreviewSize()
  const margin = 30 * scale
  
  const positions = {
    'top-left': { top: `${margin}px`, left: `${margin}px` },
    'top-center': { top: `${margin}px`, left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'top-right': { top: `${margin}px`, right: `${margin}px` },
    'center-left': { top: '50%', left: `${margin}px`, transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'center': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation.value}deg)` },
    'center-right': { top: '50%', right: `${margin}px`, transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'bottom-left': { bottom: `${margin}px`, left: `${margin}px` },
    'bottom-center': { bottom: `${margin}px`, left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'bottom-right': { bottom: `${margin}px`, right: `${margin}px` }
  }
  
  return { ...baseStyle, ...positions[position.value], position: 'absolute' }
})

const tiledWatermarkList = computed(() => {
  if (!isTiledPosition.value) return []
  
  const scale = previewScale.value
  const baseStyle = getWatermarkBaseStyle()
  const wmSize = getWatermarkPreviewSize()
  const pageStyle = previewPageStyle.value
  const pageW = parseInt(pageStyle.width)
  const pageH = parseInt(pageStyle.height)
  
  const isFullTiled = position.value === 'full-tiled'
  const spacingXMultiplier = isFullTiled ? 1.2 : 1.6
  const spacingYMultiplier = isFullTiled ? 2.0 : 2.5
  const baseSpacingX = Math.max(wmSize.width * spacingXMultiplier * watermarkSpacingX.value, 80)
  const baseSpacingY = Math.max(wmSize.height * spacingYMultiplier * watermarkSpacingY.value, 80)
  
  const rotateAngle = isFullTiled ? -45 : -30
  const cols = Math.ceil(pageW / baseSpacingX) + 4
  const rows = Math.ceil(pageH / baseSpacingY) + 4
  
  const list = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 0 ? 0 : baseSpacingX / 2
      const x = c * baseSpacingX - wmSize.width * 1.5 + offsetX
      const y = r * baseSpacingY - wmSize.height * 1.5
      list.push({
        style: {
          ...baseStyle,
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          transform: `rotate(${rotateAngle}deg)`,
          width: wmSize.width ? `${wmSize.width}px` : undefined,
          height: wmSize.height ? `${wmSize.height}px` : undefined
        }
      })
    }
  }
  return list
})

const getFileKey = (file) => {
  return `${file.name}_${file.size}_${file.lastModified}`
}

const triggerFileInput = () => {
  fileInput.value.click()
}

const isFileDuplicate = (newFile) => {
  return files.value.some(
    f => f.name === newFile.name && f.size === newFile.size && f.lastModified === newFile.lastModified
  )
}

const addFiles = (fileList) => {
  let addedCount = 0
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i]
    if (f && f.type === 'application/pdf') {
      if (!isFileDuplicate(f)) {
        files.value.push(f)
        loadPdfInfo(f)
        addedCount++
      }
    } else if (f) {
      ElMessage.warning(`文件 "${f.name}" 不是PDF格式，已跳过`)
    }
  }
  if (addedCount > 0) {
    result.value = null
  }
  return addedCount
}

const loadPdfInfo = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: cMapBaseUrl,
      cMapPacked: true
    }).promise
    pdfDocs.value[file.name] = pdfDoc
    totalPagesMap.value[file.name] = pdfDoc.numPages
    if (pdfDoc.numPages > 0) {
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      pdfPageWidth.value = viewport.width
      pdfPageHeight.value = viewport.height
    }
  } catch (e) {
    console.error('Failed to load PDF info:', e)
  }
}

const handleFileSelect = (e) => {
  const selectedFiles = e.target.files
  if (selectedFiles && selectedFiles.length > 0) {
    addFiles(selectedFiles)
  }
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragging.value = false
  const droppedFiles = e.dataTransfer.files
  if (droppedFiles && droppedFiles.length > 0) {
    const addedCount = addFiles(droppedFiles)
    if (addedCount === 0) {
      ElMessage.warning('请拖入PDF文件')
    }
  } else {
    ElMessage.warning('请拖入PDF文件')
  }
}

const removeFile = (index) => {
  const file = files.value[index]
  delete pdfDocs.value[file.name]
  delete totalPagesMap.value[file.name]
  files.value.splice(index, 1)
  result.value = null
}

const handleWatermarkImageSelect = (uploadFile) => {
  const file = uploadFile.raw || uploadFile
  if (!file) return
  
  if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
    ElMessage.warning('仅支持 JPG 和 PNG 格式图片')
    return
  }
  
  watermarkImage.value = file
  watermarkImagePreview.value = URL.createObjectURL(file)
  
  const img = new Image()
  img.onload = () => {
    watermarkImageWidth.value = img.width
    watermarkImageHeight.value = img.height
  }
  img.src = watermarkImagePreview.value
}

const generateChineseWatermarkImage = async () => {
  const canvas = document.createElement('canvas')
  const fontSizeNum = fontSize.value
  const text = watermarkText.value
  
  canvas.width = Math.max(text.length * fontSizeNum * 1.2, 100)
  canvas.height = fontSizeNum * 1.5
  
  const ctx = canvas.getContext('2d')
  ctx.font = `${fontSizeNum}px sans-serif`
  ctx.fillStyle = fontColor.value
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 10, canvas.height / 2)
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'chinese_watermark.png', { type: 'image/png' })
        resolve(file)
      } else {
        resolve(null)
      }
    }, 'image/png')
  })
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
    compareTotalPages.value = afterPdfDoc.value.numPages
    comparePage.value = 1
    await nextTick()
    await renderComparePages(1)
  } catch (error) {
    console.error('Failed to load processed PDF for preview:', error)
  }
}

const computeFitScale = (page, containerWidth, containerHeight) => {
  const viewport = page.getViewport({ scale: 1 })
  const padding = 40
  const availW = Math.max(containerWidth - padding, 50)
  const availH = Math.max((containerHeight || 500) - padding, 50)
  const scaleW = availW / viewport.width
  const scaleH = availH / viewport.height
  return Math.min(scaleW, scaleH)
}

const renderPreviewPage = async (type, pageNum) => {
  let canvas = null
  let doc = null

  if (type === 'before-compare') {
    canvas = beforeCompareCanvas.value
    doc = files.value.length > 0 ? pdfDocs.value[files.value[0].name] : null
  } else if (type === 'after') {
    canvas = afterPreviewCanvas.value
    doc = afterPdfDoc.value
  }

  if (!canvas || !doc) return
  if (pageNum < 1 || pageNum > doc.numPages) return

  try {
    const page = await doc.getPage(pageNum)
    const container = canvas.parentElement
    const containerWidth = container?.clientWidth || 400
    const containerHeight = container?.clientHeight || 500

    const rawViewport = page.getViewport({ scale: 1 })
    const fitScale = computeFitScale(page, containerWidth, containerHeight)
    const dpr = window.devicePixelRatio || 1
    const renderScale = fitScale * dpr
    const viewport = page.getViewport({ scale: renderScale })
    const context = canvas.getContext('2d')

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    const cssWidth = Math.floor(rawViewport.width * fitScale)
    const cssHeight = Math.floor(rawViewport.height * fitScale)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    canvas.style.display = 'block'

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.error(`[renderPreviewPage] Failed type=${type} page=${pageNum}:`, err)
    }
  }
}

const renderComparePages = async (pageNum) => {
  await renderPreviewPage('before-compare', pageNum)
  await renderPreviewPage('after', pageNum)
}

const addWatermark = async () => {
  if (!files.value || files.value.length === 0) {
    ElMessage.warning('请上传PDF文件')
    return
  }
  if (!canSubmit.value) {
    ElMessage.warning(watermarkType.value === 'image' ? '请选择水印图片' : '请输入水印文字')
    return
  }

  loading.value = true
  result.value = null

  try {
    let watermarkImgToSend = watermarkImage.value
    
    if (watermarkType.value === 'text' && hasChinese.value) {
      watermarkImgToSend = await generateChineseWatermarkImage()
      if (!watermarkImgToSend) {
        throw new Error('生成中文水印图片失败')
      }
    }

    const options = {
      type: watermarkType.value,
      text: watermarkText.value,
      fontSize: fontSize.value,
      color: fontColor.value,
      opacity: opacity.value,
      position: position.value,
      rotation: rotation.value,
      fontFamily: fontFamily.value,
      imageScale: imageScale.value,
      watermarkSpacingX: watermarkSpacingX.value,
      watermarkSpacingY: watermarkSpacingY.value
    }

    const response = await addWatermarkApi(files.value, watermarkImgToSend, options)
    result.value = response.data
    ElMessage.success('水印添加成功！')
    
    if (!result.value.isBatch) {
      await loadAfterPdfForPreview(response.data.downloadUrl)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '添加水印失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    if (result.value.isBatch) {
      downloadFile(result.value.downloadUrl, `watermarked_batch_${Date.now()}.zip`)
    } else {
      downloadFile(result.value.downloadUrl, `watermarked_${Date.now()}.pdf`)
    }
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}

watch(watermarkType, () => {
  result.value = null
})
</script>

<style scoped>
.upload-section {
  margin-bottom: 24px;
}

.upload-icon-wrapper {
  margin-bottom: 12px;
}

.upload-title {
  font-size: 18px;
  color: #333;
  margin: 0 0 4px 0;
}

.upload-hint {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.file-list {
  margin-top: 20px;
}

.selected-file-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 12px;
  border: 1px solid #e9ecef;
  transition: all 0.2s;
}

.selected-file-card:hover {
  background: #f0f5ff;
  border-color: #d6e4ff;
}

.file-info-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.file-thumbnail {
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: white;
  cursor: pointer;
}

.file-details {
  flex: 1;
}

.file-name {
  font-weight: 600;
  color: #333;
  font-size: 15px;
  margin-bottom: 6px;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.file-size, .file-pages {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 13px;
}

.file-status {
  display: flex;
}

.remove-btn {
  margin-left: 12px;
}

.settings-container {
  border-top: 1px solid #eee;
  padding-top: 24px;
}

.settings-section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-hint {
  font-size: 12px;
  color: #999;
}

.section-content {
  padding: 0 8px;
}

.type-radio-group {
  display: flex;
}

.setting-control {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-control-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-unit {
  color: #666;
  font-size: 14px;
}

.control-select {
  width: 200px;
}

.control-select-sm {
  width: 140px;
}

.control-slider {
  width: 240px;
}

.scale-tag {
  min-width: 60px;
  text-align: center;
}

.color-value {
  color: #666;
  font-size: 14px;
  font-family: monospace;
}

.chinese-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #e6a23c;
  padding: 8px 12px;
  background: #fdf6ec;
  border-radius: 6px;
}

.image-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.image-preview-thumb {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  background: white;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.image-name {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.image-size {
  color: #999;
  font-size: 12px;
}

.preview-section-card {
  background: #fafbfc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #eef0f2;
}

.watermark-preview-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.preview-page {
  position: relative;
  background: white;
  border: 1px solid #d9d9d9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.page-lines {
  position: absolute;
  top: 40px;
  left: 40px;
  right: 40px;
  bottom: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.page-line {
  height: 1px;
  background: #e8e8e8;
}

.watermark-layer {
  z-index: 10;
  user-select: none;
  pointer-events: none;
}

.tiled-watermark {
  white-space: nowrap;
}

.watermark-img {
  max-width: 100%;
  max-height: 100%;
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
  gap: 8px;
  color: #ccc;
}

.action-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.action-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.primary-large {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  display: block;
}

.result-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.result-success-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
  border-radius: 12px;
  border: 1px solid #e1f3d8;
  margin-bottom: 24px;
}

.success-icon {
  color: #67c23a;
  flex-shrink: 0;
}

.success-info h3 {
  margin: 0 0 8px 0;
  color: #67c23a;
  font-size: 20px;
}

.success-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  color: #666;
  font-size: 14px;
}

.success-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.batch-result-list {
  margin-bottom: 24px;
  max-height: 400px;
  overflow-y: auto;
}

.batch-result-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s;
}

.batch-result-item:hover {
  background: #f0f5ff;
  border-color: #d6e4ff;
}

.batch-item-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.batch-item-info {
  flex: 1;
}

.batch-item-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.batch-item-size {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 13px;
}

.batch-item-error {
  color: #f56c6c;
  font-size: 13px;
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

.column-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.column-header.before {
  color: #999;
}

.column-header.after {
  color: #67c23a;
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
  gap: 12px;
}

.result-actions {
  text-align: center;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .preview-comparison {
    grid-template-columns: 1fr;
  }
  
  .selected-file-card {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
