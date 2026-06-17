<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF转图片</h1>
      <p>将PDF页面转换为PNG或JPG图片</p>
    </div>

    <div class="tool-card">
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
        <div class="setting-row">
          <span class="setting-label">输出格式：</span>
          <el-radio-group v-model="outputFormat">
            <el-radio value="png">PNG</el-radio>
            <el-radio value="jpg">JPG</el-radio>
          </el-radio-group>
        </div>

        <div class="setting-row">
          <span class="setting-label">页面范围：</span>
          <el-radio-group v-model="pageMode">
            <el-radio value="all">全部页面</el-radio>
            <el-radio value="specific">指定页面</el-radio>
          </el-radio-group>
        </div>

        <div v-if="pageMode === 'specific'" class="setting-row">
          <span class="setting-label">指定页码：</span>
          <el-input 
            v-model="specificPages" 
            placeholder="如: 1, 3, 5-7" 
            class="page-range-input"
          />
          <span style="color: #999; font-size: 13px;">用逗号分隔</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">DPI：</span>
          <el-select v-model="dpi" style="width: 150px;">
            <el-option label="72 DPI" :value="72" />
            <el-option label="150 DPI" :value="150" />
            <el-option label="300 DPI" :value="300" />
            <el-option label="600 DPI" :value="600" />
          </el-select>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="convertToImage" :disabled="loading">
            <el-icon style="margin-right: 8px;"><PictureFilled /></el-icon>
            开始转换
          </button>
        </div>
      </div>

      <div v-if="convertedImages.length > 0" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          转换成功！
        </h3>
        <p style="margin-bottom: 12px;">
          共转换 <strong>{{ convertedImages.length }}</strong> 张图片
        </p>
        <p style="margin-bottom: 16px;">
          格式：{{ outputFormat.toUpperCase() }}
        </p>
        
        <div class="preview-grid">
          <div 
            v-for="(img, index) in convertedImages" 
            :key="index"
            class="preview-item"
          >
            <div class="preview-label">第 {{ img.pageNum }} 页</div>
            <img :src="img.dataUrl" :alt="'Page ' + img.pageNum" class="preview-image" />
            <button 
              class="download-single-btn"
              @click="downloadSingleImage(img)"
            >
              <el-icon><Download /></el-icon>
              下载
            </button>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button class="action-button" @click="downloadAllImages">
            <el-icon style="margin-right: 8px;"><Download /></el-icon>
            下载全部 (ZIP)
          </button>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" :text="loadingText" />
    
    <PdfPreviewModal 
      v-model="previewModalVisible" 
      :src="previewModalSrc" 
      :title="previewModalTitle"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'
import JSZip from 'jszip'
import { formatFileSize, downloadFile } from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const loadingText = ref('正在转换PDF...')
const convertedImages = ref([])
const pdfDoc = ref(null)
const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const outputFormat = ref('png')
const pageMode = ref('all')
const specificPages = ref('')
const dpi = ref(150)

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = async (e) => {
  const selectedFile = e.target.files[0]
  if (selectedFile && selectedFile.type === 'application/pdf') {
    file.value = selectedFile
    convertedImages.value = []
    await loadPdf(selectedFile)
  }
  e.target.value = ''
}

const handleDrop = async (e) => {
  isDragging.value = false
  const droppedFile = e.dataTransfer.files[0]
  if (droppedFile && droppedFile.type === 'application/pdf') {
    file.value = droppedFile
    convertedImages.value = []
    await loadPdf(droppedFile)
  } else {
    ElMessage.warning('请拖入PDF文件')
  }
}

const loadPdf = async (pdfFile) => {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    pdfDoc.value = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: cMapBaseUrl,
      cMapPacked: true
    }).promise
  } catch (error) {
    ElMessage.error('无法加载PDF文件')
    console.error('PDF load error:', error)
  }
}

const parsePageRange = (rangeStr, totalPages) => {
  const pages = []
  const parts = rangeStr.split(',').map(p => p.trim())
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(p => parseInt(p.trim()))
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= totalPages) {
        for (let i = start; i <= end; i++) {
          pages.push(i)
        }
      }
    } else {
      const pageNum = parseInt(part)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.push(pageNum)
      }
    }
  }
  
  return [...new Set(pages)].sort((a, b) => a - b)
}

const renderPageToImage = async (pageNum) => {
  if (!pdfDoc.value) return null
  
  const page = await pdfDoc.value.getPage(pageNum)
  const viewport = page.getViewport({ scale: dpi.value / 72 })
  
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise
  
  const mimeType = outputFormat.value === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = outputFormat.value === 'jpg' ? 0.92 : undefined
  const dataUrl = canvas.toDataURL(mimeType, quality)
  
  const base64Data = dataUrl.split(',')[1]
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  
  return {
    pageNum,
    dataUrl,
    byteArray,
    fileName: `page_${pageNum}.${outputFormat.value}`
  }
}

const convertToImage = async () => {
  if (!file.value || !pdfDoc.value) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  const totalPages = pdfDoc.value.numPages
  let pagesToConvert = []
  
  if (pageMode.value === 'all') {
    pagesToConvert = Array.from({ length: totalPages }, (_, i) => i + 1)
  } else if (pageMode.value === 'specific') {
    if (!specificPages.value.trim()) {
      ElMessage.warning('请输入指定页码')
      return
    }
    pagesToConvert = parsePageRange(specificPages.value, totalPages)
    if (pagesToConvert.length === 0) {
      ElMessage.warning('没有有效的页码')
      return
    }
  }

  loading.value = true
  convertedImages.value = []

  try {
    for (let i = 0; i < pagesToConvert.length; i++) {
      const pageNum = pagesToConvert[i]
      loadingText.value = `正在转换第 ${pageNum} 页 (${i + 1}/${pagesToConvert.length})...`
      
      const imageData = await renderPageToImage(pageNum)
      if (imageData) {
        convertedImages.value.push(imageData)
      }
    }
    
    ElMessage.success('PDF转图片成功！')
  } catch (error) {
    ElMessage.error('转换失败，请重试')
    console.error('Convert error:', error)
  } finally {
    loading.value = false
    loadingText.value = '正在转换PDF...'
  }
}

const downloadSingleImage = (imageData) => {
  const link = document.createElement('a')
  link.href = imageData.dataUrl
  link.download = imageData.fileName
  link.click()
}

const downloadAllImages = async () => {
  if (convertedImages.value.length === 0) return
  
  loading.value = true
  loadingText.value = '正在打包ZIP...'
  
  try {
    const zip = new JSZip()
    
    for (const img of convertedImages.value) {
      zip.file(img.fileName, img.byteArray)
    }
    
    const zipContent = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipContent)
    downloadFile(url, `pdf_to_images_${Date.now()}.zip`)
    URL.revokeObjectURL(url)
    
    ElMessage.success('下载成功！')
  } catch (error) {
    ElMessage.error('打包失败，请重试')
    console.error('Zip error:', error)
  } finally {
    loading.value = false
    loadingText.value = '正在转换PDF...'
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}

const removeFile = () => {
  file.value = null
  pdfDoc.value = null
  convertedImages.value = []
}
</script>

<style scoped>
.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.preview-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #f9fafb;
  text-align: center;
}

.preview-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.download-single-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.download-single-btn:hover {
  background: #5a6fd6;
}

.page-range-input {
  width: 300px;
  margin-right: 12px;
}
</style>
