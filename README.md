# Image Creator

**An AI-powered image and video generation platform.** Create stunning visuals from text prompts, edit and enhance images with AI, generate short videos, and organize everything in collections — all from a sleek, modern interface.

Built by a team of AI agents (Nova, Pixel, Bolt, Scout) orchestrated through [NinjaTech AI](https://www.ninjatech.ai/).

---

## Features

- **Text-to-Image Generation** — Generate high-quality images from natural language prompts using GPT Image and Gemini models
- **Model Comparison** — Compare outputs from multiple AI models side-by-side
- **Image Editing Suite** — Inpainting, outpainting, background removal, upscaling, watermarking, and style transfer
- **AI Video Generation** — Create short AI-generated videos from text or images using Sora 2
- **Prompt Enhancement** — AI-powered prompt refinement for better results
- **Gallery & Collections** — Browse, search, and organize generated images into collections
- **Brand Kits** — Save brand guidelines (colors, fonts, style) for consistent generation
- **Character Profiles** — Create reusable character descriptions for consistent characters across images
- **Style Presets** — Save and apply custom style presets to any generation
- **Batch Generation** — Upload a CSV to generate multiple images at once
- **Export Options** — Download as PNG, SVG, or animated GIF
- **Product Photography** — Generate professional product photos with custom scenes
- **Depth Maps** — Generate depth maps from existing images
- **Undo/Redo History** — Full edit history with undo and redo support
- **Dark/Light Theme** — Toggle between dark and light modes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS |
| **Backend** | Python, FastAPI |
| **AI Models** | GPT Image 1.5, Gemini Image, Sora 2 / Sora 2 Pro (video), Claude (chat) |
| **Gateway** | LiteLLM model gateway |

---

## Project Structure

```
image-creator/
├── frontend/              # Next.js frontend app (port 3000)
│   └── next.config.ts     # Proxy config (rewrites /api/* to backend)
├── backend/               # FastAPI backend API (port 8000)
│   ├── main.py            # API endpoints and generation logic
│   ├── settings.json      # API credentials (gateway key + base URL)
│   ├── requirements.txt   # Python backend dependencies
│   └── .venv/             # Python virtual environment
├── utils/                 # AI model utility library
│   ├── litellm_client.py  # Gateway config, model catalog, fallback lists
│   ├── images.py          # Image generation (GPT Image, Gemini Image)
│   ├── chat.py            # Chat completions (Claude, GPT, Gemini)
│   └── video.py           # Video generation (Sora 2)
├── generated-images/      # Stored generated images + JSON databases
├── generated-videos/      # Stored generated videos
├── models.json            # Full model catalog from gateway
└── requirements.txt       # Root-level dependencies (CLI tools)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- LiteLLM gateway running on `localhost:4000`

### Configuration

API credentials are stored in `backend/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-litellm-virtual-key",
    "ANTHROPIC_BASE_URL": "http://localhost:4000"
  }
}
```

The settings file is searched in order:
1. `/root/.claude/settings.json` (sandbox environment)
2. `backend/settings.json` (local development)
3. `settings.json` (project root fallback)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on port **3000** and the backend API on port **8000**.

---

## Model Configuration

Models are configured in `utils/litellm_client.py`. The app uses ordered fallback lists — if the primary model fails, it automatically tries the next one.

### Image Models (fallback order)

| Alias | Gateway Model ID | Provider |
|-------|-----------------|----------|
| `gpt-image` | `gpt-image-1.5` | OpenAI |
| `gemini-image` | `google/gemini/gemini-3-pro-image-preview` | Google |

### Video Models (fallback order)

| Alias | Gateway Model ID | Provider |
|-------|-----------------|----------|
| `sora` | `sora-2` | OpenAI |
| `sora-pro` | `sora-2-pro` | OpenAI |

### Chat Models

| Alias | Gateway Model ID | Provider |
|-------|-----------------|----------|
| `claude-sonnet` | `claude-sonnet-4-5-20250929` | Anthropic |
| `claude-haiku` | `claude-haiku-4-5-20251001` | Anthropic |
| `claude-opus` | `claude-opus-4-6` | Anthropic |
| `gpt-5` | `gpt-5.2` | OpenAI |

To add or reorder models, edit the `IMAGE_MODELS` and `VIDEO_MODELS` lists in `utils/litellm_client.py`.

---

## API

The backend exposes a REST API at `/api/` with endpoints for:

| Endpoint | Description |
|----------|-------------|
| `POST /api/generate` | Generate images from text prompts |
| `POST /api/enhance-prompt` | AI-enhance a prompt for better results |
| `POST /api/compare-models` | Generate with all image models side-by-side |
| `POST /api/generate-from-image` | Generate from a reference image |
| `GET /api/images` | List all generated images |
| `GET /api/images/{id}` | Get image details |
| `POST /api/images/{id}/edit` | Edit an existing image |
| `POST /api/images/{id}/upscale` | Upscale an image |
| `POST /api/images/{id}/remove-bg` | Remove image background |
| `POST /api/images/{id}/outpaint` | Extend image canvas |
| `POST /api/generate-video` | Generate video from text prompt |
| `POST /api/image-to-video` | Generate video from an image |
| `GET /api/videos/{id}/status` | Check video generation status |
| `GET /api/collections` | Manage image collections |
| `GET /api/brand-kits` | Manage brand kits |

Full interactive docs available at `/docs` when the backend is running.

---

## Known Issues

- The LiteLLM Python SDK `video_content()` function may send `None` as the API key for video downloads. The app uses raw HTTP requests as a workaround.
- Gemini Image model ID format may need adjustment when gateway access is added — test and update in `litellm_client.py` if needed.
- The Next.js proxy timeout is set to 5 minutes (`proxyTimeout: 300000` in `next.config.ts`) to accommodate slow image/video generation.
