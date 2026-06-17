import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 300000
})

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const downloadFile = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const mergePDF = (files, order) => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  if (order) formData.append('order', JSON.stringify(order))
  return api.post('/merge', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const splitPDF = (file, options) => {
  const formData = new FormData()
  formData.append('pdf', file)
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined && options[key] !== null) {
      formData.append(key, options[key])
    }
  })
  return api.post('/split', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const compressPDF = (file, level) => {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('level', level)
  return api.post('/compress', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const pdfToImage = (file, options) => {
  const formData = new FormData()
  formData.append('pdf', file)
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined && options[key] !== null) {
      formData.append(key, options[key])
    }
  })
  return api.post('/to-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const imageToPDF = (files, options) => {
  const formData = new FormData()
  files.forEach(file => formData.append('images', file))
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined && options[key] !== null) {
      formData.append(key, options[key])
    }
  })
  return api.post('/from-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const addWatermark = (pdfFile, watermarkImageFile, options) => {
  const formData = new FormData()
  formData.append('pdf', pdfFile)
  if (watermarkImageFile) {
    formData.append('watermarkImage', watermarkImageFile)
  }
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined && options[key] !== null) {
      formData.append(key, options[key])
    }
  })
  return api.post('/watermark', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const deletePages = (file, pagesToDelete) => {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('pagesToDelete', pagesToDelete)
  return api.post('/pages/delete', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const rotatePages = (file, pagesToRotate, rotation) => {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('pagesToRotate', pagesToRotate)
  formData.append('rotation', rotation)
  return api.post('/pages/rotate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const extractPages = (file, pagesToExtract) => {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('pagesToExtract', pagesToExtract)
  return api.post('/pages/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const reorderPages = (file, newOrder) => {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('newOrder', JSON.stringify(newOrder))
  return api.post('/pages/reorder', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getHistory = () => api.get('/history')
export const deleteHistoryItem = (id) => api.delete(`/history/${id}`)
export const deleteBatchHistory = (ids) => api.delete('/history/batch', { data: { ids } })
export const clearHistory = () => api.delete('/history')

export default api
