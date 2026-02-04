import { useState, useEffect } from 'react'

const API_URL = `${window.location.origin}/api`

/**
 * Progress Modal - Shows upload progress with detailed step messages
 */
export function UploadProgressModal({ jobId, onComplete, onError }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!jobId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/images/upload/${jobId}/status`)
        const data = await response.json()
        setStatus(data)

        if (data.status === 'error') {
          setError(data.errors?.[0] || 'Upload failed')
          clearInterval(pollInterval)
          onError(data.errors)
        } else if (data.status === 'complete') {
          clearInterval(pollInterval)
          onComplete(data)
        }
      } catch (err) {
        setError(err.message)
        clearInterval(pollInterval)
      }
    }, 300) // Poll every 300ms

    return () => clearInterval(pollInterval)
  }, [jobId, onComplete, onError])

  if (!status) return null

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Uploading...</h2>
        </div>

        <div className="modal-content">
          {error ? (
            <div style={{ color: 'var(--error-color)', padding: '10px' }}>
              <strong>Error:</strong> {error}
            </div>
          ) : (
            <>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <p style={{ textAlign: 'center', marginTop: '10px' }}>
                {status.progress}% ({status.results?.length || 0} of {status.total_files})
              </p>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
                {status.current_step}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Duplicate Detection Modal - Shows comparison and options
 */
export function DuplicateModal({ result, jobId, onAction, onSkip }) {
  const [selectedAction, setSelectedAction] = useState(null)

  async function handleAction(action) {
    setSelectedAction(action)
    try {
      const response = await fetch(
        `${API_URL}/images/upload/${jobId}/duplicate-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: result.filename,
            action: action
          })
        }
      )
      const data = await response.json()
      if (!data.error) {
        onAction(action)
      }
    } catch (err) {
      console.error('Duplicate action failed:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onSkip}>
      <div className="modal duplicate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>File Already Exists</h2>
        </div>

        <div className="modal-content">
          <p>
            <strong>{result.filename}</strong> appears to be a duplicate.
          </p>

          <div className="duplicate-comparison">
            <div className="comparison-column">
              <h4>Existing File</h4>
              {result.duplicate.thumbnail && (
                <img
                  src={result.duplicate.thumbnail}
                  alt="Existing"
                  style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '10px' }}
                />
              )}
              <div className="file-details">
                <p><strong>Name:</strong> {result.duplicate.info.name}</p>
                <p><strong>Size:</strong> {result.duplicate.info.size_mb} MB</p>
                <p>
                  <strong>Dimensions:</strong> {result.duplicate.info.width}×
                  {result.duplicate.info.height}
                </p>
              </div>
            </div>

            <div className="comparison-column">
              <h4>Incoming File</h4>
              {result.incoming.thumbnail && (
                <img
                  src={result.incoming.thumbnail}
                  alt="Incoming"
                  style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '10px' }}
                />
              )}
              <div className="file-details">
                <p><strong>Name:</strong> {result.incoming.info.name}</p>
                <p><strong>Size:</strong> {result.incoming.info.size_mb} MB</p>
                <p>
                  <strong>Dimensions:</strong> {result.incoming.info.width}×
                  {result.incoming.info.height}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer duplicate-actions">
          <button
            className="btn-secondary"
            onClick={() => handleAction('skip')}
            disabled={selectedAction}
          >
            Skip This File
          </button>
          <button
            className="btn-warning"
            onClick={() => handleAction('overwrite')}
            disabled={selectedAction}
          >
            Overwrite Existing
          </button>
          <button
            className="btn-primary"
            onClick={() => handleAction('import_anyway')}
            disabled={selectedAction}
          >
            Import as New
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Crop Positioning Modal - For images not close to 16:9
 */
export function CropPositioningModal({ result, jobId, onComplete }) {
  const [cropBox, setCropBox] = useState({
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const containerRef = React.useRef(null)
  const aspectInfo = result.aspect_info

  // Calculate display aspect (what the user sees)
  const displayAspect = aspectInfo.width / aspectInfo.height

  // Target aspect (16:9)
  const targetAspect = 3840 / 2160

  // Calculate preview dimensions to fit in container
  const maxWidth = 400
  const maxHeight = 400
  let previewWidth, previewHeight

  if (displayAspect > maxWidth / maxHeight) {
    previewWidth = maxWidth
    previewHeight = maxWidth / displayAspect
  } else {
    previewHeight = maxHeight
    previewWidth = maxHeight * displayAspect
  }

  function handleMouseDown(e) {
    if (!containerRef.current) return
    setIsDragging(true)
    const rect = containerRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  function handleMouseMove(e) {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    // Convert pixel movements to normalized coords
    const deltaX = (currentX - dragOffset.x) / previewWidth
    const deltaY = (currentY - dragOffset.y) / previewHeight

    setCropBox(prev => {
      let newBox = {
        ...prev,
        x: Math.max(0, Math.min(1 - prev.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(1 - prev.height, prev.y + deltaY))
      }
      return newBox
    })

    setDragOffset({
      x: currentX,
      y: currentY
    })
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset, previewWidth, previewHeight])

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      const response = await fetch(
        `${API_URL}/images/upload/${jobId}/position`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: result.filename,
            crop_box: cropBox
          })
        }
      )
      const data = await response.json()
      if (!data.error) {
        onComplete(data)
      }
    } catch (err) {
      console.error('Positioning failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal positioning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Position Image for Frame TV</h2>
        </div>

        <div className="modal-content positioning-content">
          <p>
            This image's aspect ratio ({aspectInfo.aspect.toFixed(2)}:1) isn't close to
            16:9 (1.78:1). Drag the preview to position what you want visible.
          </p>

          <div className="positioning-info">
            <p>
              Original: {aspectInfo.width}×{aspectInfo.height}
            </p>
            <p>
              Will be: 3840×2160 (4K Frame TV)
            </p>
          </div>

          <div
            ref={containerRef}
            className="crop-preview-container"
            onMouseDown={handleMouseDown}
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              position: 'relative',
              margin: '20px auto',
              cursor: isDragging ? 'grabbing' : 'grab',
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)'
            }}
          >
            <img
              src={result.thumbnail}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                userSelect: 'none',
              }}
            />

            {/* Crop overlay showing what will be visible */}
            <div
              style={{
                position: 'absolute',
                left: `${cropBox.x * 100}%`,
                top: `${cropBox.y * 100}%`,
                width: `${cropBox.width * 100}%`,
                height: `${cropBox.height * 100}%`,
                border: '2px solid rgba(255, 215, 0, 0.8)',
                boxSizing: 'border-box',
                pointerEvents: 'none'
              }}
            />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Drag the preview to adjust which part is visible. The yellow border shows the final crop.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => {}} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add this CSS to your App.css
const UPLOAD_STYLES = `
  .progress-bar-container {
    width: 100%;
    height: 20px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    margin: 10px 0;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #45a049);
    transition: width 0.3s ease;
  }

  .duplicate-modal {
    max-width: 700px;
  }

  .duplicate-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 20px 0;
  }

  .comparison-column h4 {
    margin: 0 0 10px 0;
    color: var(--text-primary);
  }

  .file-details {
    font-size: 12px;
    color: var(--text-muted);
  }

  .file-details p {
    margin: 4px 0;
  }

  .duplicate-actions {
    display: flex;
    gap: 10px;
  }

  .duplicate-actions button {
    flex: 1;
  }

  .positioning-modal {
    max-width: 600px;
  }

  .positioning-content {
    text-align: center;
  }

  .positioning-info {
    background: var(--bg-secondary);
    padding: 10px;
    border-radius: 4px;
    margin: 15px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .crop-preview-container {
    user-select: none;
  }

  @media (max-width: 600px) {
    .duplicate-comparison {
      grid-template-columns: 1fr;
    }

    .crop-preview-container {
      width: 280px !important;
    }
  }
`