# PDF Preview Spinning Bug - Debug Session

**Session ID:** `pdf-preview-spinning`
**Status:** `[CLOSED - FIXED]`
**Created:** 2026-06-17
**Description:** PDF预览功能一直在转圈，无法正常显示，影响合并、管理等多个界面

---

## Hypotheses

| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| H1 | pdf.js worker 加载失败或CDN资源不可用 | PENDING | - |
| H2 | 同一Canvas元素被并发render()调用，导致渲染冲突 | PENDING | - |
| H3 | loadPdf/renderPage过程中出现未捕获的异常，导致loading状态无法重置 | PENDING | - |
| H4 | 渲染任务(RenderingCancelledException)取消后未正确处理，状态卡住 | PENDING | - |
| H5 | src变化时，旧的渲染任务未清理，与新任务冲突 | PENDING | - |

---

## Instrumentation Logs

### Phase 1: Pre-fix logs
_(logs will be collected here after instrumentation)_

### Phase 2: Post-fix logs
_(logs will be collected here after fix verification)_

---

## Evidence Analysis

### Hypothesis Verification (based on pre-fix logs)

| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| H1 | pdf.js worker 加载失败或CDN资源不可用 | **CONFIRMED** | 日志反复出现：`"Setting up fake worker failed: \"Failed to fetch dynamically imported module: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js\""` |
| H2 | 同一Canvas元素被并发render()调用，导致渲染冲突 | REJECTED | 日志显示异常发生在 `getDocument` 阶段，未到达 `renderPage` |
| H3 | loadPdf/renderPage过程中出现未捕获的异常，导致loading状态无法重置 | PARTIAL | 异常被捕获，但 `loading=false` 执行在日志记录之后 |
| H4 | 渲染任务取消异常未正确处理 | REJECTED | 异常不是 `RenderingCancelledException` |
| H5 | src变化时旧任务未清理 | REJECTED | 日志未显示此类冲突 |

### Root Cause
**CDN 资源不可用**：`cdnjs.cloudflare.com` 无法访问，导致 pdf.js worker 加载失败，所有 `getDocument()` 调用抛出异常，预览功能完全失效。

---

## Fix Summary

### Root Causes Identified
1. **CDN 资源不可用**：`cdnjs.cloudflare.com` 无法访问，导致 pdf.js worker 加载失败
2. **pdfjs-dist 版本兼容性**：6.x 版本与 Vite 存在私有字段访问兼容性问题
3. **Canvas 渲染时机**：模板使用 v-else 导致 renderPage 时 canvas 不存在
4. **CMap 配置缺失**：字体加载警告可能导致渲染卡住
5. **Vite 配置**：不支持 top-level await

### Changes Made
1. **降级 pdfjs-dist 版本**：从 6.0.227 降级到 4.0.379（与原 CDN 版本一致）
2. **所有使用 pdfjs-dist 的文件**（7个文件）统一配置：
   - [PdfPreview.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/components/PdfPreview.vue#L32)
   - [PdfPreviewModal.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/components/PdfPreviewModal.vue#L50)
   - [Pages.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/Pages.vue#L266)
   - [Watermark.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/Watermark.vue#L281)
   - [ToImage.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/ToImage.vue#L155)
   - [Merge.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/Merge.vue) - 使用 PdfPreview 组件
   - [Split.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/Split.vue) - 使用 PdfPreview 组件
   - [Compress.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/Compress.vue) - 使用 PdfPreview 组件
   - [FromImage.vue](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/src/views/FromImage.vue) - 使用 PdfPreview 组件

### Fix Content
1. **本地 worker 导入**：
```js
// 修复前：
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js'

// 修复后：
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
```

2. **CMap 配置**（解决字体加载警告）：
```js
import cMapUrl from 'pdfjs-dist/cmaps/UniGB-UTF8-H.bcmap?url'
const cMapBaseUrl = cMapUrl.substring(0, cMapUrl.lastIndexOf('/') + 1)

// 在 getDocument 中添加：
pdfDoc = await pdfjsLib.getDocument({
  data: arrayBuffer,
  cMapUrl: cMapBaseUrl,
  cMapPacked: true
}).promise
```

3. **Canvas 渲染时机修复**：
```vue
<!-- 修复前：canvas 使用 v-else，仅在 !loading&&!error 时渲染 -->
<!-- 修复后：canvas 始终渲染，loading/error 作为覆盖层 -->
<canvas 
  ref="previewCanvas" 
  class="preview-canvas"
  :style="{ display: error ? 'none' : 'block' }"
/>
<div v-if="loading" class="preview-loading">...</div>
<div v-if="error" class="preview-error">...</div>
```

4. **Vite 配置**（[vite.config.js](file:///Users/macbook/dev/trae/lzp/solocoder/c94/frontend/vite.config.js#L6)）：
```js
build: {
  target: 'es2022'
},
optimizeDeps: {
  esbuildOptions: {
    target: 'es2022'
  }
}
```

### Verification Results
✅ **历史记录页面验证通过**：
- 2个 PDF 预览 canvas 都正常渲染 (hasContent: true)
- Canvas 尺寸正确 (430x288)
- 浏览器控制台无错误，只有字体警告
- 无转圈现象，PDF 内容正常显示

✅ **所有功能页面配置统一**：
- 合并、拆分、压缩、转图片、加水印、页面管理、历史记录
- 所有页面都使用统一的 PdfPreview 组件和配置
