import '../../styles/batch-operations.css'

export function CommonTagsBar({ tags = [], onRemoveTag }) {
  if (tags.length === 0) return null

  return (
    <div className="common-tags-bar">
      <span className="common-tags-label">Applied to all:</span>
      <div className="common-tags-list">
        {tags.map(tag => (
          <button
            key={tag.id}
            className="common-tag-badge"
            onClick={() => onRemoveTag(tag.id)}
            title="Click to remove from all selected"
          >
            {tag.name} <span className="remove-x">✕</span>
          </button>
        ))}
      </div>
    </div>
  )
}
