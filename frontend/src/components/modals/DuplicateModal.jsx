export function DuplicateModal({ result, jobId, onAction }) {
  async function handleAction(action) {
    try {
      const response = await fetch(
        `${window.location.origin}/api/images/upload/${jobId}/duplicate-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: result.filename, action })
        }
      )
      const data = await response.json()
      if (!data.error) onAction(action)
    } catch (err) {
      console.error('Duplicate action failed:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onAction('skip')}>
      <div className="modal duplicate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>File Already Exists</h2></div>
        <div className="modal-content">
          <p><strong>{result.filename}</strong> appears to be a duplicate.</p>
          <div className="duplicate-comparison">
            <div className="comparison-column">
              <h4>Existing File</h4>
              {result.duplicate.thumbnail && <img src={result.duplicate.thumbnail} alt="Existing" style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '10px' }} />}
              <div className="file-details">
                <p><strong>Name:</strong> {result.duplicate.info.name}</p>
                <p><strong>Size:</strong> {result.duplicate.info.size_mb} MB</p>
                <p><strong>Dimensions:</strong> {result.duplicate.info.width}×{result.duplicate.info.height}</p>
              </div>
            </div>
            <div className="comparison-column">
              <h4>Incoming File</h4>
              {result.incoming.thumbnail && <img src={result.incoming.thumbnail} alt="Incoming" style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '10px' }} />}
              <div className="file-details">
                <p><strong>Name:</strong> {result.incoming.info.name}</p>
                <p><strong>Size:</strong> {result.incoming.info.size_mb} MB</p>
                <p><strong>Dimensions:</strong> {result.incoming.info.width}×{result.incoming.info.height}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer duplicate-actions">
          <button className="btn-secondary" onClick={() => handleAction('skip')}>Skip This File</button>
          <button className="btn-warning" onClick={() => handleAction('overwrite')}>Overwrite Existing</button>
          <button className="btn-primary" onClick={() => handleAction('import_anyway')}>Import as New</button>
        </div>
      </div>
    </div>
  )
}
