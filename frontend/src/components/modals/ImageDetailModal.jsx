import { useState } from 'react'
import { SmartTagInput } from '../common/SmartTagInput'
import '../../styles/modals.css'

const API_URL = `${window.location.origin}/api`

export function ImageDetailModal({
  image,
  tags = [],
  onClose,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onDownload,
  onRemoveFromLibrary,
  onDeleteCompletely,
  showConfirmation
}) {
  if (!image) return null

  const appliedTagIds = new Set(image.tags?.map(t => t.id) || [])
  const availableTags = tags.filter(tag => !appliedTagIds.has(tag.id))

  const handleAddTag = async (tagId) => {
    await onAddTag(image.id, tagId)
  }

  const handleCreateTag = async (tagName) => {
    await onCreateTag(tagName)
  }

  const handleRemoveTag = (tagId) => {
    onRemoveTag(tagId)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{image.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Image Preview (FrameReady) */}
        <div className="detail-modal-preview">
          <img 
            src={`${API_URL}/images/${image.id}/frameready`} 
            alt={image.name}
            onError={(e) => {
              // Fallback to original if frameready doesn't exist
              e.target.src = `${API_URL}/images/${image.id}/preview`
            }}
          />
        </div>

        {/* Content Wrapper */}
        <div className="detail-modal-content">
          {/* Image Info */}
          <div className="detail-modal-info">
            <div className="detail-property">
              <span className="detail-label">Size</span>
              <span className="detail-value">{(image.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div className="detail-property">
              <span className="detail-label">Added</span>
              <span className="detail-value">{new Date(image.date_added).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Tags Section */}
          <div className="detail-modal-tags">
            <h3>Tags ({image.tags?.length || 0})</h3>
            
            {image.tags && image.tags.length > 0 ? (
              <div className="detail-tags-list">
                {image.tags.map(tag => (
                  <div key={tag.id} className="detail-tag-item">
                    <span>{tag.name}</span>
                    <button 
                      className="detail-tag-remove"
                      onClick={() => handleRemoveTag(tag.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No tags yet</p>
            )}

            {/* Smart Tag Input */}
            <div className="detail-tag-input-section">
              <SmartTagInput
                tags={availableTags}
                placeholder="Add tags..."
                onTagSelect={handleAddTag}
                onTagCreate={handleCreateTag}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={() => onDownload(image.id, image.name)}
          >
            ↓ Download
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              showConfirmation(
                'Remove from library (keep file)?',
                () => onRemoveFromLibrary(image.id),
                false
              )
              onClose()
            }}
          >
            Remove
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              showConfirmation(
                'Delete completely (remove file)?',
                () => onDeleteCompletely(image.id),
                true
              )
              onClose()
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
