import { useState, useEffect } from 'react';
import logoImg from '../assets/logo/framefolio_logo.png';

export default function InfoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('framefolioInfoBannerDismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('framefolioInfoBannerDismissed', 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <img src={logoImg} alt="FrameFolio" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <h2 style={{ margin: 0 }}>Welcome to FrameFolio</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-content">
          <p style={{ marginBottom: '16px', fontSize: '15px', lineHeight: '1.6' }}>
            Take complete control over your art collection for your Samsung Frame TV. Curate, organize, and manage your own images—no subscriptions, no limits.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>🎨</span>
              <span>Upload & organize images</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>🏷️</span>
              <span>Tag & categorize collections</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span>📥</span>
              <span>Download in FrameReady format</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', margin: 0, flex: 1 }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Don't show again</span>
          </label>
          <button className="btn-primary" onClick={handleClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
