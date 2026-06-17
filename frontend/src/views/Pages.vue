<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>PDF页面管理</h1>
      <p>删除、旋转、提取、重新排序PDF页面</p>
    </div>

    <div class="tool-card">
      <div class="nav-menu">
        <el-menu 
          :default-active="activeTab" 
          mode="horizontal"
          @select="handleTabChange"
        >
          <el-menu-item index="delete">删除页面</el-menu-item>
          <el-menu-item index="rotate">旋转页面</el-menu-item>
          <el-menu-item index="extract">提取页面</el-menu-item>
          <el-menu-item index="reorder">调整顺序</el-menu-item>
        </el-menu>
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
        <template v-if="activeTab === 'delete'">
          <div class="setting-row">
            <span class="setting-label">删除页码：</span>
            <el-input 
              v-model="pagesToDelete" 
              placeholder="如: 1, 3, 5-7" 
              style="width: 300px;"
            />
            <span style="color: #999; font-size: 13px;">用逗号分隔</span>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="handleDeletePages" :disabled="loading || !pagesToDelete.trim()">
              <el-icon style="margin-right: 8px;"><Delete /></el-icon>
              删除选中页面
            </button>
          </div>
        </template>

        <template v-if="activeTab === 'rotate'">
          <div class="setting-row">
            <span class="setting-label">页面范围：</span>
            <el-radio-group v-model="rotatePageMode">
              <el-radio value="all">全部页面</el-radio>
              <el-radio value="specific">指定页面</el-radio>
            </el-radio-group>
          </div>
          <div v-if="rotatePageMode === 'specific'" class="setting-row">
            <span class="setting-label">指定页码：</span>
            <el-input 
              v-model="pagesToRotate" 
              placeholder="如: 1, 3, 5" 
              style="width: 300px;"
            />
          </div>
          <div class="setting-row">
            <span class="setting-label">旋转角度：</span>
            <el-radio-group v-model="rotation">
              <el-radio :value="90">90°</el-radio>
              <el-radio :value="180">180°</el-radio>
              <el-radio :value="270">270°</el-radio>
            </el-radio-group>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="handleRotatePages" :disabled="loading || !canRotate">
              <el-icon style="margin-right: 8px;"><RefreshRight /></el-icon>
              旋转页面
            </button>
          </div>
        </template>

        <template v-if="activeTab === 'extract'">
          <div class="setting-row">
            <span class="setting-label">提取页码：</span>
            <el-input 
              v-model="pagesToExtract" 
              placeholder="如: 1, 3, 5-7" 
              style="width: 300px;"
            />
            <span style="color: #999; font-size: 13px;">用逗号分隔</span>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="handleExtractPages" :disabled="loading || !pagesToExtract.trim()">
              <el-icon style="margin-right: 8px;"><DocumentCopy /></el-icon>
              提取选中页面
            </button>
          </div>
        </template>

        <template v-if="activeTab === 'reorder'">
          <div class="setting-row">
            <span class="setting-label">新的顺序：</span>
            <el-input 
              v-model="newOrder" 
              placeholder="如: 3, 1, 2, 5, 4" 
              style="width: 300px;"
            />
            <span style="color: #999; font-size: 13px;">输入所有页码，用逗号分隔</span>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <button class="action-button" @click="handleReorderPages" :disabled="loading || !newOrder.trim()">
              <el-icon style="margin-right: 8px;"><Rank /></el-icon>
              重新排序
            </button>
          </div>
        </template>
      </div>

      <div v-if="result" class="result-card">
        <h3 style="margin-bottom: 16px; color: #667eea;">
          <el-icon style="margin-right: 8px;"><CircleCheckFilled /></el-icon>
          操作成功！
        </h3>
        <p v-if="result.pagesDeleted" style="margin-bottom: 12px;">
          已删除 <strong>{{ result.pagesDeleted }}</strong> 页，剩余 <strong>{{ result.pagesRemaining }}</strong> 页
        </p>
        <p v-if="result.rotation" style="margin-bottom: 12px;">
          已旋转 <strong>{{ result.rotation }}°</strong>
        </p>
        <p v-if="result.pagesExtracted" style="margin-bottom: 12px;">
          已提取 <strong>{{ result.pagesExtracted }}</strong> 页
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

    <LoadingOverlay :visible="loading" :text="loadingText" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  deletePages,
  rotatePages,
  extractPages,
  reorderPages,
  formatFileSize, 
  downloadFile 
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'

const fileInput = ref(null)
const file = ref(null)
const isDragging = ref(false)
const loading = ref(false)
const result = ref(null)
const activeTab = ref('delete')

const pagesToDelete = ref('')
const rotatePageMode = ref('all')
const pagesToRotate = ref('')
const rotation = ref(90)
const pagesToExtract = ref('')
const newOrder = ref('')

const loadingText = computed(() => {
  switch (activeTab.value) {
    case 'delete': return '正在删除页面...'
    case 'rotate': return '正在旋转页面...'
    case 'extract': return '正在提取页面...'
    case 'reorder': return '正在重新排序...'
    default: return '处理中...'
  }
})

const canRotate = computed(() => {
  if (rotatePageMode.value === 'all') return true
  return pagesToRotate.value.trim() !== ''
})

const handleTabChange = (tab) => {
  activeTab.value = tab
  result.value = null
}

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

const handleDeletePages = async () => {
  if (!pagesToDelete.value.trim()) {
    ElMessage.warning('请输入要删除的页码')
    return
  }

  loading.value = true
  result.value = null

  try {
    const response = await deletePages(file.value, pagesToDelete.value)
    result.value = response.data
    ElMessage.success('页面删除成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '删除失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleRotatePages = async () => {
  if (!canRotate.value) {
    ElMessage.warning('请输入要旋转的页码')
    return
  }

  loading.value = true
  result.value = null

  try {
    const pages = rotatePageMode.value === 'all' ? 'all' : pagesToRotate.value
    const response = await rotatePages(file.value, pages, rotation.value)
    result.value = response.data
    ElMessage.success('页面旋转成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '旋转失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleExtractPages = async () => {
  if (!pagesToExtract.value.trim()) {
    ElMessage.warning('请输入要提取的页码')
    return
  }

  loading.value = true
  result.value = null

  try {
    const response = await extractPages(file.value, pagesToExtract.value)
    result.value = response.data
    ElMessage.success('页面提取成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '提取失败，请重试')
  } finally {
    loading.value = false
  }
}

const handleReorderPages = async () => {
  if (!newOrder.value.trim()) {
    ElMessage.warning('请输入新的页面顺序')
    return
  }

  loading.value = true
  result.value = null

  try {
    const orderArr = newOrder.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
    const response = await reorderPages(file.value, orderArr)
    result.value = response.data
    ElMessage.success('页面重排序成功！')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '重排序失败，请重试')
  } finally {
    loading.value = false
  }
}

const downloadResult = () => {
  if (result.value) {
    downloadFile(result.value.downloadUrl, `pages_${activeTab.value}_${Date.now()}.pdf`)
  }
}
</script>
