import { useState, useEffect } from 'react'

export function UploadProgressModal({ jobId, onComplete, onError }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!jobId) return
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${window.location.origin}/api/images/upload/${jobId}/status`)
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
    }, 300)
    return () => clearInterval(pollInterval)
  }, [jobId, onComplete, onError])

  if (!status) return null
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Uploading...</h2></div>
        <div className="modal-content">
          {error ? (
            <div style={{ color: 'var(--error-color)', padding: '10px' }}>
              <strong>Error:</strong> {error}
            </div>
          ) : (
            <>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${status.progress}%` }} />
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
