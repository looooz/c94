<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF转图片</h1>
      <p>将PDF页面转换为PNG或JPG图片（支持批量处理多个PDF）</p>
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
        <div 
          v-for="(f, index) in files" 
          :key="index" 
          class="file-item"
          :style="{ marginBottom: index < files.length - 1 ? '12px' : '0' }"
        >
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
          <span class="setting-label">输出格式：</span>
          <el-radio-group v-model="outputFormat">
            <el-radio value="png">PNG（无损，推荐）</el-radio>
            <el-radio value="jpg">JPG（体积更小）</el-radio>
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
          <span style="color: #999; font-size: 13px;">用逗号分隔，对所有PDF生效</span>
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
            开始转换（{{ files.length }}个文件）
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
            共转换 <strong>{{ result.fileCount }}</strong> 张图片
          </p>
          <p style="margin-bottom: 16px;">
            格式：{{ outputFormat.toUpperCase() }} | 文件大小：{{ formatFileSize(result.fileSize) }}
          </p>

          <div style="padding: 16px; background: #f0f5ff; border-radius: 8px; border: 1px solid #d6e4ff; margin-bottom: 16px;">
            <p style="color: #667eea; font-size: 13px; margin: 0;">
              <el-icon style="vertical-align: middle; margin-right: 4px;"><InfoFilled /></el-icon>
              已打包为 ZIP 文件下载，按原PDF名称创建文件夹组织图片
            </p>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="downloadResult">
              <el-icon style="margin-right: 8px;"><Download /></el-icon>
              下载 ZIP 压缩包
            </button>
          </div>
        </template>

        <template v-else>
          <p style="margin-bottom: 12px;">
            共处理 <strong>{{ result.pdfCount || result.results?.filter(r => r.success).length }}</strong> 个PDF文件
          </p>
          <p style="margin-bottom: 16px;">
            生成 <strong>{{ result.fileCount }}</strong> 张图片 | 格式：{{ outputFormat.toUpperCase() }} | ZIP大小：{{ formatFileSize(result.fileSize) }}
          </p>

          <div v-if="result.results && result.results.length > 0" style="margin-bottom: 16px;">
            <p style="color: #666; margin-bottom: 8px;">转换结果：</p>
            <div 
              v-for="(r, idx) in result.results" 
              :key="idx"
              style="font-size: 13px; color: #666; padding: 8px 0; border-bottom: 1px solid #f0f0f0;"
            >
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-weight: 500; color: #333; margin-bottom: 4px;">{{ r.originalName }}</div>
                <template v-if="r.success">
                  <el-tag type="success" size="small" effect="plain">
                    {{ r.fileCount }} 张图片
                  </el-tag>
                </template>
                <el-tag v-else type="danger" size="small" effect="plain">
                  失败
                </el-tag>
              </div>
              <div v-if="!r.success" style="color: #f56c6c; padding-left: 4px;">
                {{ r.error }}
              </div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="downloadResult">
              <el-icon style="margin-right: 8px;"><Download /></el-icon>
              下载全部 (ZIP)
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  pdfToImage as pdfToImageApi,
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
const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

const outputFormat = ref('png')
const pageMode = ref('all')
const specificPages = ref('')
const dpi = ref(150)

const loadingText = computed(() => {
  return `正在转换 ${files.value.length} 个PDF为${outputFormat.value.toUpperCase()}图片...`
})

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

const convertToImage = async () => {
  if (!files.value || files.value.length === 0) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  if (pageMode.value === 'specific' && !specificPages.value.trim()) {
    ElMessage.warning('请输入指定页码')
    return
  }

  const options = {
    format: outputFormat.value,
    pageMode: pageMode.value,
    dpi: dpi.value
  }

  if (pageMode.value === 'specific') {
    options.specificPages = specificPages.value.trim()
  }

  loading.value = true
  result.value = null

  try {
    const response = await pdfToImageApi(files.value, options)
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
    if (result.value.isBatch) {
      downloadFile(result.value.downloadUrl, `pdf_to_images_batch_${Date.now()}.zip`)
    } else {
      downloadFile(result.value.downloadUrl, `pdf_to_images_${Date.now()}.zip`)
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
.page-range-input {
  width: 300px;
  margin-right: 12px;
}
</style>
