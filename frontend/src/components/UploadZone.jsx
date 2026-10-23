import React, { useRef, useState } from 'react';

export default function UploadZone({
  selectedFile,
  previewUrl,
  dimensions,
  isLoading,
  onFileSelect,
  onClear,
  onAnalyze
}) {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localError, setLocalError] = useState('');

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setLocalError('');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    setLocalError('');
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setLocalError('Please select a valid image file (JPEG, PNG, WEBP, or BMP).');
      return;
    }
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      setLocalError('File size exceeds the 10 MB limit. Please choose a smaller photo.');
      return;
    }
    setLocalError('');
    onFileSelect(file);
  };

  return (
    <div className="neo-card">
      <div className="neo-card-header">
        <div className="card-title-group">
          <span>📸</span>
          <span>{selectedFile ? 'Selected Image' : 'Upload Image'}</span>
        </div>
        {selectedFile && (
          <button
            type="button"
            className="neo-btn neo-btn-sm neo-btn-secondary"
            onClick={onClear}
            disabled={isLoading}
            title="Remove selected image"
          >
            ✕ Remove
          </button>
        )}
      </div>

      {localError && (
        <div className="error-banner" style={{ marginBottom: '1rem', marginTop: 0 }}>
          <div className="error-banner-title">⚠️ File Selection Error</div>
          <div className="error-banner-body">{localError}</div>
        </div>
      )}

      {!selectedFile ? (
        <div
          className={`dropzone-container ${isDragActive ? 'is-drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          <div className="dropzone-icon-box">
            📁
          </div>
          <div className="dropzone-heading">
            {isDragActive ? 'Drop your photo right here!' : 'Drop your photo here, or click to browse'}
          </div>
          <p className="dropzone-text">
            Supports portraits, selfies, or snapshots of any aspect ratio.
          </p>
          <div className="file-specs-pill">
            Max 10 MB • JPG, PNG, WEBP, BMP
          </div>
        </div>
      ) : (
        <div className="preview-card">
          <div className="preview-media-box">
            <img
              src={previewUrl}
              alt="Uploaded mood preview"
              className="preview-image"
            />
          </div>

          <div className="preview-meta-row">
            <div className="meta-chip" title="File Name">
              <span>📄</span>
              <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </span>
            </div>
            <div className="meta-chip" title="File Size">
              <span>⚖️</span>
              <span>{formatFileSize(selectedFile.size)}</span>
            </div>
            {dimensions.width > 0 && (
              <div className="meta-chip" title="Image Dimensions">
                <span>📐</span>
                <span>{dimensions.width} × {dimensions.height} px</span>
              </div>
            )}
          </div>

          <div className="btn-actions-row">
            <button
              type="button"
              className="neo-btn neo-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              🔄 Change Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <button
              type="button"
              className="neo-btn neo-btn-primary"
              onClick={onAnalyze}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-brutal" style={{ width: '18px', height: '18px', borderWidth: '3px', margin: 0 }}></span>
                  <span>Analyzing Mood...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Analyze Image</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
