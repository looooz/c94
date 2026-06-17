<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF拆分</h1>
      <p>按页数、范围或指定页拆分PDF文件</p>
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
            开始拆分
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          拆分成功！
        </h3>
        <p style="margin-bottom: 12px;">
          共拆分为 <strong>{{ result.fileCount }}</strong> 个文件
        </p>
        <p style="margin-bottom: 16px;">
          压缩包大小：{{ formatFileSize(result.fileSize) }}
        </p>
        <div v-if="result.files && result.files.length > 0" style="margin-bottom: 16px;">
          <p style="color: #666; margin-bottom: 8px;">包含文件：</p>
          <div 
            v-for="(f, idx) in result.files.slice(0, 5)" 
            :key="idx"
            style="font-size: 13px; color: #666; padding: 4px 0;"
          >
            {{ f.name }} ({{ formatFileSize(f.size) }})
          </div>
          <p v-if="result.files.length > 5" style="font-size: 13px; color: #999;">
            还有 {{ result.files.length - 5 }} 个文件...
          </p>
        </div>

        <div class="result-preview-section">
          <h4 style="margin-bottom: 12px; color: #333;">
            <el-icon style="margin-right: 8px;"><View /></el-icon>
            原始PDF预览
          </h4>
          <p style="font-size: 13px; color: #999; margin-bottom: 12px;">
            拆分后的文件已打包至ZIP压缩包，点击下载查看
          </p>
          <div class="result-preview-wrapper">
            <PdfPreview 
              :src="file" 
              width="150px" 
              height="200px" 
              :scale="1.2"
              @click="openPreviewModal(file, file.name)"
            />
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="downloadResult">
            <el-icon style="margin-right: 8px;"><Download /></el-icon>
            下载ZIP压缩包
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

const fileInput = ref(null)
const file = ref(null)
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

const splitPDF = async () => {
  if (!file.value) {
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
    const response = await splitPDFApi(file.value, options)
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
</style>
