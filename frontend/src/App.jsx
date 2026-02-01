import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = 'http://localhost:8003/api';

// Tag Preview Dialog
const TagPreviewDialog = ({ tags, selectedParent, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="preview-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Create Tags</h3>
        <p className="preview-subtitle">You're about to create {tags.length} tag(s):</p>
        
        {selectedParent && (
          <p className="preview-parent">Under parent: <strong>{selectedParent.name}</strong></p>
        )}
        
        <div className="tags-preview-list">
          {tags.map((tag, idx) => (
            <div key={idx} className="preview-tag">
              {selectedParent && <span className="preview-breadcrumb">{selectedParent.name} / </span>}
              {tag}
            </div>
          ))}
        </div>

        <div className="preview-buttons">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn" onClick={onConfirm}>Create Tags</button>
        </div>
      </div>
    </div>
  );
};

// Settings Drawer Component
const SettingsDrawer = ({ 
  isOpen, 
  onClose, 
  folders, 
  tags, 
  onFolderAdd, 
  onFolderRemove, 
  onTagCreate,
  onTagUpdate, 
  onTagDelete, 
  onRescan, 
  theme, 
  onThemeChange 
}) => {
  const [activeTab, setActiveTab] = useState('folders');
  const [tagInput, setTagInput] = useState('');
  const [selectedParent, setSelectedParent] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [previewTags, setPreviewTags] = useState(null);
  const [isPickingDir, setIsPickingDir] = useState(false);

  const handlePickDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Directory picker not supported in your browser. Please use Chrome, Edge, or Firefox.');
      return;
    }

    try {
      setIsPickingDir(true);
      const dirHandle = await window.showDirectoryPicker();
      const path = dirHandle.name;
      
      // Get the full path - this is a limitation of showDirectoryPicker
      // We only get the folder name, so we'll need to let user confirm
      alert(`Selected folder: ${path}\n\nNote: Full path access requires backend integration. Use browse-folders endpoint for full path.`);
      
      // For now, we'll ask user to confirm the path
      const fullPath = prompt(`Folder name: ${path}\n\nEnter full path to add:`, path);
      if (fullPath) {
        await onFolderAdd(fullPath);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Directory picker error:', error);
        alert('Error selecting directory');
      }
    } finally {
      setIsPickingDir(false);
    }
  };

  const handleAddTags = () => {
    const tagNames = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tagNames.length === 0) return;

    setPreviewTags(tagNames);
  };

  const confirmCreateTags = async () => {
    for (const tagName of previewTags) {
      await onTagCreate(tagName, selectedParent?.id);
    }
    setTagInput('');
    setSelectedParent(null);
    setPreviewTags(null);
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const handleSaveTag = async () => {
    await onTagUpdate(editingTag, editTagName, editTagColor);
    setEditingTag(null);
  };

  // Build flat list for dropdowns
  const allTags = tags.flatMap(tag => [tag, ...(tag.children || [])]);
  const topLevelTags = tags;

  const renderTagHierarchy = (tagList, depth = 0) => {
    return tagList.map((tag) => (
      <div key={tag.id} className="tag-item" style={{ paddingLeft: `${depth * 1.5}rem` }}>
        {editingTag === tag.id ? (
          <div className="tag-edit">
            <input
              type="text"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              className="tag-name-input"
            />
            <input
              type="color"
              value={editTagColor}
              onChange={(e) => setEditTagColor(e.target.value)}
              className="tag-color-input"
            />
            <button className="save-btn" onClick={handleSaveTag}>Save</button>
            <button className="cancel-btn" onClick={() => setEditingTag(null)}>Cancel</button>
          </div>
        ) : (
          <div className="tag-display">
            <span className="tag-name">{tag.name}</span>
            <div className="tag-color-preview" style={{ backgroundColor: tag.color }}></div>
            <button className="edit-btn" onClick={() => handleEditTag(tag)}>Edit</button>
            <button className="delete-btn" onClick={() => onTagDelete(tag.id)}>Delete</button>
          </div>
        )}
        {tag.children && tag.children.length > 0 && (
          <div className="tag-children">
            {renderTagHierarchy(tag.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <>
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      
      <div className={`settings-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Settings</h2>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-container">
          <div className="drawer-nav">
            <button 
              className={`nav-btn ${activeTab === 'folders' ? 'active' : ''}`}
              onClick={() => setActiveTab('folders')}
            >
              📁 Folders
            </button>
            <button 
              className={`nav-btn ${activeTab === 'theme' ? 'active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              🎨 Theme
            </button>
            <button 
              className={`nav-btn ${activeTab === 'tags' ? 'active' : ''}`}
              onClick={() => setActiveTab('tags')}
            >
              🏷️ Tags
            </button>
          </div>

          <div className="drawer-content">
            {activeTab === 'folders' && (
              <div className="drawer-section">
                <h3>Scan Folders</h3>
                
                <button 
                  className="add-folder-browser-btn" 
                  onClick={handlePickDirectory}
                  disabled={isPickingDir}
                >
                  {isPickingDir ? '⏳ Selecting...' : '📂 Pick Folder'}
                </button>

                <div className="folders-list">
                  {folders.length === 0 ? (
                    <p className="empty-state">No folders configured yet</p>
                  ) : (
                    folders.map((folder) => (
                      <div key={folder.id} className="folder-item">
                        <div className="folder-path">{folder.path}</div>
                        <button
                          className="remove-folder-btn"
                          onClick={() => {
                            if (window.confirm(`Remove folder and all associated images?\n\n${folder.path}`)) {
                              onFolderRemove(folder.id);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button className="rescan-all-btn" onClick={onRescan}>
                  🔄 Rescan All Folders
                </button>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="drawer-section">
                <h3>Appearance</h3>
                <div className="theme-options">
                  <label className="theme-option">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={theme === 'light'}
                      onChange={(e) => onThemeChange(e.target.value)}
                    />
                    ☀️ Light
                  </label>
                  <label className="theme-option">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={theme === 'dark'}
                      onChange={(e) => onThemeChange(e.target.value)}
                    />
                    🌙 Dark
                  </label>
                  <label className="theme-option">
                    <input
                      type="radio"
                      name="theme"
                      value="auto"
                      checked={theme === 'auto'}
                      onChange={(e) => onThemeChange(e.target.value)}
                    />
                    ⚙️ Auto (System)
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="drawer-section">
                <h3>Manage Tags</h3>
                
                <div className="tag-creation">
                  <input
                    type="text"
                    placeholder="Create tags: Portrait, Landscape, Monet"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="tag-input"
                  />
                  
                  <div className="parent-select-wrapper">
                    <label>Parent tag (optional):</label>
                    <select 
                      value={selectedParent?.id || ''}
                      onChange={(e) => {
                        const tag = topLevelTags.find(t => t.id === parseInt(e.target.value));
                        setSelectedParent(tag || null);
                      }}
                      className="parent-select"
                    >
                      <option value="">None (Top-level)</option>
                      {topLevelTags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  </div>

                  <p className="tag-help-text">💡 Separate multiple tags with commas</p>
                  <button 
                    className="create-tags-btn" 
                    onClick={handleAddTags} 
                    disabled={!tagInput.trim()}
                  >
                    + Add Tags
                  </button>
                </div>

                <div className="tags-list">
                  {tags.length === 0 ? (
                    <p className="empty-state">No tags yet</p>
                  ) : (
                    renderTagHierarchy(tags)
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewTags && (
        <TagPreviewDialog 
          tags={previewTags}
          selectedParent={selectedParent}
          onConfirm={confirmCreateTags}
          onCancel={() => setPreviewTags(null)}
        />
      )}
    </>
  );
};

// Image Grid Component
const ImageGrid = ({ images, selectedImages, onSelect, onImageClick }) => {
  return (
    <div className="image-grid">
      {images.map((image) => (
        <div
          key={image.id}
          className={`image-card ${selectedImages.includes(image.id) ? 'selected' : ''}`}
          onClick={() => onImageClick(image)}
        >
          <div className="image-wrapper">
            <img src={`${API_URL}/../uploads/${image.filename}`} alt={image.original_filename} />
            <div className="overlay">
              <input
                type="checkbox"
                checked={selectedImages.includes(image.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(image.id);
                }}
              />
            </div>
          </div>
          <div className="image-info">
            <p className="filename">{image.original_filename}</p>
            <div className="tags-preview">
              {image.tags.slice(0, 2).map((tag) => (
                <span key={tag.id} className="tag-badge" style={{ backgroundColor: tag.color }}>
                  {tag.name}
                </span>
              ))}
              {image.tags.length > 2 && (
                <span className="tag-badge more">+{image.tags.length - 2}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Tag Filter Component
const TagFilter = ({ tags, selectedTags, onTagToggle }) => {
  const renderTagTree = (tagList, depth = 0) => {
    return tagList.map((tag) => (
      <div key={tag.id} style={{ paddingLeft: `${depth * 1}rem` }}>
        <button
          className={`filter-tag ${selectedTags.includes(tag.id) ? 'active' : ''}`}
          style={{
            borderColor: tag.color,
            backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
          }}
          onClick={() => onTagToggle(tag.id)}
        >
          {tag.name}
        </button>
        {tag.children && tag.children.length > 0 && (
          <div>{renderTagTree(tag.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="tag-filter">
      <h3>Filter by Tags</h3>
      <div className="tag-list">
        {tags.length === 0 ? (
          <p className="no-tags">No tags yet</p>
        ) : (
          renderTagTree(tags)
        )}
      </div>
    </div>
  );
};

// Batch Tagger Component
const BatchTagger = ({ tags, onApply, selectedCount, selectedImages }) => {
  const [selectedTag, setSelectedTag] = useState(null);
  const [action, setAction] = useState('add');

  // Flatten tags for dropdown
  const flatTags = tags.flatMap(tag => {
    const result = [tag];
    if (tag.children) {
      result.push(...tag.children);
    }
    return result;
  });

  const handleApply = async () => {
    if (!selectedTag) return;

    try {
      const endpoint = action === 'add' 
        ? `${API_URL}/batch/tag`
        : `${API_URL}/batch/untag`;

      const response = await fetch(endpoint, {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_ids: selectedImages,
          tag_id: selectedTag,
        }),
      });

      if (response.ok) {
        onApply();
        setSelectedTag(null);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="batch-tagger">
      <p className="batch-count">{selectedCount} images selected</p>
      <div className="batch-controls">
        <select
          value={selectedTag || ''}
          onChange={(e) => setSelectedTag(parseInt(e.target.value))}
          className="tag-select"
        >
          <option value="">Select a tag...</option>
          {flatTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>

        <div className="action-buttons">
          <button
            className={`action-btn ${action === 'add' ? 'active' : ''}`}
            onClick={() => setAction('add')}
          >
            Add
          </button>
          <button
            className={`action-btn ${action === 'remove' ? 'active' : ''}`}
            onClick={() => setAction('remove')}
          >
            Remove
          </button>
        </div>

        <button className="apply-btn" onClick={handleApply} disabled={!selectedTag}>
          Apply to {selectedCount}
        </button>
      </div>
    </div>
  );
};

// Image Detail Modal
const ImageModal = ({ image, tags, onClose, onTagToggle, onDownload }) => {
  if (!image) return null;

  const flatTags = tags.flatMap(tag => {
    const result = [tag];
    if (tag.children) {
      result.push(...tag.children);
    }
    return result;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-body">
          <div className="modal-image">
            <img src={`${API_URL}/../uploads/${image.filename}`} alt={image.original_filename} />
          </div>

          <div className="modal-info">
            <h2>{image.original_filename}</h2>
            <p className="info-text">
              {new Date(image.created_at).toLocaleDateString()}
            </p>

            <div className="modal-tags">
              <h3>Tags</h3>
              <div className="tags-grid">
                {flatTags.map((tag) => {
                  const isTagged = image.tags.some((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      className={`tag-toggle ${isTagged ? 'tagged' : ''}`}
                      style={{
                        backgroundColor: isTagged ? tag.color : 'transparent',
                        borderColor: tag.color,
                        color: isTagged ? 'white' : tag.color,
                      }}
                      onClick={() => onTagToggle(image.id, tag.id, isTagged)}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="download-btn" onClick={() => onDownload(image.id)}>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedModal, setSelectedModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('frametagger-theme') || 'auto');

  // Apply theme
  useEffect(() => {
    let appliedTheme = theme;
    if (theme === 'auto') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', appliedTheme);
    localStorage.setItem('frametagger-theme', theme);
  }, [theme]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tagIds = selectedTags.length > 0 ? selectedTags.join(',') : undefined;
      const params = new URLSearchParams();
      if (tagIds) params.append('tag_ids', tagIds);

      const [imagesRes, tagsRes, foldersRes] = await Promise.all([
        fetch(`${API_URL}/images?${params}`),
        fetch(`${API_URL}/tags`),
        fetch(`${API_URL}/folders`),
      ]);

      const imagesData = await imagesRes.json();
      const tagsData = await tagsRes.json();
      const foldersData = await foldersRes.json();

      setImages(imagesData);
      setTags(tagsData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  }, [selectedTags]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectImage = (imageId) => {
    setSelectedImages((prev) =>
      prev.includes(imageId)
        ? prev.filter((id) => id !== imageId)
        : [...prev, imageId]
    );
  };

  const handleTagToggle = async (imageId, tagId, isTagged) => {
    try {
      const endpoint = isTagged
        ? `${API_URL}/images/${imageId}/tags/${tagId}`
        : `${API_URL}/images/${imageId}/tags`;

      const response = await fetch(endpoint, {
        method: isTagged ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(isTagged ? {} : { body: JSON.stringify({ tag_id: tagId }) }),
      });

      if (response.ok) {
        fetchData();
        if (selectedModal) {
          const updatedImage = images.find((img) => img.id === imageId);
          if (updatedImage) setSelectedModal(updatedImage);
        }
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
    }
  };

  const handleDownload = async (imageId) => {
    try {
      const response = await fetch(`${API_URL}/images/${imageId}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = images.find((img) => img.id === imageId)?.original_filename || 'download';
      a.click();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleAddFolder = async (path) => {
    try {
      const response = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (response.ok) {
        fetchData();
        return true;
      } else {
        const data = await response.json();
        alert(`Error: ${data.detail}`);
      }
    } catch (error) {
      console.error('Failed to add folder:', error);
    }
    return false;
  };

  const handleRemoveFolder = async (folderId) => {
    try {
      const response = await fetch(`${API_URL}/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to remove folder:', error);
    }
  };

  const handleCreateTag = async (tagName, parentId) => {
    try {
      const response = await fetch(`${API_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName, color: '#6366f1', parent_id: parentId }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleUpdateTag = async (tagId, name, color) => {
    try {
      const response = await fetch(`${API_URL}/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update tag:', error);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (window.confirm('Delete this tag and all its children?')) {
      try {
        const response = await fetch(`${API_URL}/tags/${tagId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          fetchData();
        }
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  const handleRescan = async () => {
    try {
      const response = await fetch(`${API_URL}/rescan`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Found and registered ${data.added} new image files`);
        fetchData();
      }
    } catch (error) {
      console.error('Rescan failed:', error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <button className="hamburger" onClick={() => setDrawerOpen(true)}>☰</button>
        <div className="header-content">
          <h1>FrameTagger</h1>
          <p className="subtitle">Curate your collection with precision</p>
        </div>
      </header>

      <div className="container">
        <aside className="sidebar">
          <TagFilter
            tags={tags}
            selectedTags={selectedTags}
            onTagToggle={(tagId) =>
              setSelectedTags((prev) =>
                prev.includes(tagId)
                  ? prev.filter((id) => id !== tagId)
                  : [...prev, tagId]
              )
            }
          />
        </aside>

        <main className="main">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <ImageGrid
                images={images}
                selectedImages={selectedImages}
                onSelect={handleSelectImage}
                onImageClick={setSelectedModal}
              />
              {images.length === 0 && (
                <div className="empty-state">
                  <p>No images yet. Add folders in Settings (☰) to get started!</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <BatchTagger
        tags={tags}
        selectedImages={selectedImages}
        selectedCount={selectedImages.length}
        onApply={() => {
          setSelectedImages([]);
          fetchData();
        }}
      />

      <SettingsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        folders={folders}
        tags={tags}
        onFolderAdd={handleAddFolder}
        onFolderRemove={handleRemoveFolder}
        onTagCreate={handleCreateTag}
        onTagUpdate={handleUpdateTag}
        onTagDelete={handleDeleteTag}
        onRescan={handleRescan}
        theme={theme}
        onThemeChange={setTheme}
      />

      <ImageModal
        image={selectedModal}
        tags={tags}
        onClose={() => setSelectedModal(null)}
        onTagToggle={handleTagToggle}
        onDownload={handleDownload}
      />
    </div>
  );
}
