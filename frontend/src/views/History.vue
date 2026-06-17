<template>
  <div class="main-container">
    <router-link to="/" class="back-button">
      <el-icon><ArrowLeft /></el-icon>
      返回首页
    </router-link>

    <div class="page-header">
      <h1>历史记录</h1>
      <p>查看处理记录，快速重新下载</p>
    </div>

    <div class="tool-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <el-button 
            type="danger" 
            @click="handleClearAll" 
            :disabled="loading || historyList.length === 0"
          >
            <el-icon><Delete /></el-icon>
            清空全部
          </el-button>
          <el-button 
            type="warning" 
            @click="handleBatchDelete" 
            :disabled="loading || selectedIds.length === 0"
            style="margin-left: 12px;"
          >
            <el-icon><Delete /></el-icon>
            批量删除 ({{ selectedIds.length }})
          </el-button>
        </div>
        <el-button @click="loadHistory" :disabled="loading">
          <el-icon :class="{ 'is-loading': loading }"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <div v-if="historyList.length === 0 && !loading" class="empty-state">
        <el-icon><Document /></el-icon>
        <p>暂无历史记录</p>
      </div>

      <div v-else>
        <div 
          v-for="item in historyList" 
          :key="item.id" 
          class="history-item"
        >
          <div style="display: flex; align-items: center; gap: 16px;">
            <el-checkbox 
              :model-value="selectedIds.includes(item.id)"
              @change="(val) => toggleSelect(item.id, val)"
            />
            <div class="tool-icon" :style="{ background: getTypeColor(item.type), width: '50px', height: '50px', fontSize: '24px' }">
              <component :is="getTypeIcon(item.type)" :size="24" color="white" />
            </div>
            <div>
              <h4 style="margin-bottom: 4px; color: #333;">{{ getTypeName(item.type) }}</h4>
              <p style="font-size: 13px; color: #666; margin-bottom: 4px;">
                {{ item.originalName }}
              </p>
              <p style="font-size: 12px; color: #999;">
                {{ formatDate(item.createdAt) }} · {{ formatFileSize(item.fileSize) }}
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <el-button type="primary" @click="handleDownload(item)">
              <el-icon><Download /></el-icon>
              下载
            </el-button>
            <el-button type="danger" text @click="handleDelete(item.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <LoadingOverlay :visible="loading" text="加载中..." />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Fold, Scissor, ZoomOut, PictureFilled, Picture, Stamp, Edit, Clock,
  Document, Download, Delete, Refresh
} from '@element-plus/icons-vue'
import { 
  getHistory as getHistoryApi,
  deleteHistoryItem,
  deleteBatchHistory,
  clearHistory as clearHistoryApi,
  formatFileSize,
  downloadFile
} from '../utils/api'
import LoadingOverlay from '../components/LoadingOverlay.vue'

const router = useRouter()
const historyList = ref([])
const loading = ref(false)
const selectedIds = ref([])

const typeIcons = {
  'merge': Fold,
  'split': Scissor,
  'compress': ZoomOut,
  'toImage': PictureFilled,
  'fromImage': Picture,
  'watermark': Stamp,
  'pages-delete': Edit,
  'pages-rotate': Edit,
  'pages-extract': Edit,
  'pages-reorder': Edit
}

const typeNames = {
  'merge': 'PDF合并',
  'split': 'PDF拆分',
  'compress': 'PDF压缩',
  'toImage': 'PDF转图片',
  'fromImage': '图片转PDF',
  'watermark': '添加水印',
  'pages-delete': '删除页面',
  'pages-rotate': '旋转页面',
  'pages-extract': '提取页面',
  'pages-reorder': '调整顺序'
}

const typeColors = {
  'merge': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'split': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'compress': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'toImage': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'fromImage': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'watermark': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'pages-delete': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'pages-rotate': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'pages-extract': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'pages-reorder': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
}

const getTypeIcon = (type) => typeIcons[type] || Document
const getTypeName = (type) => typeNames[type] || '其他操作'
const getTypeColor = (type) => typeColors[type] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadHistory = async () => {
  loading.value = true
  try {
    const response = await getHistoryApi()
    historyList.value = response.data.data || []
    selectedIds.value = []
  } catch (error) {
    ElMessage.error('加载历史记录失败')
  } finally {
    loading.value = false
  }
}

const toggleSelect = (id, selected) => {
  if (selected) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  } else {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  }
}

const handleDelete = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '确认删除', {
      type: 'warning'
    })
    await deleteHistoryItem(id)
    ElMessage.success('删除成功')
    loadHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要删除的记录')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 条记录吗？`, '确认删除', {
      type: 'warning'
    })
    await deleteBatchHistory(selectedIds.value)
    ElMessage.success('批量删除成功')
    loadHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleClearAll = async () => {
  if (historyList.value.length === 0) {
    ElMessage.warning('没有记录可清空')
    return
  }
  try {
    await ElMessageBox.confirm('确定要清空所有历史记录吗？此操作不可恢复！', '确认清空', {
      type: 'warning'
    })
    await clearHistoryApi()
    ElMessage.success('已清空所有历史记录')
    loadHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败')
    }
  }
}

const handleDownload = (item) => {
  downloadFile(item.downloadUrl, item.originalName || item.fileName)
}

onMounted(() => {
  loadHistory()
})
</script>
