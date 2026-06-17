<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>图片转PDF</h1>
      <p>将多张图片合并为一个PDF文件</p>
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
          拖拽图片文件到此处，或点击选择文件
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
        <div 
          v-for="(file, index) in files" 
          :key="index" 
          class="file-item"
        >
          <div style="display: flex; align-items: center;">
            <span class="drag-handle">
              <el-icon><Rank /></el-icon>
            </span>
            <el-icon color="#fa709a"><Picture /></el-icon>
            <span style="margin-left: 12px;">{{ file.name }}</span>
            <span style="margin-left: 12px; color: #999; font-size: 13px;">
              {{ formatFileSize(file.size) }}
            </span>
          </div>
          <el-button type="danger" text @click="removeFile(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="files.length > 0">
        <div class="setting-row">
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
            转换为PDF
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          转换成功！
        </h3>
        <p style="margin-bottom: 12px;">
          共 <strong>{{ result.pageCount }}</strong> 页
        </p>
        <p style="margin-bottom: 16px;">
          文件大小：{{ formatFileSize(result.fileSize) }}
        </p>
        <button class="action-button" @click="downloadResult">
          <el-icon style="margin-right: 8px;"><Download /></el-icon>
          下载PDF
        </button>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在转换为PDF..." />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import { 
  imageToPDF as imageToPDFApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'

const fileInput = ref(null)
const fileListRef = ref(null)
const files = ref([])
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)

const pageSize = ref('A4')
const customWidth = ref(800)
const customHeight = ref(600)
const margin = ref(20)
const fit = ref('contain')

let sortableInstance = null

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

const addFiles = (newFiles) => {
  if (files.value.length + newFiles.length > 50) {
    ElMessage.warning('最多只能上传50个文件')
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

const convertToPDF = async () => {
  if (files.value.length < 1) {
    ElMessage.warning('请至少上传1张图片')
    return
  }

  const options = {
    pageSize: pageSize.value,
    margin: margin.value,
    fit: fit.value,
    order: files.value.map((_, idx) => idx)
  }

  if (pageSize.value === 'custom') {
    options.customWidth = customWidth.value
    options.customHeight = customHeight.value
  }

  loading.value = true
  result.value = null

  try {
    const response = await imageToPDFApi(files.value, options)
    result.value = response.data
    ElMessage.success('图片转PDF成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '转换失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `images_to_pdf_${Date.now()}.pdf`)
  }
}

onMounted(() => {
  initSortable()
})
</script>
