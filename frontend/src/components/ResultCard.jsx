import React from 'react';

export default function ResultCard({
  result,
  previewUrl,
  selectedFile,
  onReset
}) {
  const isHappy = (result.label || '').toLowerCase().includes('happy');
  const cardThemeClass = isHappy ? 'result-card-happy' : 'result-card-sad';
  const moodEmoji = isHappy ? '😄' : '😢';
  const meterClass = isHappy ? 'meter-happy' : 'meter-sad';

  return (
    <div className="results-grid">
      {/* Uploaded Image Card */}
      <div className="neo-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="neo-card-header">
          <div className="card-title-group">
            <span>🖼️</span>
            <span>Analyzed Photo</span>
          </div>
          <span className="meta-chip">
            {selectedFile?.name || 'Uploaded photo'}
          </span>
        </div>

        <div className="preview-media-box" style={{ flex: 1, minHeight: '300px' }}>
          <img
            src={previewUrl}
            alt="Analyzed target"
            className="preview-image"
          />
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Processed at model input resolution (256 × 256 RGB)
          </span>
        </div>
      </div>

      {/* Mood Prediction Card */}
      <div className={`neo-card ${cardThemeClass}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="result-badge">
            <span>{moodEmoji}</span>
            <span>Mood Classification</span>
          </div>

          <div className="result-mood-label">
            {result.label}
          </div>

          <p className="result-editorial-msg">
            {isHappy
              ? 'Joyful expressions, bright smiles, and positive vibes detected by the neural network!'
              : 'Somber or reflective mood identified in the image features by the classifier.'}
          </p>

          <div className="result-confidence-box">
            <div className="confidence-header">
              <span className="confidence-label">Model Confidence</span>
              <span className="confidence-number">{result.confidence}%</span>
            </div>

            <div className="confidence-meter-track" title={`${result.confidence}% confidence`}>
              <div
                className={`confidence-meter-fill ${meterClass}`}
                style={{ width: `${Math.min(100, Math.max(0, result.confidence))}%` }}
              ></div>
            </div>

            {result.raw_score !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Sigmoid Raw Output:</span>
                <code>{result.raw_score}</code>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            className="neo-btn neo-btn-primary"
            style={{ width: '100%', padding: '1rem' }}
            onClick={onReset}
          >
            <span>🔄</span>
            <span>Try Another Image</span>
          </button>
        </div>
      </div>
    </div>
  );
}
