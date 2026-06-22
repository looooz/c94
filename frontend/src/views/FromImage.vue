<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>图片转PDF</h1>
      <p>将图片转换为PDF，支持合并为单个PDF或批量生成独立PDF</p>
    </div>

    <div class="tool-card">
      <div 
        class="upload-area"
        :class="{ dragover: isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <el-icon :size="48" color="#667eea"><UploadFilled /></el-icon>
        <p style="font-size: 18px; margin-top: 16px; color: #333;">
          拖拽图片文件到此处，或点击选择文件（支持批量）
        </p>
        <p style="font-size: 14px; color: #999; margin-top: 8px;">
          支持JPG、PNG格式，最多50张图片
        </p>
        <input 
          ref="fileInput"
          type="file" 
          multiple 
          accept="image/jpeg,image/png,image/jpg"
          style="display: none;"
          @change="handleFileSelect"
        />
      </div>

      <div v-if="files.length > 0" class="file-list" ref="fileListRef">
        <div class="file-list-header">
          <span style="font-weight: 500; color: #666;">已选择 {{ files.length }} 个图片</span>
          <el-button type="danger" text size="small" @click="clearAllFiles">
            <el-icon><Delete /></el-icon>
            全部清除
          </el-button>
        </div>
        <div 
          v-for="(file, index) in files" 
          :key="index" 
          class="file-item"
          :data-id="index"
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <span v-if="processingMode === 'merge'" class="drag-handle">
              <el-icon><Rank /></el-icon>
            </span>
            <div 
              class="image-preview-thumb"
              @click="openImagePreview(file, file.name)"
            >
              <img 
                :src="getImagePreviewUrl(file)" 
                :alt="file.name"
                class="thumb-image"
              />
            </div>
            <div>
              <span style="font-weight: 500; color: #333;">{{ file.name }}</span>
              <div style="color: #999; font-size: 13px; margin-top: 4px;">
                {{ formatFileSize(file.size) }}
              </div>
            </div>
          </div>
          <el-button type="danger" text @click="removeFile(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="files.length > 0">
        <div class="setting-row">
          <span class="setting-label">处理模式：</span>
          <el-radio-group v-model="processingMode">
            <el-radio-button value="merge">
              <el-icon><Fold /></el-icon>
              合并为一个PDF
            </el-radio-button>
            <el-radio-button value="batch">
              <el-icon><Files /></el-icon>
              批量生成独立PDF
            </el-radio-button>
          </el-radio-group>
        </div>

        <div v-if="processingMode === 'merge'" style="margin-top: 8px; padding: 12px 16px; background: #f0f5ff; border-radius: 8px; border: 1px solid #d6e4ff;">
          <p style="color: #667eea; font-size: 13px; margin: 0;">
            <el-icon style="vertical-align: middle; margin-right: 4px;"><InfoFilled /></el-icon>
            合并模式：所有图片将按顺序合并为一个PDF文件，每张图片占一页
          </p>
        </div>

        <div v-if="processingMode === 'batch'" style="margin-top: 8px; padding: 12px 16px; background: #f0f5ff; border-radius: 8px; border: 1px solid #d6e4ff;">
          <p style="color: #667eea; font-size: 13px; margin: 0;">
            <el-icon style="vertical-align: middle; margin-right: 4px;"><InfoFilled /></el-icon>
            批量模式：每张图片将独立生成一个PDF文件，最终打包为ZIP下载
          </p>
        </div>

        <div class="setting-row" style="margin-top: 16px;">
          <span class="setting-label">页面尺寸：</span>
          <el-select v-model="pageSize" style="width: 150px;">
            <el-option label="A4" value="A4" />
            <el-option label="A3" value="A3" />
            <el-option label="Letter" value="letter" />
            <el-option label="Legal" value="legal" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </div>

        <div v-if="pageSize === 'custom'" class="setting-row">
          <span class="setting-label">自定义尺寸：</span>
          <el-input-number v-model="customWidth" :min="100" :max="2000" />
          <span>×</span>
          <el-input-number v-model="customHeight" :min="100" :max="2000" />
          <span style="color: #999;">像素</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">边距：</span>
          <el-input-number v-model="margin" :min="0" :max="100" />
          <span style="color: #999;">像素</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">适配方式：</span>
          <el-radio-group v-model="fit">
            <el-radio value="contain">包含</el-radio>
            <el-radio value="fill">填充</el-radio>
          </el-radio-group>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="convertToPDF" :disabled="loading">
            <el-icon style="margin-right: 8px;"><Document /></el-icon>
            {{ processingMode === 'merge' ? '合并为PDF' : `批量转换PDF（${files.length}个文件）` }}
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          转换成功！
        </h3>

        <template v-if="!result.isBatch">
          <p style="margin-bottom: 12px;">
            共 <strong>{{ result.pageCount }}</strong> 页
          </p>
          <p style="margin-bottom: 16px;">
            文件大小：{{ formatFileSize(result.fileSize) }}
          </p>

          <div class="result-preview-section">
            <h4 style="margin-bottom: 12px; color: #333;">
              <el-icon style="margin-right: 8px;"><View /></el-icon>
              转换结果预览
            </h4>
            <div class="result-preview-wrapper">
              <PdfPreview 
                :src="result.downloadUrl" 
                width="150px" 
                height="200px" 
                :scale="1.2"
                @click="openPreviewModal(result.downloadUrl, result.fileName)"
              />
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="downloadResult">
              <el-icon style="margin-right: 8px;"><Download /></el-icon>
              下载PDF
            </button>
          </div>
        </template>

        <template v-else>
          <p style="margin-bottom: 16px;">
            共转换 <strong>{{ result.fileCount }}</strong> 个图片为独立PDF
          </p>
          <div style="margin-bottom: 16px;">
            <p style="color: #666; margin-bottom: 8px;">转换结果：</p>
            <div 
              v-for="(r, idx) in result.results" 
              :key="idx"
              style="font-size: 13px; color: #666; padding: 8px 0; border-bottom: 1px solid #f0f0f0;"
            >
              <div style="font-weight: 500; color: #333; margin-bottom: 4px;">
                <el-icon style="color: #67c23a; margin-right: 4px;"><CircleCheckFilled /></el-icon>
                {{ r.originalName }}
              </div>
              <div v-if="r.success" style="padding-left: 20px;">
                {{ formatFileSize(r.fileSize) }}
              </div>
              <div v-else style="padding-left: 20px; color: #f56c6c;">
                转换失败：{{ r.error }}
              </div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="downloadResult">
              <el-icon style="margin-right: 8px;"><Download /></el-icon>
              下载ZIP压缩包
            </button>
          </div>
        </template>
      </div>
    </div>

    <LoadingOverlay :visible="loading" :text="loadingText" />
    
    <PdfPreviewModal 
      v-model="previewModalVisible" 
      :src="previewModalSrc" 
      :title="previewModalTitle"
    />

    <el-dialog
      v-model="imagePreviewVisible"
      :title="imagePreviewTitle"
      width="800px"
      class="image-preview-modal"
    >
      <div class="image-preview-container">
        <img 
          :src="imagePreviewSrc" 
          :alt="imagePreviewTitle"
          class="preview-image"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import { 
  imageToPDF as imageToPDFApi, 
  imageToPDFBatch,
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'

const fileInput = ref(null)
const fileListRef = ref(null)
const files = ref([])
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)

const processingMode = ref('merge')
const pageSize = ref('A4')
const customWidth = ref(800)
const customHeight = ref(600)
const margin = ref(20)
const fit = ref('contain')

const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const imagePreviewVisible = ref(false)
const imagePreviewSrc = ref(null)
const imagePreviewTitle = ref('图片预览')

const imagePreviewUrls = ref({})

let sortableInstance = null

const loadingText = computed(() => {
  return processingMode.value === 'merge' ? '正在合并为PDF...' : '正在批量转换PDF...'
})

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = (e) => {
  const selectedFiles = Array.from(e.target.files).filter(f => 
    f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/jpg'
  )
  addFiles(selectedFiles)
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragging.value = false
  const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
    f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/jpg'
  )
  if (droppedFiles.length === 0) {
    ElMessage.warning('请拖入JPG或PNG图片文件')
    return
  }
  addFiles(droppedFiles)
}

const getImagePreviewUrl = (file) => {
  const key = file.name + '_' + file.size
  if (!imagePreviewUrls.value[key]) {
    imagePreviewUrls.value[key] = URL.createObjectURL(file)
  }
  return imagePreviewUrls.value[key]
}

const addFiles = (newFiles) => {
  if (files.value.length + newFiles.length > 50) {
    ElMessage.warning('最多只能上传50个文件')
    return
  }
  files.value = [...files.value, ...newFiles]
  result.value = null
  nextTick(() => {
    initSortable()
  })
}

const removeFile = (index) => {
  files.value.splice(index, 1)
  result.value = null
  nextTick(() => {
    initSortable()
  })
}

const clearAllFiles = () => {
  files.value = []
  result.value = null
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

const initSortable = () => {
  if (processingMode.value !== 'merge') return
  if (sortableInstance) {
    sortableInstance.destroy()
  }
  if (fileListRef.value) {
    sortableInstance = Sortable.create(fileListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'dragging',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex !== newIndex) {
          const movedItem = files.value.splice(oldIndex, 1)[0]
          files.value.splice(newIndex, 0, movedItem)
        }
      }
    })
  }
}

const convertToPDF = async () => {
  if (files.value.length < 1) {
    ElMessage.warning('请至少上传1张图片')
    return
  }

  const options = {
    pageSize: pageSize.value,
    margin: margin.value,
    fit: fit.value
  }

  if (processingMode.value === 'merge') {
    options.order = files.value.map((_, idx) => idx)
  }

  if (pageSize.value === 'custom') {
    options.customWidth = customWidth.value
    options.customHeight = customHeight.value
  }

  loading.value = true
  result.value = null

  try {
    let response
    if (processingMode.value === 'batch') {
      response = await imageToPDFBatch(files.value, options)
    } else {
      response = await imageToPDFApi(files.value, options)
    }
    result.value = response.data
    ElMessage.success(processingMode.value === 'merge' ? '图片转PDF成功！' : '批量转换PDF成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '转换失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    if (result.value.isBatch) {
      downloadFile(result.value.downloadUrl, `images_to_pdf_batch_${Date.now()}.zip`)
    } else {
      downloadFile(result.value.downloadUrl, `images_to_pdf_${Date.now()}.pdf`)
    }
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}

const openImagePreview = (file, title) => {
  imagePreviewSrc.value = getImagePreviewUrl(file)
  imagePreviewTitle.value = title || '图片预览'
  imagePreviewVisible.value = true
}

onMounted(() => {
  initSortable()
})
</script>

<style scoped>
.image-preview-thumb {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ddd;
  cursor: pointer;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.image-preview-thumb:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.thumb-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.result-preview-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.result-preview-wrapper {
  display: flex;
  justify-content: center;
}

.image-preview-modal :deep(.el-dialog__body) {
  padding: 20px;
}

.image-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 70vh;
  overflow: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}
</style>
