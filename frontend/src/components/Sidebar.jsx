export function Sidebar({ activeSection, onSectionChange, theme, onThemeChange, logo, icon }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="FrameFolio" style={{ height: '40px', width: 'auto' }} />
      </div>
      
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeSection === 'images' ? 'active' : ''}`}
          onClick={() => onSectionChange('images')}
        >
          🖼️ Images
        </button>
        <button
          className={`nav-item ${activeSection === 'library' ? 'active' : ''}`}
          onClick={() => onSectionChange('library')}
        >
          📁 Library
        </button>
        <button
          className={`nav-item ${activeSection === 'tags' ? 'active' : ''}`}
          onClick={() => onSectionChange('tags')}
        >
          🏷️ Tags
        </button>
        <button
          className={`nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
          onClick={() => onSectionChange('appearance')}
        >
          ⚙️ Appearance
        </button>
      </nav>
      
      <div className="sidebar-footer">
        <img src={theme === 'light' ? icon.black : icon.white} alt="FrameFolio Icon" />
      </div>
    </aside>
  )
}
