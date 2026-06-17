<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF合并</h1>
      <p>上传多个PDF文件，调整顺序后合并为一个PDF</p>
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
          拖拽PDF文件到此处，或点击选择文件
        </p>
        <p style="font-size: 14px; color: #999; margin-top: 8px;">
          支持上传最多20个PDF文件
        </p>
        <input 
          ref="fileInput"
          type="file" 
          multiple 
          accept=".pdf"
          style="display: none;"
          @change="handleFileSelect"
        />
      </div>

      <div v-if="files.length > 0" class="file-list" ref="fileListRef">
        <div 
          v-for="(file, index) in files" 
          :key="index" 
          class="file-item"
          :data-id="index"
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="drag-handle">
              <el-icon><Rank /></el-icon>
            </span>
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
          <el-button type="danger" text @click="removeFile(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="files.length >= 2" style="text-align: center; margin-top: 24px;">
        <button class="action-button" @click="mergePDFs" :disabled="loading">
          <el-icon style="margin-right: 8px;"><Fold /></el-icon>
          开始合并
        </button>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          合并成功！
        </h3>
        <p style="margin-bottom: 12px;">
          文件名：{{ result.fileName }}
        </p>
        <p style="margin-bottom: 16px;">
          文件大小：{{ formatFileSize(result.fileSize) }}
        </p>

        <div class="result-preview-section">
          <h4 style="margin-bottom: 12px; color: #333;">
            <el-icon style="margin-right: 8px;"><View /></el-icon>
            合并结果预览
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
            下载合并后的PDF
          </button>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在合并PDF..." />
    
    <PdfPreviewModal 
      v-model="previewModalVisible" 
      :src="previewModalSrc" 
      :title="previewModalTitle"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import { 
  mergePDF as mergePDFApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import PdfPreview from '../components/PdfPreview.vue'
import PdfPreviewModal from '../components/PdfPreviewModal.vue'

const router = useRouter()
const fileInput = ref(null)
const fileListRef = ref(null)
const files = ref([])
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)
const previewModalVisible = ref(false)
const previewModalSrc = ref(null)
const previewModalTitle = ref('PDF预览')

let sortableInstance = null

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileSelect = (e) => {
  const selectedFiles = Array.from(e.target.files)
  addFiles(selectedFiles)
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragging.value = false
  const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
  if (droppedFiles.length === 0) {
    ElMessage.warning('请拖入PDF文件')
    return
  }
  addFiles(droppedFiles)
}

const addFiles = (newFiles) => {
  if (files.value.length + newFiles.length > 20) {
    ElMessage.warning('最多只能上传20个文件')
    return
  }
  files.value = [...files.value, ...newFiles]
  nextTick(() => {
    initSortable()
  })
}

const removeFile = (index) => {
  files.value.splice(index, 1)
  nextTick(() => {
    initSortable()
  })
}

const initSortable = () => {
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

const mergePDFs = async () => {
  if (files.value.length < 2) {
    ElMessage.warning('请至少上传2个PDF文件')
    return
  }

  loading.value = true
  result.value = null

  try {
    const order = files.value.map((_, idx) => idx)
    const response = await mergePDFApi(files.value, order)
    result.value = response.data
    ElMessage.success('PDF合并成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '合并失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `merged_${Date.now()}.pdf`)
  }
}

const openPreviewModal = (src, title) => {
  previewModalSrc.value = src
  previewModalTitle.value = title || 'PDF预览'
  previewModalVisible.value = true
}

onMounted(() => {
  initSortable()
})
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
