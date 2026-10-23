import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-card">
        <p className="footer-disclaimer">
          ⚠️ <strong>Experimental Classifier:</strong> Mood Machine evaluates visual cues using a convolutional neural network trained on facial expressions. Predictions are probabilistic estimates and are not guaranteed to be 100% accurate.
        </p>
        <div className="footer-badge">
          Keras 3.x • TensorFlow CNN • FastAPI • React Neo-Brutalism
        </div>
      </div>
    </footer>
  );
}
