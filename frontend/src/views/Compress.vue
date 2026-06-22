<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF压缩</h1>
      <p>压缩PDF文件大小，支持多等级压缩（支持批量）</p>
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
          拖拽PDF文件到此处，或点击选择文件（支持批量）
        </p>
        <input 
          ref="fileInput"
          type="file" 
          accept=".pdf"
          multiple
          style="display: none;"
          @change="handleFileSelect"
        />
      </div>

      <div v-if="files.length > 0" style="margin-bottom: 24px;">
        <div v-for="(f, index) in files" :key="index" class="file-item" style="margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <PdfPreview 
              :src="f" 
              width="80px" 
              height="100px" 
              :scale="1"
              @click="openPreviewModal(f, f.name)"
            />
            <div>
              <span style="font-weight: 500; color: #333;">{{ f.name }}</span>
              <div style="color: #999; font-size: 13px; margin-top: 4px;">
                {{ formatFileSize(f.size) }}
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
            开始压缩（{{ files.length }}个文件）
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          压缩成功！
        </h3>

        <template v-if="!result.isBatch">
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
                :src="files[0]" 
                width="120px" 
                height="160px" 
                :scale="1"
                @click="openPreviewModal(files[0], '原始PDF')"
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
        </template>

        <template v-else>
          <p style="margin-bottom: 16px;">
            共处理 <strong>{{ result.fileCount }}</strong> 个PDF文件
          </p>
          <div style="margin-bottom: 16px;">
            <p style="color: #666; margin-bottom: 8px;">压缩结果：</p>
            <div 
              v-for="(r, idx) in result.results" 
              :key="idx"
              style="font-size: 13px; color: #666; padding: 8px 0; border-bottom: 1px solid #f0f0f0;"
            >
              <div style="font-weight: 500; color: #333; margin-bottom: 4px;">{{ r.originalName }}</div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span>{{ formatFileSize(r.originalSize) }}</span>
                <span>→</span>
                <span style="color: #67c23a;">{{ formatFileSize(r.compressedSize) }}</span>
                <el-tag type="success" size="small" effect="plain">压缩率 {{ r.compressionRatio }}%</el-tag>
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
const files = ref([])
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
  files.value.splice(index, 1)
  result.value = null
}

const compressPDF = async () => {
  if (!files.value || files.value.length === 0) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  loading.value = true
  result.value = null

  try {
    const response = await compressPDFApi(files.value, compressLevel.value)
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
    if (result.value.isBatch) {
      downloadFile(result.value.downloadUrl, `compressed_batch_${Date.now()}.zip`)
    } else {
      downloadFile(result.value.downloadUrl, `compressed_${Date.now()}.pdf`)
    }
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
