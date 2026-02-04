import { useState, useEffect } from 'react'
import * as api from '../services/api'

export function useImages() {
  const [images, setImages] = useState([])

  const loadImages = async () => {
    try {
      const data = await api.fetchImages()
      setImages(data.images || [])
    } catch (err) {
      console.error(err)
    }
  }

  const removeImage = async (imageId) => {
    try {
      await api.removeImageFromDb(imageId)
      await loadImages()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteImage = async (imageId) => {
    try {
      await api.deleteImageCompletely(imageId)
      await loadImages()
    } catch (err) {
      console.error(err)
    }
  }

  const addTag = async (imageId, tagId) => {
    try {
      await api.addTagToImage(imageId, tagId)
      await loadImages()
    } catch (err) {
      console.error(err)
    }
  }

  const removeTag = async (imageId, tagId) => {
    try {
      await api.removeTagFromImage(imageId, tagId)
      await loadImages()
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadImages()
  }, [])

  return { images, loadImages, removeImage, deleteImage, addTag, removeTag }
}
