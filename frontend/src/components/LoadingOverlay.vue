<template>
  <div v-if="visible" class="loading-overlay">
    <div class="loading-spinner"></div>
    <p style="margin-top: 20px; color: #667eea; font-weight: 500;">{{ text }}</p>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  text: {
    type: String,
    default: '处理中...'
  }
})
</script>
