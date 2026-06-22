<template>
  <div class="main-container">
    <div class="page-header">
      <h1>PDF处理工具</h1>
      <p>一站式在线PDF解决方案 - 合并、拆分、压缩、转换、水印等（全部支持批量处理）</p>
    </div>

    <div class="tool-grid">
      <div 
        v-for="tool in tools" 
        :key="tool.path" 
        class="tool-item"
        @click="goToTool(tool.path)"
      >
        <div class="tool-icon" :style="{ background: tool.color }">
          <component :is="tool.icon" :size="36" color="white" />
        </div>
        <div class="tool-title-row">
          <h3>{{ tool.name }}</h3>
          <el-tag v-if="tool.supportsBatch" type="success" size="small" effect="light" class="batch-tag">
            <el-icon style="margin-right: 2px;"><Files /></el-icon>
            批量
          </el-tag>
        </div>
        <p>{{ tool.description }}</p>
      </div>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <router-link to="/history" class="back-button">
        <el-icon><Clock /></el-icon>
        查看历史记录
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { 
  Fold, 
  Scissor, 
  ZoomOut, 
  PictureFilled, 
  Picture, 
  Stamp, 
  Edit, 
  Clock,
  Files
} from '@element-plus/icons-vue'

const router = useRouter()

const tools = [
  { 
    name: 'PDF合并', 
    path: '/merge', 
    icon: Fold, 
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: '将多个PDF文件合并为一个PDF，支持拖拽排序，多文件批量操作',
    supportsBatch: true
  },
  { 
    name: 'PDF拆分', 
    path: '/split', 
    icon: Scissor, 
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    description: '按页数、范围或指定页拆分PDF文件，支持批量处理多个PDF',
    supportsBatch: true
  },
  { 
    name: 'PDF压缩', 
    path: '/compress', 
    icon: ZoomOut, 
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    description: '压缩PDF文件大小，支持多等级压缩，批量处理多文件',
    supportsBatch: true
  },
  { 
    name: 'PDF转图片', 
    path: '/to-image', 
    icon: PictureFilled, 
    color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    description: '将PDF页面转换为PNG或JPG图片，支持批量转换多个PDF',
    supportsBatch: true
  },
  { 
    name: '图片转PDF', 
    path: '/from-image', 
    icon: Picture, 
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    description: '将多张图片合并为一个PDF，或批量生成独立PDF文件',
    supportsBatch: true
  },
  { 
    name: 'PDF加水印', 
    path: '/watermark', 
    icon: Stamp, 
    color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    description: '添加文字或图片水印，自定义位置和透明度，支持批量处理',
    supportsBatch: true
  },
  { 
    name: '页面管理', 
    path: '/pages', 
    icon: Edit, 
    color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    description: '删除、旋转、提取、重新排序PDF页面，批量操作多个文件',
    supportsBatch: true
  },
  { 
    name: '历史记录', 
    path: '/history', 
    icon: Clock, 
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: '查看处理记录，快速重新下载',
    supportsBatch: false
  }
]

const goToTool = (path) => {
  router.push(path)
}
</script>

<style scoped>
.tool-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-title-row h3 {
  margin-bottom: 0;
}

.batch-tag {
  display: inline-flex;
  align-items: center;
  font-weight: 500;
}
</style>
