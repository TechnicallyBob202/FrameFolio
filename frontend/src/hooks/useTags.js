import { useState, useEffect } from 'react'
import * as api from '../services/api'

export function useTags() {
  const [tags, setTags] = useState([])

  const loadTags = async () => {
    try {
      const data = await api.fetchTags()
      setTags(data.tags || [])
    } catch (err) {
      console.error(err)
    }
  }

  const create = async (name) => {
    try {
      const response = await api.createTag(name)
      if (!response.error) {
        await loadTags()
        return true
      }
    } catch (err) {
      console.error(err)
    }
    return false
  }

  const delete_ = async (tagId) => {
    try {
      await api.deleteTag(tagId)
      await loadTags()
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadTags()
  }, [])

  return { tags, loadTags, create, delete: delete_ }
}
