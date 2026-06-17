<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF加水印</h1>
      <p>添加文字或图片水印，支持自定义位置和透明度</p>
    </div>

    <div class="tool-card">
      <div class="setting-row">
        <span class="setting-label">水印类型：</span>
        <el-radio-group v-model="watermarkType">
          <el-radio value="text">文字水印</el-radio>
          <el-radio value="image">图片水印</el-radio>
        </el-radio-group>
      </div>

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
        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">水印文字：</span>
          <el-input v-model="watermarkText" placeholder="请输入水印文字" style="width: 300px;" />
        </div>

        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">字体：</span>
          <el-select v-model="fontFamily" style="width: 200px;">
            <el-option label="Helvetica" value="Helvetica" />
            <el-option label="Helvetica Bold" value="Helvetica-Bold" />
            <el-option label="Times Roman" value="Times-Roman" />
            <el-option label="Times Bold" value="Times-Bold" />
            <el-option label="Courier" value="Courier" />
            <el-option label="Courier Bold" value="Courier-Bold" />
          </el-select>
        </div>

        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">字体大小：</span>
          <el-input-number v-model="fontSize" :min="12" :max="200" />
        </div>

        <div v-if="watermarkType === 'text'" class="setting-row">
          <span class="setting-label">文字颜色：</span>
          <el-color-picker v-model="fontColor" show-alpha />
        </div>

        <div v-if="watermarkType === 'image'" class="setting-row">
          <span class="setting-label">水印图片：</span>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept="image/jpeg,image/png,image/jpg"
            @change="handleWatermarkImageSelect"
          >
            <el-button>
              <el-icon><Upload /></el-icon>
              选择水印图片
            </el-button>
          </el-upload>
          <span v-if="watermarkImage" style="color: #67c23a;">
            <el-icon><CircleCheckFilled /></el-icon>
            已选择: {{ watermarkImage.name }}
          </span>
        </div>

        <div v-if="watermarkType === 'image'" class="setting-row">
          <span class="setting-label">图片缩放：</span>
          <el-slider v-model="imageScale" :min="0.1" :max="2" :step="0.1" style="width: 200px;" />
          <span>{{ imageScale.toFixed(1) }}x</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">水印位置：</span>
          <el-select v-model="position" style="width: 200px;">
            <el-option label="左上角" value="top-left" />
            <el-option label="顶部居中" value="top-center" />
            <el-option label="右上角" value="top-right" />
            <el-option label="中间靠左" value="center-left" />
            <el-option label="居中" value="center" />
            <el-option label="中间靠右" value="center-right" />
            <el-option label="左下角" value="bottom-left" />
            <el-option label="底部居中" value="bottom-center" />
            <el-option label="右下角" value="bottom-right" />
            <el-option label="平铺" value="tiled" />
          </el-select>
        </div>

        <div class="setting-row">
          <span class="setting-label">透明度：</span>
          <el-slider v-model="opacity" :min="0.1" :max="1" :step="0.1" style="width: 200px;" />
          <span>{{ Math.round(opacity * 100) }}%</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">旋转角度：</span>
          <el-select v-model="rotation" style="width: 150px;">
            <el-option label="0°" :value="0" />
            <el-option label="45°" :value="45" />
            <el-option label="90°" :value="90" />
            <el-option label="180°" :value="180" />
            <el-option label="-45°" :value="-45" />
          </el-select>
        </div>

        <div class="watermark-preview">
          <h4 style="margin-bottom: 16px;">预览效果</h4>
          <div class="watermark-preview-box">
            <div 
              v-if="watermarkType === 'text'"
              :style="previewStyle"
            >
              {{ watermarkText || '水印文字' }}
            </div>
            <div 
              v-else-if="watermarkImagePreview"
              :style="previewStyle"
            >
              <img :src="watermarkImagePreview" style="max-width: 100px; max-height: 60px;" />
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button class="action-button" @click="addWatermark" :disabled="loading || !canSubmit">
            <el-icon style="margin-right: 8px;"><Stamp /></el-icon>
            添加水印
          </button>
        </div>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          水印添加成功！
        </h3>
        <p style="margin-bottom: 12px;">
          文件名：{{ result.fileName }}
        </p>
        <p style="margin-bottom: 16px;">
          文件大小：{{ formatFileSize(result.fileSize) }}
        </p>
        <button class="action-button" @click="downloadResult">
          <el-icon style="margin-right: 8px;"><Download /></el-icon>
          下载带水印的PDF
        </button>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="正在添加水印..." />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  addWatermark as addWatermarkApi, 
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)

const watermarkType = ref('text')
const watermarkText = ref('CONFIDENTIAL')
const fontFamily = ref('Helvetica')
const fontSize = ref(48)
const fontColor = ref('#ff0000')
const watermarkImage = ref(null)
const watermarkImagePreview = ref(null)
const imageScale = ref(0.5)
const position = ref('center')
const opacity = ref(0.3)
const rotation = ref(0)

const canSubmit = computed(() => {
  if (watermarkType.value === 'image' && !watermarkImage.value) return false
  if (watermarkType.value === 'text' && !watermarkText.value.trim()) return false
  return true
})

const previewStyle = computed(() => {
  const baseStyle = {
    opacity: opacity.value,
    transform: `rotate(${rotation.value}deg)`,
    color: watermarkType.value === 'text' ? fontColor.value : undefined,
    fontSize: watermarkType.value === 'text' ? `${fontSize.value / 3}px` : undefined,
    fontFamily: fontFamily.value,
    fontWeight: fontFamily.value.includes('Bold') ? 'bold' : 'normal'
  }
  
  const positions = {
    'top-left': { top: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'top-right': { top: '20px', right: '20px' },
    'center-left': { top: '50%', left: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'center': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation.value}deg)` },
    'center-right': { top: '50%', right: '20px', transform: `translateY(-50%) rotate(${rotation.value}deg)` },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-center': { bottom: '20px', left: '50%', transform: `translateX(-50%) rotate(${rotation.value}deg)` },
    'bottom-right': { bottom: '20px', right: '20px' },
    'tiled': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(-45deg)` }
  }
  
  return { ...baseStyle, ...positions[position.value], position: 'absolute' }
})

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

const handleWatermarkImageSelect = (uploadFile) => {
  watermarkImage.value = uploadFile.raw
  const reader = new FileReader()
  reader.onload = (e) => {
    watermarkImagePreview.value = e.target.result
  }
  reader.readAsDataURL(uploadFile.raw)
}

const removeFile = () => {
  file.value = null
  result.value = null
}

const addWatermark = async () => {
  if (!file.value) {
    ElMessage.warning('请上传PDF文件')
    return
  }

  if (!canSubmit.value) {
    ElMessage.warning('请完善水印设置')
    return
  }

  const options = {
    type: watermarkType.value,
    text: watermarkText.value,
    fontFamily: fontFamily.value,
    fontSize: fontSize.value,
    color: fontColor.value,
    opacity: opacity.value,
    position: position.value,
    rotation: rotation.value,
    imageScale: imageScale.value
  }

  loading.value = true
  result.value = null

  try {
    const response = await addWatermarkApi(file.value, watermarkImage.value, options)
    result.value = response.data
    ElMessage.success('水印添加成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '添加水印失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `watermarked_${Date.now()}.pdf`)
  }
}
</script>
