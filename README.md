# Mood Machine — Happy / Sad Image Classifier

Mood Machine is a web application built around an existing, pre-trained Keras convolutional neural network (CNN) model. It allows users to upload any photograph to predict whether the facial or emotional expression is **Happy** or **Sad**, displaying a calculated confidence percentage in an aesthetic **Neo-Brutalism** interface.

---

## Architecture Overview

```
               ┌────────────────────────────────────────────────────────┐
               │                  User Web Browser                      │
               └───────────────────────────┬────────────────────────────┘
                                           │
                        HTTP / HTTPS       │  Multipart File Upload
                                           ▼
┌──────────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│              Frontend (Vercel)               │    │             Backend (Render)             │
│                                              │    │                                          │
│  • React 18 + Vite                           │    │  • FastAPI + Uvicorn                     │
│  • Neo-Brutalism Design System (Pure CSS)    │    │  • Pillow (Image validation & RGB 256x256│
│  • Dynamic Drag & Drop, Previews, Meters     │    │  • TensorFlow & Keras 3.x                │
│  • Configured via VITE_API_BASE_URL          │◄───┤  • Reads 'imageclassifier.keras'         │
└──────────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

### Verified Model Specifications
Direct inspection of the `imageclassifier.keras` configuration reveals:
- **Model Framework:** Keras 3.13.2 (`Sequential`)
- **Input Layer Shape:** `[None, 256, 256, 3]` (RGB images scaled to **256 × 256**)
- **Network Structure:** 3 Convolutional blocks (`Conv2D` + `MaxPooling2D`) $\rightarrow$ `Flatten` $\rightarrow$ `Dense(256, relu)` $\rightarrow$ `Dense(1, sigmoid)`
- **Output Activation:** Single-unit **Sigmoid** ($[0.0, 1.0]$)
- **Default Class Mapping:**
  - Value $< 0.5 \rightarrow$ **Happy** (Confidence = $(1 - \text{score}) \times 100\%$)
  - Value $\ge 0.5 \rightarrow$ **Sad** (Confidence = $\text{score} \times 100\%$)
  *(Configurable via `LABEL_ZERO` and `LABEL_ONE` if your Colab dataset indexing was inverted)*

---

## Project Structure

```
D:\ImageClassification\
├── backend/
│   ├── main.py              # FastAPI inference service & safe Pillow preprocessing
│   ├── requirements.txt     # Remote dependencies for Render deployment
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── index.html           # HTML5 entry with Space Grotesk / Plus Jakarta Sans fonts
│   ├── package.json         # React 18 + Vite + Lucide icons
│   ├── vite.config.js       # Vite configuration
│   ├── vercel.json          # Single Page Application rewrites for Vercel
│   ├── .env.example         # Template for VITE_API_BASE_URL
│   └── src/
│       ├── main.jsx         # React DOM mount point
│       ├── App.jsx          # App logic, loading states, API handling
│       ├── index.css        # Complete Neo-Brutalism design system
│       └── components/
│           ├── Header.jsx   # Header with live backend connection badge
│           ├── Hero.jsx     # Neo-brutalist headline
│           ├── UploadZone.jsx # Drag-and-drop, specs pill, file preview
│           ├── ResultCard.jsx # Happy (green) and Sad (pink) prediction cards
│           └── Footer.jsx   # Model disclaimer & technical badge
├── imageclassifier.keras    # Existing trained model (44.4 MB)
├── .gitignore               # Excludes secrets, node_modules, and cache
└── README.md                # Documentation & deployment guide
```

---

## How to Supply the Model to Render

The trained model file `imageclassifier.keras` is **44.4 MB**.

You have two reliable options to provide this model to your Render deployment:

### Option A: Direct Git Commit (Recommended & Simplest)
- GitHub's hard file size limit is **100 MB**, and files under 50 MB do not even trigger GitHub's soft warning.
- Because `imageclassifier.keras` is **44.4 MB**, you can commit it directly to your private or public GitHub repository.
- When Render clones your repository to build the backend, the model will already be present.
- **Render configuration:** Set `MODEL_PATH=../imageclassifier.keras` (or `imageclassifier.keras`).

### Option B: External Cloud Storage via `MODEL_URL`
If you prefer to keep your Git repository purely text/code:
1. Upload `imageclassifier.keras` to a cloud storage host:
   - A **GitHub Release asset** on your repository (free, permanent, fast download)
   - **Hugging Face Hub** model repository (free)
   - AWS S3, Google Cloud Storage, or Cloudflare R2
2. Copy the direct download link.
3. In Render's dashboard, set the environment variable:
   ```
   MODEL_URL=https://github.com/your-username/your-repo/releases/download/v1.0/imageclassifier.keras
   ```
4. When `backend/main.py` boots up on Render, it detects that the model file is not on disk and automatically downloads it into the backend container before loading it into memory.

---

## Deployment Guide

### 1. Deploy the Backend on Render

1. Push your project to a GitHub repository.
2. Log in to [Render](https://render.com/) and click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name:** `mood-machine-backend`
   - **Region:** Choose the region closest to you (e.g., Oregon or Frankfurt).
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free (or Starter if you want 0s cold-starts)
5. Scroll down to **Environment Variables** and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app,http://localhost:5173` | Frontend URLs allowed to call backend |
   | `MODEL_PATH` | `../imageclassifier.keras` | Path to model (if committed to repo) |
   | `MODEL_URL` | *(Optional direct URL)* | Direct download link if using Option B |
   | `LABEL_ZERO` | `Happy` | Class corresponding to sigmoid output near 0 |
   | `LABEL_ONE` | `Sad` | Class corresponding to sigmoid output near 1 |
   | `THRESHOLD` | `0.5` | Decision boundary for binary classification |
   | `NORMALIZE_DIVISOR` | `255.0` | Normalizes pixel values from $[0, 255]$ to $[0.0, 1.0]$ |
6. Click **Create Web Service**.
7. Once deployed, test the health endpoint in your browser:
   `https://mood-machine-backend.onrender.com/health`
   You should see `{"status": "healthy", "model_loaded": true}`. Copy this base URL.

---

### 2. Deploy the Frontend on Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New...** $\rightarrow$ **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click `Edit` and select `frontend`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://mood-machine-backend.onrender.com` *(your Render URL, without trailing slash)* |
5. Click **Deploy**.
6. When Vercel finishes, click your production URL (e.g. `https://mood-machine.vercel.app`).
7. Update `ALLOWED_ORIGINS` on Render with your exact Vercel URL so CORS allows requests.

---

## Local Development (Optional)

> **Important Safety Note:** TensorFlow and Python ML libraries have **NOT** been installed on your laptop, honoring your strict instructions.
>
> If you wish to preview and test the frontend UI locally on your computer:
> 1. You only need to run `npm install` inside the `frontend` directory (Node.js packages only; zero Python or TensorFlow packages).
> 2. Point `VITE_API_BASE_URL` in `frontend/.env` to your deployed Render backend (or a mock server).
> 3. Run `npm run dev` in `frontend/`.

---

## Verification & Error Handling

- **Render Cold Starts:** Render's free tier spins down web services after 15 minutes of inactivity. When a request is sent, it can take 30–50 seconds to spin back up. The frontend includes a 60-second request timeout and displays an actionable notice asking the user to retry if a cold start timeout occurs.
- **Image Validation:** The backend uses Pillow to verify actual image headers and orientation (EXIF orientation tag) before passing data to the model. Non-image files, corrupted uploads, and files larger than 10 MB are rejected with clear HTTP 400/413 status codes.
- **Zero Information Leakage:** Production error responses do not expose filesystem paths, internal stack traces, or environment secrets.
