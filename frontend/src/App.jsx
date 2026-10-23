import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import UploadZone from './components/UploadZone';
import ResultCard from './components/ResultCard';
import Footer from './components/Footer';

// Configurable API Base URL via Vite environment variable (e.g. VITE_API_BASE_URL)
const RAW_API_URL = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = typeof RAW_API_URL === 'string' && RAW_API_URL.trim() !== ''
  ? RAW_API_URL.trim().replace(/\/+$/, '')
  : null;

const LOADING_PHRASES = [
  'Decoding image pixels...',
  'Standardizing color channels to RGB...',
  'Resizing tensor to 256×256 input grid...',
  'Passing features through Conv2D layers...',
  'Evaluating smile and expression activations...',
  'Calculating probabilistic confidence score...'
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [backendStatus, setBackendStatus] = useState(API_BASE_URL ? 'connecting' : 'unconfigured');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const phraseIntervalRef = useRef(null);

  // Check backend health on initial page load if backend URL is configured
  useEffect(() => {
    if (!API_BASE_URL) {
      setBackendStatus('unconfigured');
      return;
    }
    checkHealth();
  }, []);

  const checkHealth = async () => {
    if (!API_BASE_URL) {
      setBackendStatus('unconfigured');
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setBackendStatus(data.model_loaded ? 'healthy' : 'degraded');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  // Rotate loading phrases while inference is running
  useEffect(() => {
    if (isLoading) {
      setLoadingPhraseIndex(0);
      phraseIntervalRef.current = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 1600);
    } else {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
    }
    return () => {
      if (phraseIntervalRef.current) clearInterval(phraseIntervalRef.current);
    };
  }, [isLoading]);

  // Handle image file selection
  const handleFileSelect = (file) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setErrorMsg('');
    setResult(null);

    // Measure natural dimensions
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = objectUrl;
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setDimensions({ width: 0, height: 0 });
    setErrorMsg('');
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isLoading) return;

    if (!API_BASE_URL) {
      setErrorMsg(
        'The prediction backend has not been configured yet. Deploy your backend to Render, then set VITE_API_BASE_URL in frontend/.env to your deployed Render URL (e.g. https://your-backend.onrender.com) and restart the dev server.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const abortController = new AbortController();
    // 60-second timeout to accommodate cold starts on Render free tier
    const timeoutId = setTimeout(() => abortController.abort(), 60000);

    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = 'Inference server error.';
        try {
          const errData = await response.json();
          errorDetail = errData.detail || errorDetail;
        } catch {
          errorDetail = `Server responded with HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      setResult(data);
      setBackendStatus('healthy');
    } catch (err) {
      let friendlyMessage = err.message;
      if (err.name === 'AbortError') {
        friendlyMessage = 'The request timed out. If the backend is running on Render free tier, it may be waking up from sleep. Please try clicking "Analyze Image" again.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        friendlyMessage = `Cannot reach backend at ${API_BASE_URL}. Please ensure the backend server is running and CORS is configured to accept requests from this origin.`;
        setBackendStatus('offline');
      }
      setErrorMsg(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header backendStatus={backendStatus} />
      <Hero />

      <main style={{ width: '100%', maxWidth: '840px', margin: '0 auto' }}>
        {errorMsg && (
          <div className="error-banner" style={{ marginBottom: '1.75rem' }}>
            <div className="error-banner-title">
              <span>⚠️</span>
              <span>Classification Error</span>
            </div>
            <div className="error-banner-body">
              {errorMsg}
            </div>
          </div>
        )}

        {result ? (
          <ResultCard
            result={result}
            previewUrl={previewUrl}
            selectedFile={selectedFile}
            onReset={handleClear}
          />
        ) : (
          <UploadZone
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            dimensions={dimensions}
            isLoading={isLoading}
            onFileSelect={handleFileSelect}
            onClear={handleClear}
            onAnalyze={handleAnalyze}
          />
        )}

        {isLoading && (
          <div className="neo-card loading-box" style={{ marginTop: '1.5rem' }}>
            <div className="spinner-brutal"></div>
            <div className="loading-title">Analyzing Facial Mood</div>
            <div className="loading-phrase">{LOADING_PHRASES[loadingPhraseIndex]}</div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
