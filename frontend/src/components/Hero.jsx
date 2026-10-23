import React from 'react';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-pill-badge">
        ⚡ AI Vision Classifier
      </div>
      <h1 className="hero-title">
        What's the <span className="highlight-mood">mood?</span>
      </h1>
      <p className="hero-subtitle">
        Drop in a photo. Get your prediction.
      </p>
    </section>
  );
}
