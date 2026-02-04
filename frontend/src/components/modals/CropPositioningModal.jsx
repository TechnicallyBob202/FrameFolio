import { useState, useEffect, useRef } from 'react'

export function CropPositioningModal({ result, jobId, onComplete }) {
  const [cropBox, setCropBox] = useState({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef(null)
  const aspectInfo = result.aspect_info

  const displayAspect = aspectInfo.width / aspectInfo.height
  const maxWidth = 400, maxHeight = 400
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
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleMouseMove(e) {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    const deltaX = (currentX - dragOffset.x) / previewWidth
    const deltaY = (currentY - dragOffset.y) / previewHeight
    setCropBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(1 - prev.width, prev.x + deltaX)),
      y: Math.max(0, Math.min(1 - prev.height, prev.y + deltaY))
    }))
    setDragOffset({ x: currentX, y: currentY })
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', () => setIsDragging(false))
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', () => setIsDragging(false))
      }
    }
  }, [isDragging, dragOffset, previewWidth, previewHeight])

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      const response = await fetch(
        `${window.location.origin}/api/images/upload/${jobId}/position`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: result.filename, crop_box: cropBox }) }
      )
      const data = await response.json()
      if (!data.error) onComplete()
    } catch (err) {
      console.error('Positioning failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal positioning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Position Image for Frame TV</h2></div>
        <div className="modal-content positioning-content">
          <p>This image's aspect ratio ({aspectInfo.aspect.toFixed(2)}:1) isn't close to 16:9 (1.78:1). Drag to position.</p>
          <div className="positioning-info">
            <p>Original: {aspectInfo.width}×{aspectInfo.height}</p>
            <p>Will be: 3840×2160 (4K Frame TV)</p>
          </div>
          <div ref={containerRef} className="crop-preview-container" onMouseDown={handleMouseDown} style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, position: 'relative', margin: '20px auto', cursor: isDragging ? 'grabbing' : 'grab', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-color)' }}>
            <img src={result.thumbnail} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }} />
            <div style={{ position: 'absolute', left: `${cropBox.x * 100}%`, top: `${cropBox.y * 100}%`, width: `${cropBox.width * 100}%`, height: `${cropBox.height * 100}%`, border: '2px solid rgba(255, 215, 0, 0.8)', boxSizing: 'border-box', pointerEvents: 'none' }} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Drag to adjust visible area. Yellow border shows final crop.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" disabled={isSubmitting}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}
