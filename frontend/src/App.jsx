import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:8003/api'

function App() {
  const [images, setImages] = useState([])
  const [tags, setTags] = useState([])
  const [folders, setFolders] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [tagSearch, setTagSearch] = useState('')
  
  // Navigation state
  const [activeSection, setActiveSection] = useState('images')
  
  // Multi-select state
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [batchTagSearch, setBatchTagSearch] = useState('')
  const [viewMode, setViewMode] = useState('medium')
  
  // Folder browser modal
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [currentPath, setCurrentPath] = useState('/mnt')
  const [browsingFolders, setBrowsingFolders] = useState([])
  const [parentPath, setParentPath] = useState(null)
  const [folderLoading, setFolderLoading] = useState(false)
  
  // Tag creation modal
  const [showTagModal, setShowTagModal] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tagPreview, setTagPreview] = useState(null)

  // Load data on mount
  useEffect(() => {
    loadImages()
    loadTags()
    loadFolders()
  }, [])

  // Apply theme
  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Browse folders on modal open
  useEffect(() => {
    if (showFolderModal) {
      browseFolders(currentPath)
    }
  }, [showFolderModal])

  async function loadImages() {
    try {
      const response = await fetch(`${API_URL}/images`)
      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function loadTags() {
    try {
      const response = await fetch(`${API_URL}/tags`)
      const data = await response.json()
      setTags(data.tags || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function loadFolders() {
    try {
      const response = await fetch(`${API_URL}/folders`)
      const data = await response.json()
      setFolders(data.folders || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function browseFolders(path) {
    setFolderLoading(true)
    try {
      const response = await fetch(`${API_URL}/browse-folders?path=${encodeURIComponent(path)}`)
      const data = await response.json()
      if (!data.error) {
        setCurrentPath(data.current_path)
        setBrowsingFolders(data.folders || [])
        setParentPath(data.parent_path)
      }
    } catch (err) {
      console.error(err)
    }
    setFolderLoading(false)
  }

  async function selectFolder(path) {
    try {
      const response = await fetch(
        `${API_URL}/folders/add?path=${encodeURIComponent(path)}`,
        { method: 'POST' }
      )
      const data = await response.json()
      if (!data.error) {
        await loadFolders()
        setShowFolderModal(false)
        await loadImages()
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function removeFolder(folderId) {
    if (!window.confirm('Remove folder and all associated images?')) return
    try {
      const response = await fetch(`${API_URL}/folders/${folderId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!data.error) {
        await loadFolders()
        await loadImages()
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function addTagToImage(tagId) {
    if (!selectedImage) return
    try {
      const response = await fetch(
        `${API_URL}/images/tag?image_path=${encodeURIComponent(selectedImage.path)}&tag_id=${tagId}`,
        { method: 'POST' }
      )
      const data = await response.json()
      if (!data.error) {
        const tagToAdd = tags.find(t => t.id === tagId)
        if (tagToAdd) {
          setSelectedImage({
            ...selectedImage,
            tags: [...selectedImage.tags, tagToAdd]
          })
        }
        await loadImages()
      }
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  async function removeTagFromImage(tagId) {
    if (!selectedImage) return
    try {
      await fetch(
        `${API_URL}/images/tag?image_path=${encodeURIComponent(selectedImage.path)}&tag_id=${tagId}`,
        { method: 'DELETE' }
      )
      setSelectedImage({
        ...selectedImage,
        tags: selectedImage.tags.filter(t => t.id !== tagId)
      })
      await loadImages()
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  async function createTag(name) {
    try {
      const response = await fetch(
        `${API_URL}/tags?name=${encodeURIComponent(name.trim())}`,
        { method: 'POST' }
      )
      const data = await response.json()
      if (!data.error) {
        const tagsResponse = await fetch(`${API_URL}/tags`)
        const tagsData = await tagsResponse.json()
        const newTags = tagsData.tags || []
        setTags(newTags)
        
        if (selectedImage) {
          const newTag = newTags.find(t => t.name.toLowerCase() === name.trim().toLowerCase())
          if (newTag) {
            await addTagToImage(newTag.id)
          }
        }
        setTagSearch('')
      }
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  async function addTagAndClear(tagId) {
    await addTagToImage(tagId)
    setTagSearch('')
  }

  async function handleCreateTags() {
    if (!tagInput.trim()) return
    const newTagNames = tagInput.split(',').map(t => t.trim()).filter(t => t)
    if (newTagNames.length === 0) return
    setTagPreview(newTagNames)
  }

  async function confirmCreateTags() {
    if (!tagPreview) return
    try {
      for (const name of tagPreview) {
        await fetch(`${API_URL}/tags?name=${encodeURIComponent(name)}`, { method: 'POST' })
      }
      await loadTags()
      setTagInput('')
      setTagPreview(null)
      setShowTagModal(false)
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  async function deleteTag(tagId) {
    if (!window.confirm('Delete this tag?')) return
    try {
      await fetch(`${API_URL}/tags/${tagId}`, { method: 'DELETE' })
      await loadTags()
      await loadImages()
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  // Multi-select functions
  function toggleSelectImage(imagePath) {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imagePath)) {
      newSelected.delete(imagePath)
    } else {
      newSelected.add(imagePath)
    }
    setSelectedImages(newSelected)
  }

  function selectAllImages() {
    setSelectedImages(new Set(filteredImages.map(img => img.path)))
  }

  function clearSelection() {
    setSelectedImages(new Set())
  }

  async function addTagToSelected(tagId) {
    try {
      for (const imagePath of selectedImages) {
        await fetch(
          `${API_URL}/images/tag?image_path=${encodeURIComponent(imagePath)}&tag_id=${tagId}`,
          { method: 'POST' }
        )
      }
      await loadImages()
      setBatchTagSearch('')
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  async function removeTagFromSelected(tagId) {
    try {
      for (const imagePath of selectedImages) {
        await fetch(
          `${API_URL}/images/tag?image_path=${encodeURIComponent(imagePath)}&tag_id=${tagId}`,
          { method: 'DELETE' }
        )
      }
      await loadImages()
    } catch (err) {
      console.error('Error:', err.message)
    }
  }

  // Search and filter
  const filteredImages = images.filter(img => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const matchesFilename = img.name.toLowerCase().includes(query)
    const matchesTags = img.tags.some(tag => tag.name.toLowerCase().includes(query))
    return matchesFilename || matchesTags
  })

  // Get common tags across all selected images
  function getCommonTags() {
    if (selectedImages.size === 0) return []
    
    const selectedImageList = Array.from(selectedImages).map(path => 
      images.find(img => img.path === path)
    ).filter(img => img)
    
    if (selectedImageList.length === 0) return []
    
    const firstImageTags = new Set(selectedImageList[0].tags.map(t => t.id))
    
    const commonTagIds = Array.from(firstImageTags).filter(tagId => 
      selectedImageList.every(img => img.tags.some(t => t.id === tagId))
    )
    
    return tags.filter(tag => commonTagIds.includes(tag.id))
  }

  // Filter logic for tag search
  const availableTags = tags.filter(tag => !selectedImage?.tags.some(t => t.id === tag.id))
  const batchSearchQuery = batchTagSearch.toLowerCase().trim()
  const batchFilteredTags = batchSearchQuery 
    ? tags.filter(tag => tag.name.toLowerCase().includes(batchSearchQuery))
    : []
  const batchTagExists = tags.some(tag => tag.name.toLowerCase() === batchSearchQuery)
  const batchCanCreateTag = batchSearchQuery.length > 0 && !batchTagExists

  const commonTags = getCommonTags()

  return (
    <div className="app" data-theme={theme}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🎬 FrameFolio</h1>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'images' ? 'active' : ''}`}
            onClick={() => setActiveSection('images')}
          >
            📷 Images
          </button>
          <button
            className={`nav-item ${activeSection === 'library' ? 'active' : ''}`}
            onClick={() => setActiveSection('library')}
          >
            📁 Library
          </button>
          <button
            className={`nav-item ${activeSection === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveSection('tags')}
          >
            🏷️ Manage Tags
          </button>
          <button
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Images Section */}
        {activeSection === 'images' && (
          <section className="content-section">
            {/* Stats */}
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-label">Total Images</span>
                <span className="stat-value">{images.length}</span>
              </div>
            </div>

            {/* Search & Controls */}
            <div className="images-controls">
              <input
                type="text"
                placeholder="Search by filename or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              
              {selectedImages.size > 0 && (
                <div className="selection-info">
                  <span>{selectedImages.size} selected</span>
                  <button className="btn-secondary" onClick={clearSelection}>
                    Clear
                  </button>
                </div>
              )}
              
              {filteredImages.length > 0 && (
                <button className="btn-secondary" onClick={selectAllImages}>
                  Select All
                </button>
              )}
            </div>

            {/* View Mode Selector */}
            <div className="view-mode-selector">
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                ☰
              </button>
              <button
                className={`view-btn ${viewMode === 'small' ? 'active' : ''}`}
                onClick={() => setViewMode('small')}
                title="Small thumbnails"
              >
                ⊞⊞⊞
              </button>
              <button
                className={`view-btn ${viewMode === 'medium' ? 'active' : ''}`}
                onClick={() => setViewMode('medium')}
                title="Medium thumbnails"
              >
                ⊞⊞
              </button>
              <button
                className={`view-btn ${viewMode === 'large' ? 'active' : ''}`}
                onClick={() => setViewMode('large')}
                title="Large thumbnails"
              >
                ⊞
              </button>
            </div>

            {/* Batch Tag Bar */}
            {selectedImages.size > 0 && (
              <div className="batch-tag-section">
                {/* Common Tags (for removal) */}
                {commonTags.length > 0 && (
                  <div className="common-tags-bar">
                    <span className="common-tags-label">Applied to all:</span>
                    <div className="common-tags-list">
                      {commonTags.map(tag => (
                        <button
                          key={tag.id}
                          className="common-tag-badge"
                          onClick={() => removeTagFromSelected(tag.id)}
                          title="Click to remove from all selected"
                        >
                          {tag.name} <span className="remove-x">✕</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Tags */}
                <div className="batch-tag-bar">
                  <input
                    type="text"
                    placeholder="Search tags to apply..."
                    value={batchTagSearch}
                    onChange={(e) => setBatchTagSearch(e.target.value)}
                    className="batch-tag-input"
                  />
                  
                  {batchTagSearch && (
                    <div className="batch-tag-options">
                      {batchFilteredTags.length > 0 && (
                        <div>
                          {batchFilteredTags.map(tag => (
                            <button
                              key={tag.id}
                              className="batch-tag-option"
                              onClick={() => addTagToSelected(tag.id)}
                            >
                              + {tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {batchCanCreateTag && (
                        <button
                          className="batch-tag-create"
                          onClick={() => createTag(batchTagSearch)}
                        >
                          + Create "{batchTagSearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Images Grid/List */}
            <div className={`images-grid-with-select view-${viewMode}`}>
              {filteredImages.map((img) => (
                <div 
                  key={img.path}
                  className={`image-card-wrapper ${selectedImages.has(img.path) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="image-checkbox"
                    checked={selectedImages.has(img.path)}
                    onChange={() => toggleSelectImage(img.path)}
                  />
                  <div 
                    className={`image-card ${selectedImage?.path === img.path ? 'selected' : ''}`}
                    onClick={() => setSelectedImage(img)}
                  >
                    <p>{img.name}</p>
                    {img.tags.length > 0 && (
                      <div className="image-tags">
                        {img.tags.map(t => <span key={t.id}>#{t.name}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filteredImages.length === 0 && (
              <div className="empty-state">
                {searchQuery ? 'No images match your search.' : 'No images found. Add folders in Library to get started.'}
              </div>
            )}
          </section>
        )}

        {/* Library Section */}
        {activeSection === 'library' && (
          <section className="content-section">
            <h2>Library</h2>
            <button className="btn-primary" onClick={() => setShowFolderModal(true)}>
              + Add Folder
            </button>
            
            <div className="folders-list">
              {folders.length === 0 ? (
                <p className="empty-state">No folders configured yet</p>
              ) : (
                folders.map((folder) => (
                  <div key={folder.id} className="folder-item">
                    <div className="folder-path">{folder.path}</div>
                    <button
                      className="btn-danger"
                      onClick={() => removeFolder(folder.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Manage Tags Section */}
        {activeSection === 'tags' && (
          <section className="content-section">
            <h2>Manage Tags</h2>
            <button className="btn-primary" onClick={() => setShowTagModal(true)}>
              + Add Tags
            </button>
            
            <div className="tags-list">
              {tags.length === 0 ? (
                <p className="empty-state">No tags yet</p>
              ) : (
                tags.map((tag) => (
                  <div key={tag.id} className="tag-item">
                    <span>{tag.name}</span>
                    <button
                      className="btn-danger"
                      onClick={() => deleteTag(tag.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Settings Section */}
        {activeSection === 'settings' && (
          <section className="content-section">
            <h2>Settings</h2>
            
            <div className="settings-group">
              <h3>Appearance</h3>
              <div className="theme-options">
                <label>
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === 'light'}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                  ☀️ Light
                </label>
                <label>
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                  🌙 Dark
                </label>
                <label>
                  <input
                    type="radio"
                    name="theme"
                    value="auto"
                    checked={theme === 'auto'}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                  ⚙️ Auto (System)
                </label>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Details Panel */}
      {selectedImage && (
        <aside className="details-panel">
          <div className="details-header">
            <h3>{selectedImage.name}</h3>
            <button onClick={() => setSelectedImage(null)}>✕</button>
          </div>
          
          <div className="details-content">
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search or create tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
              
              {tagSearch && (
                <div style={{ marginTop: '12px' }}>
                  {availableTags.filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase())).length > 0 ? (
                    <div>
                      {availableTags.filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase())).map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => addTagAndClear(tag.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            marginBottom: '4px',
                            background: 'var(--color-accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          + #{tag.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  
                  {!tags.some(tag => tag.name.toLowerCase() === tagSearch.toLowerCase().trim()) && tagSearch.trim().length > 0 && (
                    <button
                      onClick={() => createTag(tagSearch)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        marginTop: availableTags.filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase())).length > 0 ? '4px' : '0',
                        background: '#1a6b2a',
                        color: 'white',
                        border: '1px solid #2a8a3a',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      + Create "{tagSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div>
              <strong>Tags:</strong>
              <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                {selectedImage.tags.map(tag => (
                  <span key={tag.id} style={{ display: 'inline-block', marginRight: '8px', marginBottom: '8px' }}>
                    <span style={{ background: 'var(--color-accent)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}>
                      {tag.name}
                      <button 
                        onClick={() => removeTagFromImage(tag.id)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: '4px' }}
                      >
                        ✕
                      </button>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Folder Browser Modal */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Folder</h2>
              <button className="modal-close" onClick={() => setShowFolderModal(false)}>✕</button>
            </div>
            
            <div className="modal-content">
              <div className="browser-path">
                <button 
                  className="btn-secondary"
                  onClick={() => parentPath && browseFolders(parentPath)}
                  disabled={!parentPath}
                >
                  ← Back
                </button>
                <span className="path-text">{currentPath}</span>
              </div>
              
              {folderLoading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="folders-browser">
                  {browsingFolders.length === 0 ? (
                    <p className="empty-state">No subdirectories</p>
                  ) : (
                    browsingFolders.map((folder) => (
                      <div key={folder.path} className="browser-item">
                        <span 
                          className="folder-name"
                          onClick={() => browseFolders(folder.path)}
                        >
                          📁 {folder.name}
                        </span>
                        <button
                          className="btn-success"
                          onClick={() => selectFolder(folder.path)}
                        >
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowFolderModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Creation Modal */}
      {showTagModal && !tagPreview && (
        <div className="modal-overlay" onClick={() => setShowTagModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Tags</h2>
              <button className="modal-close" onClick={() => setShowTagModal(false)}>✕</button>
            </div>
            
            <div className="modal-content">
              <label>Tag names (comma-separated):</label>
              <input
                type="text"
                placeholder="Portrait, Landscape, Monet"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)'
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                💡 Separate multiple tags with commas
              </p>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowTagModal(false); setTagInput('') }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateTags} disabled={!tagInput.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Preview Modal */}
      {tagPreview && (
        <div className="modal-overlay" onClick={() => setTagPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm</h2>
              <button className="modal-close" onClick={() => setTagPreview(null)}>✕</button>
            </div>
            
            <div className="modal-content">
              <p>Create {tagPreview.length} tag{tagPreview.length > 1 ? 's' : ''}?</p>
              <div className="tag-preview-list">
                {tagPreview.map((name, i) => (
                  <div key={i} className="tag-preview-item">
                    {name}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setTagPreview(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={confirmCreateTags}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App