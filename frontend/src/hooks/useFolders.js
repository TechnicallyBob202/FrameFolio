import { useState, useEffect } from 'react'
import * as api from '../services/api'

export function useFolders() {
  const [folders, setFolders] = useState([])
  const [isScanning, setIsScanning] = useState(false)

  const loadFolders = async () => {
    try {
      const data = await api.fetchFolders()
      setFolders(data.folders || [])
    } catch (err) {
      console.error(err)
    }
  }

  const removeFolder = async (folderId) => {
    try {
      await api.removeFolder(folderId)
      await loadFolders()
    } catch (err) {
      console.error(err)
    }
  }

  const rescan = async () => {
    setIsScanning(true)
    try {
      return await api.rescanLibrary()
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    loadFolders()
  }, [])

  return { folders, isScanning, loadFolders, removeFolder, rescan }
}
