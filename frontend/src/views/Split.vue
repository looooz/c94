<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF拆分</h1>
      <p>按页数、范围或指定页拆分PDF文件（支持批量）</p>
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
          <span class="setting-label">拆分方式：</span>
          <el-radio-group v-model="splitMode">
            <el-radio value="pagesPerFile">按页数拆分</el-radio>
            <el-radio value="ranges">按范围拆分</el-radio>
            <el-radio value="specific">提取指定页</el-radio>
          </el-radio-group>
        </div>

        <div v-if="splitMode === 'pagesPerFile'" class="setting-row">
          <span class="setting-label">每页文件数：</span>
          <el-input-number v-model="pagesPerFile" :min="1" :max="100" />
          <span style="color: #999;">页/文件</span>
        </div>

        <div v-if="splitMode === 'ranges'" class="setting-row">
          <span class="setting-label">页面范围：</span>
          <el-input 
            v-model="ranges" 
            placeholder="如: 1-5, 8-10" 
            class="page-range-input"
          />
          <span style="color: #999; font-size: 13px;">用逗号分隔多个范围</span>
        </div>

        <div v-if="splitMode === 'specific'" class="setting-row">
          <span class="setting-label">指定页码：</span>
          <el-input 
            v-model="specificPages" 
            placeholder="如: 3, 5, 7" 
            class="page-range-input"
          />
          <span style="color: #999; font-size: 13px;">用逗号分隔页码</span>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="splitPDF" :disabled="loading">
            <el-icon style="margin-right: 8px;"><Scissor /></el-icon>
            开始拆分（{{ files.length }}个文件）
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          拆分成功！
        </h3>

        <template v-if="!result.isBatch">
          <p style="margin-bottom: 12px;">
            共拆分为 <strong>{{ result.fileCount }}</strong> 个文件
          </p>
          <div v-if="result.files && result.files.length > 0" style="margin-bottom: 16px;">
            <p style="color: #666; margin-bottom: 8px;">文件列表：</p>
            <div 
              v-for="(f, idx) in result.files" 
              :key="idx"
              class="split-file-item"
            >
              <el-icon color="#667eea" style="margin-right: 8px;"><Document /></el-icon>
              <span style="font-weight: 500; color: #333; flex: 1;">{{ f.name }}</span>
              <span style="color: #999; font-size: 13px;">{{ formatFileSize(f.size) }}</span>
            </div>
          </div>
        </template>

        <template v-else>
          <p style="margin-bottom: 12px;">
            共处理 <strong>{{ result.pdfCount || result.results?.filter(r => r.success).length }}</strong> 个PDF文件，
            生成 <strong>{{ result.fileCount }}</strong> 个拆分文件
          </p>
          <div v-if="result.results && result.results.length > 0" style="margin-bottom: 16px;">
            <p style="color: #666; margin-bottom: 8px;">拆分结果：</p>
            <div 
              v-for="(r, idx) in result.results" 
              :key="idx"
              class="split-result-item"
            >
              <div class="split-result-header">
                <el-icon :size="18" :color="r.success ? '#67c23a' : '#f56c6c'">
                  <CircleCheckFilled v-if="r.success" />
                  <CircleCloseFilled v-else />
                </el-icon>
                <span style="font-weight: 500; color: #333;">{{ r.originalName }}</span>
              </div>
              <div v-if="r.success" style="padding-left: 26px; margin-top: 4px; color: #666; font-size: 13px;">
                <span>共 {{ r.totalPages }} 页，拆分为 {{ r.fileCount }} 个文件</span>
              </div>
              <div v-else style="padding-left: 26px; margin-top: 4px; color: #f56c6c; font-size: 13px;">
                处理失败：{{ r.error }}
              </div>
            </div>
          </div>
        </template>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="downloadResult">
            <el-icon style="margin-right: 8px;"><Download /></el-icon>
            {{ result.isBatch ? '下载全部 (ZIP)' : '下载ZIP压缩包' }}
          </button>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在拆分PDF..." />
    
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
  splitPDF as splitPDFApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'
import { CircleCheckFilled, CircleCloseFilled, Document } from '@element-plus/icons-vue'

const fileInput = ref(null)
const files = ref([])
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)
const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const splitMode = ref('pagesPerFile')
const pagesPerFile = ref(5)
const ranges = ref('')
const specificPages = ref('')

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

const splitPDF = async () => {
  if (!files.value || files.value.length === 0) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  const options = { mode: splitMode.value }
  
  if (splitMode.value === 'pagesPerFile') {
    options.pagesPerFile = pagesPerFile.value
  } else if (splitMode.value === 'ranges') {
    if (!ranges.value.trim()) {
      ElMessage.warning('请输入页面范围')
      return
    }
    options.ranges = ranges.value
  } else if (splitMode.value === 'specific') {
    if (!specificPages.value.trim()) {
      ElMessage.warning('请输入指定页码')
      return
    }
    options.specificPages = specificPages.value
  }

  loading.value = true
  result.value = null

  try {
    const response = await splitPDFApi(files.value, options)
    result.value = response.data
    ElMessage.success('PDF拆分成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '拆分失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `split_${Date.now()}.zip`)
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}
</script>

<style scoped>
.result-preview-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.result-preview-wrapper {
  display: flex;
  justify-content: center;
}

.split-file-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 6px;
  border: 1px solid #e9ecef;
}

.split-result-item {
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s;
}

.split-result-item:hover {
  background: #f0f5ff;
  border-color: #d6e4ff;
}

.split-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
