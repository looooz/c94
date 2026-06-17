<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF压缩</h1>
      <p>压缩PDF文件大小，支持多等级压缩</p>
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
          <span class="setting-label">压缩等级：</span>
          <el-radio-group v-model="compressLevel">
            <el-radio value="low">低（推荐）</el-radio>
            <el-radio value="medium">中</el-radio>
            <el-radio value="high">高</el-radio>
          </el-radio-group>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="compressPDF" :disabled="loading">
            <el-icon style="margin-right: 8px;"><ZoomOut /></el-icon>
            开始压缩
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          压缩成功！
        </h3>
        
        <div class="size-comparison">
          <div class="size-item">
            <div class="size-value">{{ formatFileSize(result.originalSize) }}</div>
            <div class="size-label">原始大小</div>
          </div>
          <div class="size-arrow">→</div>
          <div class="size-item">
            <div class="size-value" style="color: #67c23a;">{{ formatFileSize(result.compressedSize) }}</div>
            <div class="size-label">压缩后</div>
          </div>
        </div>

        <div class="compression-ratio">
          <div>压缩率</div>
          <div class="ratio-value">{{ result.compressionRatio }}%</div>
        </div>

        <div class="preview-comparison">
          <div class="preview-column">
            <h4 style="margin-bottom: 12px; color: #999;">压缩前</h4>
            <PdfPreview 
              :src="file" 
              width="120px" 
              height="160px" 
              :scale="1"
              @click="openPreviewModal(file, '原始PDF')"
            />
          </div>
          <div class="preview-column">
            <h4 style="margin-bottom: 12px; color: #667eea;">压缩后</h4>
            <PdfPreview 
              :src="result.downloadUrl" 
              width="120px" 
              height="160px" 
              :scale="1"
              @click="openPreviewModal(result.downloadUrl, '压缩后PDF')"
            />
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="downloadResult">
            <el-icon style="margin-right: 8px;"><Download /></el-icon>
            下载压缩后的PDF
          </button>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在压缩PDF..." />
    
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
import { 
  compressPDF as compressPDFApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)
const compressLevel = ref('medium')
const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = (e) => {
  const selectedFile = e.target.files[0]
  if (selectedFile && selectedFile.type === 'application/pdf') {
    file.value = selectedFile
    result.value = null
  }
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragging.value = false
  const droppedFile = e.dataTransfer.files[0]
  if (droppedFile && droppedFile.type === 'application/pdf') {
    file.value = droppedFile
    result.value = null
  } else {
    ElMessage.warning('请拖入PDF文件')
  }
}

const removeFile = () => {
  file.value = null
  result.value = null
}

const compressPDF = async () => {
  if (!file.value) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  loading.value = true
  result.value = null

  try {
    const response = await compressPDFApi(file.value, compressLevel.value)
    result.value = response.data
    ElMessage.success('PDF压缩成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '压缩失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `compressed_${Date.now()}.pdf`)
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}
</script>

<style scoped>
.preview-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
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
