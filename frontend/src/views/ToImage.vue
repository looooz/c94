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
        <div style="display: flex; align-items: center;">
          <el-icon color="#667eea"><Document /></el-icon>
          <span style="margin-left: 12px;">{{ file.name }}</span>
          <span style="margin-left: 12px; color: #999; font-size: 13px;">
            {{ formatFileSize(file.size) }}
          </span>
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

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          转换成功！
        </h3>
        <p style="margin-bottom: 12px;">
          共转换 <strong>{{ result.fileCount }}</strong> 张图片
        </p>
        <p style="margin-bottom: 12px;">
          格式：{{ outputFormat.toUpperCase() }}
        </p>
        <p style="margin-bottom: 16px;">
          压缩包大小：{{ formatFileSize(result.fileSize) }}
        </p>
        <button class="action-button" @click="downloadResult">
          <el-icon style="margin-right: 8px;"><Download /></el-icon>
          下载ZIP压缩包
        </button>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在转换PDF..." />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  pdfToImage as pdfToImageApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)

const outputFormat = ref('png')
const pageMode = ref('all')
const specificPages = ref('')
const dpi = ref(150)

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

const convertToImage = async () => {
  if (!file.value) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  const options = {
    format: outputFormat.value,
    pageMode: pageMode.value,
    dpi: dpi.value
  }

  if (pageMode.value === 'specific' && !specificPages.value.trim()) {
    ElMessage.warning('请输入指定页码')
    return
  }

  if (pageMode.value === 'specific') {
    options.specificPages = specificPages.value
  }

  loading.value = true
  result.value = null

  try {
    const response = await pdfToImageApi(file.value, options)
    result.value = response.data
    ElMessage.success('PDF转图片成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '转换失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `pdf_to_images_${Date.now()}.zip`)
  }
}
</script>
