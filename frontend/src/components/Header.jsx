import React from 'react';

export default function Header({ backendStatus }) {
  let statusClass = 'offline';
  let statusText = 'Backend Connecting';

  if (backendStatus === 'unconfigured') {
    statusClass = 'unconfigured';
    statusText = 'Backend Not Configured';
  } else if (backendStatus === 'healthy') {
    statusClass = 'online';
    statusText = 'Backend Ready';
  } else if (backendStatus === 'offline') {
    statusClass = 'offline';
    statusText = 'Backend Offline';
  }

  return (
    <header className="site-header">
      <div className="brand-wrapper">
        <div className="brand-icon-box" title="Mood Machine">
          🎭
        </div>
        <div>
          <div className="brand-title">Mood Machine</div>
          <div className="brand-tagline">Happy or Sad? Let the model decide.</div>
        </div>
      </div>

      <div className="header-status-pill" title="Status of FastAPI Backend Inference Service">
        <span className={`status-dot ${statusClass}`}></span>
        <span>{statusText}</span>
      </div>
    </header>
  );
}
