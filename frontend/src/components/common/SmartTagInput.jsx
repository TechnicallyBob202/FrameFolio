import { useState } from 'react'
import '../../styles/batch-operations.css'

export function SmartTagInput({
  tags = [],
  placeholder = "Search tags or create new...",
  onTagSelect,
  onTagCreate,
  onClear
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canCreateTag = searchQuery.trim() && !filteredTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase())

  const handleSelectTag = (tagId) => {
    onTagSelect(tagId)
    setSearchQuery('')
  }

  const handleCreateTag = async () => {
    await onTagCreate(searchQuery)
    setSearchQuery('')
  }

  return (
    <div className="smart-tag-input-container">
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="smart-tag-input"
      />

      {searchQuery && (
        <div className="smart-tag-dropdown">
          {filteredTags.length > 0 && (
            <div className="smart-tag-options">
              {filteredTags.map(tag => (
                <button
                  key={tag.id}
                  className="smart-tag-option"
                  onClick={() => handleSelectTag(tag.id)}
                >
                  + {tag.name}
                </button>
              ))}
            </div>
          )}

          {canCreateTag && (
            <button
              className="smart-tag-create"
              onClick={handleCreateTag}
            >
              + Create "{searchQuery}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
