import io
import os
import sys
import logging
from contextlib import asynccontextmanager
from typing import Optional, Tuple

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Load local environment variables if present
load_dotenv()

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mood_machine_backend")

# Configuration via Environment Variables
PORT = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS_RAW = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
)
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS_RAW.split(",") if origin.strip()]

MODEL_PATH_CONFIG = os.getenv("MODEL_PATH", "../imageclassifier.keras")
MODEL_URL = os.getenv("MODEL_URL", "").strip()
LABEL_ZERO = os.getenv("LABEL_ZERO", "Happy").strip()
LABEL_ONE = os.getenv("LABEL_ONE", "Sad").strip()
THRESHOLD = float(os.getenv("THRESHOLD", "0.5"))
NORMALIZE_DIVISOR = float(os.getenv("NORMALIZE_DIVISOR", "255.0"))
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

# Supported image mime types and extensions
ALLOWED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP", "BMP", "TIFF"}


class ModelState:
    """Holds global reference to loaded model and metadata."""
    def __init__(self):
        self.model = None
        self.target_size: Tuple[int, int] = (256, 256)
        self.is_loaded: bool = False
        self.load_error: Optional[str] = None
        self.output_type: str = "sigmoid"  # 'sigmoid' (1 unit) or 'softmax' (2 units)


state = ModelState()


def download_model_if_needed(destination_path: str, url: str) -> bool:
    """
    Downloads model weights from an external URL if not already present.
    Useful for cloud deployments (like Render) where large binaries are hosted on
    cloud storage (S3, GitHub Releases, HuggingFace, etc.).
    """
    if os.path.exists(destination_path):
        return True
    if not url:
        return False

    logger.info("Attempting to download model from external URL...")
    try:
        import requests
        resp = requests.get(url, stream=True, timeout=60)
        resp.raise_for_status()

        os.makedirs(os.path.dirname(os.path.abspath(destination_path)), exist_ok=True)
        with open(destination_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
        logger.info("Model successfully downloaded to %s", destination_path)
        return True
    except Exception as exc:
        logger.error("Failed to download model from %s: %s", url, exc)
        return False


def resolve_model_path(configured_path: str) -> Optional[str]:
    """Resolves relative or absolute model path across project structures."""
    candidates = [
        configured_path,
        os.path.join(os.path.dirname(__file__), configured_path),
        os.path.join(os.path.dirname(__file__), "..", "imageclassifier.keras"),
        os.path.join(os.path.dirname(__file__), "imageclassifier.keras"),
        os.path.abspath(configured_path),
        "imageclassifier.keras",
    ]
    for candidate in candidates:
        candidate_norm = os.path.normpath(os.path.abspath(candidate))
        if os.path.isfile(candidate_norm):
            return candidate_norm
    return None


def load_classifier_model():
    """Safely loads Keras model and inspects expected input dimensions."""
    resolved_path = resolve_model_path(MODEL_PATH_CONFIG)

    # If local file not found, try remote URL if configured
    if not resolved_path and MODEL_URL:
        target_dest = os.path.join(os.path.dirname(__file__), "imageclassifier.keras")
        if download_model_if_needed(target_dest, MODEL_URL):
            resolved_path = target_dest

    if not resolved_path:
        error_msg = (
            f"Model file could not be found at configured path '{MODEL_PATH_CONFIG}'. "
            "Ensure 'imageclassifier.keras' is uploaded or MODEL_URL is set."
        )
        logger.warning(error_msg)
        state.is_loaded = False
        state.load_error = error_msg
        return

    try:
        # Import TensorFlow/Keras only inside backend runtime
        import tensorflow as tf
        import keras

        logger.info("Loading Keras model from %s...", resolved_path)
        model = keras.models.load_model(resolved_path)
        state.model = model

        # Determine target image dimensions from model input shape
        input_shape = getattr(model, "input_shape", None)
        logger.info("Model loaded successfully. Input shape: %s", input_shape)

        # Expected shape is (None, Height, Width, Channels)
        if input_shape and len(input_shape) >= 4 and input_shape[1] and input_shape[2]:
            state.target_size = (int(input_shape[1]), int(input_shape[2]))
        else:
            state.target_size = (256, 256)

        # Determine output type
        output_shape = getattr(model, "output_shape", None)
        if output_shape and len(output_shape) >= 2 and output_shape[-1] == 1:
            state.output_type = "sigmoid"
        elif output_shape and len(output_shape) >= 2 and output_shape[-1] == 2:
            state.output_type = "softmax"
        else:
            state.output_type = "sigmoid"

        state.is_loaded = True
        state.load_error = None
        logger.info(
            "Model readiness complete. Target size: %s, Output type: %s",
            state.target_size,
            state.output_type,
        )

    except Exception as exc:
        logger.error("Failed to load model: %s", exc, exc_info=True)
        state.is_loaded = False
        state.load_error = "Model loading failed during backend initialization."


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI Lifespan context: initialize model on startup."""
    logger.info("Starting Mood Machine Backend...")
    load_classifier_model()
    yield
    logger.info("Shutting down Mood Machine Backend.")


app = FastAPI(
    title="Mood Machine API",
    description="Happy or Sad Image Classification Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", summary="API root status")
def root():
    return {
        "status": "online",
        "service": "Mood Machine API",
        "version": "1.0.0",
        "description": "Happy or Sad Image Classifier API",
        "endpoints": {
            "health": "/health",
            "predict": "POST /predict"
        }
    }


@app.get("/health", summary="Health check endpoint")
def health():
    return {
        "status": "healthy" if state.is_loaded else "degraded",
        "model_loaded": state.is_loaded,
        "input_dimensions": {
            "height": state.target_size[0],
            "width": state.target_size[1],
            "channels": 3,
        },
        "labels": {
            "class_0": LABEL_ZERO,
            "class_1": LABEL_ONE,
        },
        "threshold": THRESHOLD,
        "message": "Model is loaded and ready for inference." if state.is_loaded else state.load_error or "Model is not loaded."
    }


@app.post("/predict", summary="Classify uploaded image as Happy or Sad")
async def predict_mood(file: UploadFile = File(...)):
    # 1. Validate file presence
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file was provided in the request."
        )

    # 2. Check model readiness
    if not state.is_loaded or state.model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image classification model is not currently loaded on the server. Please check backend health."
        )

    # 3. Read uploaded payload and validate file size
    try:
        contents = await file.read()
    except Exception as exc:
        logger.error("Error reading uploaded file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded file."
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image file size exceeds maximum limit of {MAX_IMAGE_SIZE_MB} MB."
        )

    # 4. Validate image integrity and decode using Pillow
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
    except ImportError:
        logger.critical("Pillow library is missing in backend environment.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server image processing library is unavailable."
        )

    try:
        # Verify valid image content without trusting extension alone
        image_stream = io.BytesIO(contents)
        with Image.open(image_stream) as img_probe:
            img_format = (img_probe.format or "").upper()
            img_probe.verify()

        if img_format not in ALLOWED_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format '{img_format}'. Supported formats are: {', '.join(sorted(ALLOWED_FORMATS))}."
            )

        # Reopen image for manipulation (verify closes/invalidates the stream)
        image_stream.seek(0)
        img = Image.open(image_stream)

        # 5. Correct EXIF orientation (e.g. from smartphone cameras)
        img = ImageOps.exif_transpose(img)

        # 6. Convert to RGB color format
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 7. Resize to model's exact target dimensions (default 256x256)
        target_w, target_h = state.target_size[1], state.target_size[0]
        img_resized = img.resize((target_w, target_h), Image.Resampling.BILINEAR)

    except UnidentifiedImageError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is corrupted or not a valid image format."
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error during image preprocessing: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode the uploaded image. Please try a different file."
        )

    # 8. Transform image to normalized numpy batch tensor
    try:
        import numpy as np
        img_array = np.asarray(img_resized, dtype=np.float32)

        # Apply pixel normalization (e.g. scale [0, 255] to [0.0, 1.0])
        if NORMALIZE_DIVISOR > 0:
            img_array = img_array / NORMALIZE_DIVISOR

        # Shape: (1, height, width, 3)
        batch = np.expand_dims(img_array, axis=0)

        # 9. Execute remote inference
        raw_preds = state.model.predict(batch, verbose=0)

    except Exception as exc:
        logger.error("Error during model inference: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while evaluating the image through the neural network."
        )

    # 10. Parse prediction and calculate confidence
    try:
        if state.output_type == "softmax" or (hasattr(raw_preds, "shape") and raw_preds.shape[-1] == 2):
            # Two-class softmax output: [prob_class_0, prob_class_1]
            probs = raw_preds[0]
            pred_class_idx = int(np.argmax(probs))
            raw_score = float(probs[pred_class_idx])
            confidence = round(raw_score * 100.0, 2)
            label = LABEL_ZERO if pred_class_idx == 0 else LABEL_ONE
        else:
            # Single-unit sigmoid output [0.0, 1.0]
            raw_score = float(raw_preds[0][0])
            if raw_score < THRESHOLD:
                label = LABEL_ZERO
                # Distance from threshold / probability towards 0
                confidence = round((1.0 - raw_score) * 100.0, 2)
            else:
                label = LABEL_ONE
                # Probability towards 1
                confidence = round(raw_score * 100.0, 2)

        # Clamp confidence to [0.0, 100.0] for safety
        confidence = max(0.0, min(100.0, confidence))

        logger.info("Prediction: label=%s, confidence=%.2f%%, raw_score=%.4f", label, confidence, raw_score)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "label": label,
                "confidence": confidence,
                "raw_score": round(raw_score, 4),
                "message": f"Mood detected: {label} with {confidence}% confidence.",
                "model_specs": {
                    "input_size": f"{state.target_size[0]}x{state.target_size[1]}",
                    "output_type": state.output_type,
                }
            }
        )

    except Exception as exc:
        logger.error("Error formatting model output: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse model prediction."
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
