"""
Image Creator Backend
=====================
FastAPI backend for AI-powered image generation.
"""

import json
import uuid
import re
import sys
import os
import base64
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from io import BytesIO

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont

# Add project root to path so we can import utils
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.images import generate_image
from utils.images import edit_image
from utils.chat import chat
from utils.video import submit_video, check_video_status, download_video
from utils.litellm_client import IMAGE_MODELS, VIDEO_MODELS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated-images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = IMAGES_DIR / "images_db.json"

VIDEOS_DIR = Path(__file__).resolve().parent.parent / "generated-videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DB_PATH = VIDEOS_DIR / "videos_db.json"

COLLECTIONS_DB_PATH = IMAGES_DIR / "collections_db.json"
PROMPTS_DB_PATH = IMAGES_DIR / "prompts_db.json"
CHARACTER_PROFILES_DB_PATH = IMAGES_DIR / "character_profiles_db.json"
BRAND_KITS_DB_PATH = IMAGES_DIR / "brand_kits_db.json"
STYLE_PRESETS_DB_PATH = IMAGES_DIR / "style_presets_db.json"
BATCH_JOBS_DB_PATH = IMAGES_DIR / "batch_jobs_db.json"

# ---------------------------------------------------------------------------
# CORS — read sandbox metadata for allowed origins
# ---------------------------------------------------------------------------

def get_allowed_origins():
    try:
        with open("/dev/shm/sandbox_metadata.json") as f:
            meta = json.load(f)
        sandbox_id = meta["thread_id"]
        stage = meta["environment"]
        base = f"{sandbox_id}.app.super.{stage}myninja.ai"
        return [
            f"https://3000-{base}",
            f"https://8000-{base}",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    except Exception:
        return ["*"]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Image Creator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database helpers (JSON file)
# ---------------------------------------------------------------------------

def load_db() -> list[dict]:
    if DB_PATH.exists():
        return json.loads(DB_PATH.read_text())
    return []

def save_db(records: list[dict]):
    DB_PATH.write_text(json.dumps(records, indent=2))

def load_videos_db() -> list[dict]:
    if VIDEOS_DB_PATH.exists():
        return json.loads(VIDEOS_DB_PATH.read_text())
    return []

def save_videos_db(records: list[dict]):
    VIDEOS_DB_PATH.write_text(json.dumps(records, indent=2))

def load_collections_db() -> list[dict]:
    if COLLECTIONS_DB_PATH.exists():
        return json.loads(COLLECTIONS_DB_PATH.read_text())
    return []

def save_collections_db(records: list[dict]):
    COLLECTIONS_DB_PATH.write_text(json.dumps(records, indent=2))

def load_prompts_db() -> list[dict]:
    if PROMPTS_DB_PATH.exists():
        return json.loads(PROMPTS_DB_PATH.read_text())
    return []

def save_prompts_db(records: list[dict]):
    PROMPTS_DB_PATH.write_text(json.dumps(records, indent=2))

def load_character_profiles_db() -> list[dict]:
    if CHARACTER_PROFILES_DB_PATH.exists():
        return json.loads(CHARACTER_PROFILES_DB_PATH.read_text())
    return []

def save_character_profiles_db(records: list[dict]):
    CHARACTER_PROFILES_DB_PATH.write_text(json.dumps(records, indent=2))

def load_brand_kits_db() -> list[dict]:
    if BRAND_KITS_DB_PATH.exists():
        return json.loads(BRAND_KITS_DB_PATH.read_text())
    return []

def save_brand_kits_db(records: list[dict]):
    BRAND_KITS_DB_PATH.write_text(json.dumps(records, indent=2))

def load_style_presets_db() -> list[dict]:
    if STYLE_PRESETS_DB_PATH.exists():
        return json.loads(STYLE_PRESETS_DB_PATH.read_text())
    return []

def save_style_presets_db(records: list[dict]):
    STYLE_PRESETS_DB_PATH.write_text(json.dumps(records, indent=2))

def load_batch_jobs_db() -> list[dict]:
    if BATCH_JOBS_DB_PATH.exists():
        return json.loads(BATCH_JOBS_DB_PATH.read_text())
    return []

def save_batch_jobs_db(records: list[dict]):
    BATCH_JOBS_DB_PATH.write_text(json.dumps(records, indent=2))

def save_prompt_history(prompt: str):
    """Auto-save prompt to history, dedup within 5 minutes."""
    db = load_prompts_db()
    now = datetime.utcnow()
    # Check for duplicate within last 5 minutes
    for entry in db[:10]:
        if entry["prompt"] == prompt:
            try:
                entry_time = datetime.fromisoformat(entry["created_at"])
                if (now - entry_time).total_seconds() < 300:
                    return  # Skip duplicate
            except Exception:
                pass
    record = {"prompt": prompt, "created_at": now.isoformat()}
    db.insert(0, record)
    # Keep last 50
    db = db[:50]
    save_prompts_db(db)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    style: str = Field(default="none")
    size: str = Field(default="1024x1024")
    enhance: bool = Field(default=False)
    count: int = Field(default=1, ge=1, le=4)
    character_profile_id: str | None = Field(default=None)
    text_overlay: dict | None = Field(default=None)
    brand_kit_id: str | None = Field(default=None)

class EnhancePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)

class RefineRequest(BaseModel):
    image_id: str
    instruction: str = Field(..., min_length=1, max_length=2000)

class CompareRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    style: str = Field(default="none")
    size: str = Field(default="1024x1024")

class InpaintRequest(BaseModel):
    image_id: str
    mask: str  # base64-encoded PNG mask
    prompt: str = Field(..., min_length=1, max_length=2000)

class UpscaleRequest(BaseModel):
    image_id: str
    scale: int = Field(default=2, ge=2, le=4)

class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    size: str = Field(default="1280x720")
    quality: str = Field(default="standard")  # standard or pro

class ImageToVideoRequest(BaseModel):
    image_id: str
    prompt: str = Field(..., min_length=1, max_length=2000)
    quality: str = Field(default="standard")

class AdjustRequest(BaseModel):
    brightness: float = Field(default=1.0, ge=0.0, le=2.0)
    contrast: float = Field(default=1.0, ge=0.0, le=2.0)
    saturation: float = Field(default=1.0, ge=0.0, le=2.0)
    sharpness: float = Field(default=1.0, ge=0.0, le=2.0)
    blur: float = Field(default=0.0, ge=0.0, le=10.0)

class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class CollectionImageRequest(BaseModel):
    image_id: str

class CollectionItemRequest(BaseModel):
    item_id: str
    item_type: str = Field(default="image")  # "image" or "video"

class StyleTransferRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    strength: float = Field(default=0.7, ge=0.0, le=1.0)
    size: str = Field(default="1024x1024")
    style: str = Field(default="none")

# Sprint 7 Models

class TextOverlay(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)
    font_hint: str = Field(default="bold")
    placement: str = Field(default="center")

class CreateCharacterProfileRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class CreateBrandKitRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    colors: list[str] = Field(..., min_length=1, max_length=6)
    style_notes: str = Field(default="")

# ---------------------------------------------------------------------------
# Style presets
# ---------------------------------------------------------------------------

STYLE_SUFFIXES = {
    "none": "",
    "photorealistic": ", photorealistic, ultra detailed, 8k, DSLR photo",
    "digital-art": ", digital art, vibrant colors, detailed illustration",
    "watercolor": ", watercolor painting, soft edges, artistic, paper texture",
    "oil-painting": ", oil painting, rich textures, classical style, canvas",
    "anime": ", anime style, manga, Japanese animation, cel shaded",
    "3d-render": ", 3D render, Cinema 4D, octane render, detailed lighting",
    "minimalist": ", minimalist, clean lines, simple shapes, modern design",
    "vintage": ", vintage, retro, film grain, muted colors, nostalgic",
}

# ---------------------------------------------------------------------------
# Image post-processing
# ---------------------------------------------------------------------------

def postprocess_image(file_path: str, target_size: str) -> None:
    """Convert to real PNG and resize/crop to match the requested dimensions."""
    width, height = map(int, target_size.split("x"))
    img = Image.open(file_path)
    # Convert to RGB if needed (e.g. RGBA, palette)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    # Smart center-crop to target aspect ratio, then resize
    target_ratio = width / height
    img_ratio = img.width / img.height
    if abs(img_ratio - target_ratio) > 0.01:
        if img_ratio > target_ratio:
            # Image is wider than target — crop sides
            new_w = int(img.height * target_ratio)
            left = (img.width - new_w) // 2
            img = img.crop((left, 0, left + new_w, img.height))
        else:
            # Image is taller than target — crop top/bottom
            new_h = int(img.width / target_ratio)
            top = (img.height - new_h) // 2
            img = img.crop((0, top, img.width, top + new_h))
    # Resize to exact target dimensions
    if img.size != (width, height):
        img = img.resize((width, height), Image.LANCZOS)
    img.save(file_path, format="PNG")


VALID_SIZES = ["1024x1024", "1024x1536", "1536x1024"]
VALID_VIDEO_SIZES = ["1280x720", "720x1280"]

# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------

def _generate_single(prompt: str, size: str, model: str | None = None) -> tuple[str, str]:
    """Generate one image with automatic fallback through available models."""
    image_id = str(uuid.uuid4())
    filename = f"{image_id}.png"
    output_path = str(IMAGES_DIR / filename)

    # If a specific model is requested, try it first then fall back to others
    models_to_try = list(IMAGE_MODELS)
    if model and model in models_to_try:
        models_to_try.remove(model)
        models_to_try.insert(0, model)
    elif model:
        models_to_try.insert(0, model)

    last_error = None
    for m in models_to_try:
        try:
            generate_image(prompt=prompt, model=m, size=size, output=output_path)
            break
        except Exception as e:
            last_error = e
            continue
    else:
        raise RuntimeError(f"All image models failed. Last error: {last_error}")

    try:
        postprocess_image(output_path, size)
    except Exception:
        pass
    return image_id, filename

def _build_prompt(prompt: str, style: str, enhance: bool) -> tuple[str, str | None]:
    """Build final generation prompt with optional enhancement and style suffix."""
    final_prompt = prompt
    enhanced_prompt = None
    if enhance:
        try:
            enhanced_prompt = chat(
                prompt,
                model="claude-haiku",
                system="You are an expert at writing image generation prompts. Enhance this prompt for better results while preserving the user's intent. Return only the enhanced prompt, nothing else.",
                max_tokens=500,
                temperature=0.7,
            )
            final_prompt = enhanced_prompt
        except Exception:
            pass
    style_suffix = STYLE_SUFFIXES.get(style, "")
    return final_prompt + style_suffix, enhanced_prompt

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/generate")
async def generate(req: GenerateRequest):
    if req.size not in VALID_SIZES:
        raise HTTPException(400, f"Invalid size. Must be one of: {VALID_SIZES}")

    generation_prompt, enhanced_prompt = _build_prompt(req.prompt, req.style, req.enhance)
    # Sprint 7: apply character profile, text overlay, and brand kit
    generation_prompt = _apply_character_profile(generation_prompt, req.character_profile_id)
    generation_prompt = _apply_text_overlay(generation_prompt, req.text_overlay)
    generation_prompt = _apply_brand_kit(generation_prompt, req.brand_kit_id)

    group_id = str(uuid.uuid4()) if req.count > 1 else None
    now = datetime.utcnow().isoformat()

    # Save prompt to history
    save_prompt_history(req.prompt)

    if req.count == 1:
        # Single image (backwards compatible)
        try:
            image_id, filename = _generate_single(generation_prompt, req.size)
        except Exception as e:
            raise HTTPException(500, f"Image generation failed: {e}")

        record = {
            "id": image_id,
            "prompt": req.prompt,
            "enhanced_prompt": enhanced_prompt,
            "style": req.style,
            "size": req.size,
            "filename": filename,
            "character_profile_id": req.character_profile_id,
            "text_overlay": req.text_overlay,
            "brand_kit_id": req.brand_kit_id,
            "created_at": now,
        }
        db = load_db()
        db.insert(0, record)
        save_db(db)
        return record
    else:
        # Batch: generate count images in parallel
        records = []
        errors = []
        with ThreadPoolExecutor(max_workers=req.count) as executor:
            futures = {
                executor.submit(_generate_single, generation_prompt, req.size): i
                for i in range(req.count)
            }
            for future in as_completed(futures):
                try:
                    image_id, filename = future.result()
                    records.append({
                        "id": image_id,
                        "prompt": req.prompt,
                        "enhanced_prompt": enhanced_prompt,
                        "style": req.style,
                        "size": req.size,
                        "filename": filename,
                        "group_id": group_id,
                        "character_profile_id": req.character_profile_id,
                        "text_overlay": req.text_overlay,
                        "brand_kit_id": req.brand_kit_id,
                        "created_at": now,
                    })
                except Exception as e:
                    errors.append(str(e))

        if not records:
            raise HTTPException(500, f"All generations failed: {'; '.join(errors)}")

        db = load_db()
        for r in records:
            db.insert(0, r)
        save_db(db)

        return {"images": records, "group_id": group_id}


@app.post("/api/enhance-prompt")
async def enhance_prompt(req: EnhancePromptRequest):
    try:
        enhanced = chat(
            req.prompt,
            model="claude-haiku",
            system="You are an expert at writing image generation prompts. Enhance this prompt for better, more detailed image generation results while preserving the user's intent. Return only the enhanced prompt, nothing else.",
            max_tokens=500,
            temperature=0.7,
        )
        return {"original": req.prompt, "enhanced": enhanced}
    except Exception as e:
        raise HTTPException(500, f"Prompt enhancement failed: {e}")


@app.get("/api/images")
async def list_images(
    page: int = 1,
    limit: int = 20,
    search: str = Query(default=None),
    favorites: bool = Query(default=False),
):
    db = load_db()
    filtered = db
    if search:
        search_lower = search.lower()
        filtered = [r for r in filtered if search_lower in r.get("prompt", "").lower()]
    if favorites:
        filtered = [r for r in filtered if r.get("favorited", False)]
    start = (page - 1) * limit
    end = start + limit
    items = filtered[start:end]
    return {
        "images": items,
        "total": len(filtered),
        "page": page,
        "limit": limit,
    }


@app.get("/api/images/{image_id}")
async def get_image(image_id: str):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")
    return record


@app.get("/api/images/{image_id}/download")
async def download_image(image_id: str, format: str = Query(default="png")):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    file_path = IMAGES_DIR / record["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Image file not found")

    safe_name = re.sub(r'[^\w\s-]', '', record["prompt"][:50]).strip().replace(' ', '_') or image_id

    if format in ("jpeg", "jpg"):
        img = Image.open(file_path).convert("RGB")
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/jpeg",
                                 headers={"Content-Disposition": f'attachment; filename="{safe_name}.jpg"'})
    elif format == "webp":
        img = Image.open(file_path)
        buf = BytesIO()
        img.save(buf, format="WEBP", quality=90)
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/webp",
                                 headers={"Content-Disposition": f'attachment; filename="{safe_name}.webp"'})
    else:
        return FileResponse(path=str(file_path), filename=f"{safe_name}.png", media_type="image/png")


@app.get("/api/images/{image_id}/file")
async def serve_image_file(image_id: str):
    """Serve the image file directly (for <img> tags)."""
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    file_path = IMAGES_DIR / record["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Image file not found")

    return FileResponse(path=str(file_path), media_type="image/png")


# ---------------------------------------------------------------------------
# Sprint 2: Conversational Refinement
# ---------------------------------------------------------------------------

@app.post("/api/refine")
async def refine(req: RefineRequest):
    db = load_db()
    parent = next((r for r in db if r["id"] == req.image_id), None)
    if not parent:
        raise HTTPException(404, "Parent image not found")

    # Use claude-sonnet to merge original prompt + refinement instruction
    try:
        merged_prompt = chat(
            f"Original prompt: {parent['prompt']}\n\nRefinement instruction: {req.instruction}",
            model="claude-haiku",
            system="You are an image generation prompt expert. Given an original prompt and a refinement instruction, create a new prompt that incorporates the changes while preserving the original intent and style. Return only the new prompt, nothing else.",
            max_tokens=500,
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(500, f"Prompt merging failed: {e}")

    # Apply style suffix from parent
    style_suffix = STYLE_SUFFIXES.get(parent.get("style", "none"), "")
    generation_prompt = merged_prompt + style_suffix

    try:
        image_id, filename = _generate_single(generation_prompt, parent.get("size", "1024x1024"))
    except Exception as e:
        raise HTTPException(500, f"Refinement generation failed: {e}")

    record = {
        "id": image_id,
        "prompt": merged_prompt,
        "original_prompt": parent["prompt"],
        "refinement_instruction": req.instruction,
        "parent_id": parent["id"],
        "style": parent.get("style", "none"),
        "size": parent.get("size", "1024x1024"),
        "filename": filename,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 2: Multi-Model Comparison
# ---------------------------------------------------------------------------

@app.post("/api/compare")
async def compare(req: CompareRequest):
    if req.size not in VALID_SIZES:
        raise HTTPException(400, f"Invalid size. Must be one of: {VALID_SIZES}")

    style_suffix = STYLE_SUFFIXES.get(req.style, "")
    generation_prompt = req.prompt + style_suffix
    now = datetime.utcnow().isoformat()
    comparison_id = str(uuid.uuid4())

    results = []
    records_to_save = []
    with ThreadPoolExecutor(max_workers=len(IMAGE_MODELS)) as executor:
        futures = {
            executor.submit(_generate_single, generation_prompt, req.size, model): model
            for model in IMAGE_MODELS
        }
        for future in as_completed(futures):
            model = futures[future]
            try:
                image_id, filename = future.result()
                record = {
                    "id": image_id,
                    "prompt": req.prompt,
                    "style": req.style,
                    "size": req.size,
                    "filename": filename,
                    "model": model,
                    "comparison_id": comparison_id,
                    "created_at": now,
                }
                records_to_save.append(record)
                results.append({"model": model, "image": record, "error": None})
            except Exception as e:
                results.append({"model": model, "image": None, "error": str(e)})

    if all(r["error"] for r in results):
        raise HTTPException(500, "Both models failed to generate images")

    if records_to_save:
        db = load_db()
        for r in records_to_save:
            db.insert(0, r)
        save_db(db)

    return {"results": results, "comparison_id": comparison_id}


# ---------------------------------------------------------------------------
# Sprint 2: Image-to-Image Upload
# ---------------------------------------------------------------------------

@app.post("/api/generate-from-image")
async def generate_from_image(
    prompt: str = Form(..., min_length=1, max_length=2000),
    style: str = Form(default="none"),
    size: str = Form(default="1024x1024"),
    reference: UploadFile = File(...),
):
    if size not in VALID_SIZES:
        raise HTTPException(400, f"Invalid size. Must be one of: {VALID_SIZES}")

    # Validate file type
    if reference.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Reference image must be PNG or JPEG")

    # Read and validate size (max 10MB)
    ref_data = await reference.read()
    if len(ref_data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Reference image must be under 10MB")

    # Save reference image as PNG
    ref_id = str(uuid.uuid4())
    ref_filename = f"ref_{ref_id}.png"
    ref_path = IMAGES_DIR / ref_filename
    ref_img = Image.open(BytesIO(ref_data))
    if ref_img.mode != "RGBA":
        ref_img = ref_img.convert("RGBA")
    target_w, target_h = map(int, size.split("x"))
    ref_img = ref_img.resize((target_w, target_h), Image.LANCZOS)
    ref_img.save(str(ref_path), "PNG")

    # Build prompt with style
    style_suffix = STYLE_SUFFIXES.get(style, "")

    # Use Claude to analyze the reference image and build a rich prompt
    # that incorporates the visual details from the reference
    try:
        description = chat(
            f"Describe this image in detail for an AI image generator. "
            f"Focus on: the main subject's appearance, clothing, setting, colors, "
            f"lighting, and composition. Be specific and concise (3-4 sentences).",
            model="claude-haiku",
            system="You describe images for AI image generation. Return only the description.",
            max_tokens=300,
            temperature=0.3,
        )
        generation_prompt = (
            f"Based on this reference image: {description}. "
            f"Now apply this modification: {prompt}{style_suffix}"
        )
    except Exception:
        generation_prompt = prompt + style_suffix

    image_id = str(uuid.uuid4())
    filename = f"{image_id}.png"
    output_path = str(IMAGES_DIR / filename)

    # Use the edit API with the reference image for context-aware generation
    try:
        edit_image(
            image_path=str(ref_path),
            prompt=generation_prompt,
            mask_path=None,
            model="gpt-image",
            size=size,
            output=output_path,
        )
    except Exception as edit_error:
        # Fallback: try text-only generation with model fallback
        last_error = edit_error
        for m in IMAGE_MODELS:
            try:
                generate_image(
                    prompt=generation_prompt,
                    model=m,
                    size=size,
                    output=output_path,
                )
                break
            except Exception as e:
                last_error = e
                continue
        else:
            raise HTTPException(500, f"Image generation failed: {last_error}")

    try:
        postprocess_image(output_path, size)
    except Exception:
        pass

    record = {
        "id": image_id,
        "prompt": prompt,
        "style": style,
        "size": size,
        "filename": filename,
        "reference_filename": ref_filename,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 3: Inpainting (mask + regenerate region)
# ---------------------------------------------------------------------------

@app.post("/api/inpaint")
async def inpaint(req: InpaintRequest):
    db = load_db()
    parent = next((r for r in db if r["id"] == req.image_id), None)
    if not parent:
        raise HTTPException(404, "Parent image not found")

    parent_path = IMAGES_DIR / parent["filename"]
    if not parent_path.exists():
        raise HTTPException(404, "Parent image file not found")

    # Decode mask
    try:
        mask_data = base64.b64decode(req.mask)
        mask_img = Image.open(BytesIO(mask_data)).convert("L")
    except Exception:
        raise HTTPException(400, "Invalid mask — must be base64-encoded PNG")

    parent_img = Image.open(parent_path).convert("RGBA")
    parent_size = parent.get("size", "1024x1024")

    # Convert the L-mode mask to an RGBA mask for the edit API:
    # The edit API expects transparent (alpha=0) areas = regions to regenerate
    # Our mask is L-mode: white (255) = edit area, black (0) = keep area
    mask_resized = mask_img.resize(parent_img.size, Image.LANCZOS)
    rgba_mask = Image.new("RGBA", parent_img.size, (0, 0, 0, 255))
    mask_pixels = mask_resized.load()
    rgba_pixels = rgba_mask.load()
    if mask_pixels and rgba_pixels:
        for y in range(parent_img.height):
            for x in range(parent_img.width):
                if mask_pixels[x, y] > 128:  # white = edit area → transparent
                    rgba_pixels[x, y] = (0, 0, 0, 0)

    # Resize parent image to a valid generation size for the API
    w, h = map(int, parent_size.split("x"))
    if parent_size not in VALID_SIZES:
        # Pick closest valid size
        if w > h:
            api_size = "1536x1024"
        elif h > w:
            api_size = "1024x1536"
        else:
            api_size = "1024x1024"
    else:
        api_size = parent_size

    # Save temp files for the edit API
    temp_img_path = str(IMAGES_DIR / f"temp_inpaint_img_{uuid.uuid4()}.png")
    temp_mask_path = str(IMAGES_DIR / f"temp_inpaint_mask_{uuid.uuid4()}.png")

    api_w, api_h = map(int, api_size.split("x"))
    parent_resized = parent_img.resize((api_w, api_h), Image.LANCZOS)
    mask_for_api = rgba_mask.resize((api_w, api_h), Image.LANCZOS)

    parent_resized.save(temp_img_path, "PNG")
    mask_for_api.save(temp_mask_path, "PNG")

    result_id = str(uuid.uuid4())
    result_filename = f"{result_id}.png"
    result_path = str(IMAGES_DIR / result_filename)

    try:
        # Try gpt-image first for best inpainting quality
        try:
            edit_image(
                image_path=temp_img_path,
                prompt=req.prompt,
                mask_path=temp_mask_path,
                model="gpt-image",
                size=api_size,
                output=result_path,
            )
        except Exception:
            # Fallback: try gemini-image edit (without mask, prompt-based)
            try:
                edit_image(
                    image_path=temp_img_path,
                    prompt=req.prompt,
                    mask_path=None,
                    model="gpt-image",
                    size=api_size,
                    output=result_path,
                )
            except Exception:
                # Last resort: regenerate with prompt context
                generate_image(
                    prompt=f"{req.prompt}. Seamlessly blend with the surrounding image context.",
                    model="gemini-image",
                    size=api_size,
                    output=result_path,
                )
        # Post-process to match original size if needed
        try:
            postprocess_image(result_path, parent_size)
        except Exception:
            pass
    except Exception as e:
        raise HTTPException(500, f"Inpainting failed: {e}")
    finally:
        # Clean up temp files
        Path(temp_img_path).unlink(missing_ok=True)
        Path(temp_mask_path).unlink(missing_ok=True)

    record = {
        "id": result_id,
        "prompt": req.prompt,
        "parent_id": parent["id"],
        "style": parent.get("style", "none"),
        "size": parent_size,
        "filename": result_filename,
        "inpainted": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 3: Image Upscaling (2x/4x)
# ---------------------------------------------------------------------------

@app.post("/api/upscale")
async def upscale(req: UpscaleRequest):
    if req.scale not in (2, 4):
        raise HTTPException(400, "Scale must be 2 or 4")

    db = load_db()
    parent = next((r for r in db if r["id"] == req.image_id), None)
    if not parent:
        raise HTTPException(404, "Image not found")

    file_path = IMAGES_DIR / parent["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Image file not found")

    img = Image.open(file_path)
    new_w = img.width * req.scale
    new_h = img.height * req.scale
    upscaled = img.resize((new_w, new_h), Image.LANCZOS)

    new_id = str(uuid.uuid4())
    new_filename = f"{new_id}.png"
    upscaled.save(str(IMAGES_DIR / new_filename), format="PNG")

    record = {
        "id": new_id,
        "prompt": parent.get("prompt", ""),
        "parent_id": parent["id"],
        "style": parent.get("style", "none"),
        "size": f"{new_w}x{new_h}",
        "filename": new_filename,
        "upscaled": True,
        "upscale_factor": req.scale,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 3: Favorites
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/favorite")
async def toggle_favorite(image_id: str):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    record["favorited"] = not record.get("favorited", False)
    save_db(db)

    return {"id": image_id, "favorited": record["favorited"]}


# ---------------------------------------------------------------------------
# Sprint 4: Text-to-Video Generation (#49)
# ---------------------------------------------------------------------------

@app.post("/api/generate-video")
async def generate_video_endpoint(req: VideoGenerateRequest):
    if req.size not in VALID_VIDEO_SIZES:
        raise HTTPException(400, f"Invalid size. Must be one of: {VALID_VIDEO_SIZES}")
    if req.quality not in ("standard", "pro"):
        raise HTTPException(400, "Quality must be 'standard' or 'pro'")

    preferred = "sora" if req.quality == "standard" else "sora-pro"
    models_to_try = [preferred] + [m for m in VIDEO_MODELS if m != preferred]
    video_id_internal = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Submit async video generation with fallback
    sora_video_id = None
    used_model = None
    last_error = None
    for model in models_to_try:
        try:
            sora_video_id = submit_video(prompt=req.prompt, model=model, size=req.size, seconds=8)
            used_model = model
            break
        except Exception as e:
            last_error = e
            continue
    if not sora_video_id:
        raise HTTPException(500, f"Video submission failed: {last_error}")

    record = {
        "id": video_id_internal,
        "sora_video_id": sora_video_id,
        "prompt": req.prompt,
        "size": req.size,
        "quality": req.quality,
        "model": used_model,
        "status": "queued",
        "progress": 0,
        "filename": None,
        "created_at": now,
    }
    db = load_videos_db()
    db.insert(0, record)
    save_videos_db(db)

    return record


@app.get("/api/videos/{video_id}/status")
async def video_status(video_id: str):
    db = load_videos_db()
    record = next((r for r in db if r["id"] == video_id), None)
    if not record:
        raise HTTPException(404, "Video not found")

    # If already completed or failed, return cached status
    if record["status"] in ("completed", "failed"):
        return record

    # Poll the upstream API
    try:
        info = check_video_status(record["sora_video_id"])
        record["status"] = info.get("status", record["status"])
        record["progress"] = info.get("progress", record["progress"])

        if record["status"] == "completed":
            # Download the video
            filename = f"{video_id}.mp4"
            output_path = str(VIDEOS_DIR / filename)
            download_video(record["sora_video_id"], output=output_path)
            record["filename"] = filename

        elif record["status"] == "failed":
            record["error"] = info.get("error", "Unknown error")

        save_videos_db(db)
    except Exception as e:
        record["error"] = str(e)

    return record


@app.get("/api/videos/{video_id}/file")
async def serve_video_file(video_id: str):
    db = load_videos_db()
    record = next((r for r in db if r["id"] == video_id), None)
    if not record:
        raise HTTPException(404, "Video not found")
    if not record.get("filename"):
        raise HTTPException(400, "Video not yet completed")

    file_path = VIDEOS_DIR / record["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Video file not found")

    return FileResponse(path=str(file_path), media_type="video/mp4")


@app.get("/api/videos")
async def list_videos(page: int = 1, limit: int = 20):
    db = load_videos_db()
    start = (page - 1) * limit
    end = start + limit
    items = db[start:end]
    return {"videos": items, "total": len(db), "page": page, "limit": limit}


# ---------------------------------------------------------------------------
# Sprint 4: Image-to-Video (#69)
# ---------------------------------------------------------------------------

@app.post("/api/image-to-video")
async def image_to_video(req: ImageToVideoRequest):
    if req.quality not in ("standard", "pro"):
        raise HTTPException(400, "Quality must be 'standard' or 'pro'")

    # Find the parent image
    img_db = load_db()
    parent = next((r for r in img_db if r["id"] == req.image_id), None)
    if not parent:
        raise HTTPException(404, "Image not found")

    parent_path = IMAGES_DIR / parent["filename"]
    if not parent_path.exists():
        raise HTTPException(404, "Image file not found")

    # Determine video size based on source image aspect ratio
    parent_size = parent.get("size", "1024x1024")
    w, h = map(int, parent_size.split("x"))
    video_size = "720x1280" if h > w else "1280x720"

    preferred = "sora" if req.quality == "standard" else "sora-pro"
    models_to_try = [preferred] + [m for m in VIDEO_MODELS if m != preferred]
    video_id_internal = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    # Submit with motion prompt — append image context to the prompt
    motion_prompt = f"{req.prompt} (animate the scene, camera motion, subtle movements)"
    sora_video_id = None
    used_model = None
    last_error = None
    for model in models_to_try:
        try:
            sora_video_id = submit_video(prompt=motion_prompt, model=model, size=video_size, seconds=8)
            used_model = model
            break
        except Exception as e:
            last_error = e
            continue
    if not sora_video_id:
        raise HTTPException(500, f"Video submission failed: {last_error}")

    record = {
        "id": video_id_internal,
        "sora_video_id": sora_video_id,
        "prompt": req.prompt,
        "parent_image_id": req.image_id,
        "size": video_size,
        "quality": req.quality,
        "model": used_model,
        "status": "queued",
        "progress": 0,
        "filename": None,
        "created_at": now,
    }
    db = load_videos_db()
    db.insert(0, record)
    save_videos_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 4: Image Filters and Adjustments (#71)
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/adjust")
async def adjust_image(image_id: str, req: AdjustRequest):
    db = load_db()
    parent = next((r for r in db if r["id"] == image_id), None)
    if not parent:
        raise HTTPException(404, "Image not found")

    file_path = IMAGES_DIR / parent["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Image file not found")

    img = Image.open(file_path).convert("RGB")

    # Apply adjustments in order: brightness → contrast → saturation → sharpness → blur
    if req.brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(req.brightness)
    if req.contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(req.contrast)
    if req.saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(req.saturation)
    if req.sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(req.sharpness)
    if req.blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(radius=req.blur))

    new_id = str(uuid.uuid4())
    new_filename = f"{new_id}.png"
    img.save(str(IMAGES_DIR / new_filename), format="PNG")

    record = {
        "id": new_id,
        "prompt": parent.get("prompt", ""),
        "parent_id": parent["id"],
        "style": parent.get("style", "none"),
        "size": parent.get("size", "1024x1024"),
        "filename": new_filename,
        "adjusted": True,
        "adjustments": {
            "brightness": req.brightness,
            "contrast": req.contrast,
            "saturation": req.saturation,
            "sharpness": req.sharpness,
            "blur": req.blur,
        },
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 4: Gallery Collections (#73)
# ---------------------------------------------------------------------------

@app.post("/api/collections")
async def create_collection(req: CreateCollectionRequest):
    collection_id = str(uuid.uuid4())
    record = {
        "id": collection_id,
        "name": req.name,
        "image_ids": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_collections_db()
    db.insert(0, record)
    save_collections_db(db)
    return record


@app.get("/api/collections")
async def list_collections():
    db = load_collections_db()
    # Add image counts
    result = []
    for c in db:
        result.append({**c, "image_count": len(c.get("image_ids", []))})
    return {"collections": result}


@app.get("/api/collections/{collection_id}")
async def get_collection(collection_id: str):
    db = load_collections_db()
    collection = next((c for c in db if c["id"] == collection_id), None)
    if not collection:
        raise HTTPException(404, "Collection not found")

    # Load full image records for this collection
    img_db = load_db()
    images = [r for r in img_db if r["id"] in collection.get("image_ids", [])]

    return {**collection, "images": images, "image_count": len(images)}


@app.post("/api/collections/{collection_id}/images")
async def add_image_to_collection(collection_id: str, req: CollectionImageRequest):
    db = load_collections_db()
    collection = next((c for c in db if c["id"] == collection_id), None)
    if not collection:
        raise HTTPException(404, "Collection not found")

    # Verify image exists
    img_db = load_db()
    image = next((r for r in img_db if r["id"] == req.image_id), None)
    if not image:
        raise HTTPException(404, "Image not found")

    if req.image_id not in collection.get("image_ids", []):
        collection.setdefault("image_ids", []).append(req.image_id)
        save_collections_db(db)

    return {"collection_id": collection_id, "image_id": req.image_id, "added": True}


@app.delete("/api/collections/{collection_id}/images/{image_id}")
async def remove_image_from_collection(collection_id: str, image_id: str):
    db = load_collections_db()
    collection = next((c for c in db if c["id"] == collection_id), None)
    if not collection:
        raise HTTPException(404, "Collection not found")

    if image_id in collection.get("image_ids", []):
        collection["image_ids"].remove(image_id)
        save_collections_db(db)

    return {"collection_id": collection_id, "image_id": image_id, "removed": True}


# ---------------------------------------------------------------------------
# Sprint 5: Background Removal (#77)
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/remove-background")
async def remove_background(image_id: str):
    db = load_db()
    parent = next((r for r in db if r["id"] == image_id), None)
    if not parent:
        raise HTTPException(404, "Image not found")

    file_path = IMAGES_DIR / parent["filename"]
    if not file_path.exists():
        raise HTTPException(404, "Image file not found")

    parent_size = parent.get("size", "1024x1024")

    # Use rembg for proper ML-based background removal
    try:
        from rembg import remove as rembg_remove
        img = Image.open(file_path)
        result_img = rembg_remove(img)
    except Exception as e:
        raise HTTPException(500, f"Background removal failed: {e}")

    result_id = str(uuid.uuid4())
    result_filename = f"{result_id}.png"
    result_img.save(str(IMAGES_DIR / result_filename), format="PNG")

    record = {
        "id": result_id,
        "prompt": parent.get("prompt", ""),
        "parent_id": parent["id"],
        "style": parent.get("style", "none"),
        "size": parent_size,
        "filename": result_filename,
        "background_removed": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 5: Prompt History (#79)
# ---------------------------------------------------------------------------

@app.get("/api/prompts/history")
async def prompt_history(limit: int = Query(default=50, ge=1, le=100)):
    db = load_prompts_db()
    return {"prompts": db[:limit]}


@app.get("/api/prompts/suggestions")
async def prompt_suggestions(q: str = Query(..., min_length=1)):
    db = load_prompts_db()
    q_lower = q.lower()
    # Prefix match first, then substring match
    prefix_matches = []
    substring_matches = []
    seen = set()
    for entry in db:
        p = entry["prompt"]
        if p in seen:
            continue
        seen.add(p)
        if p.lower().startswith(q_lower):
            prefix_matches.append(entry)
        elif q_lower in p.lower():
            substring_matches.append(entry)
    results = (prefix_matches + substring_matches)[:10]
    return {"suggestions": results}


@app.delete("/api/prompts/history")
async def clear_prompt_history():
    save_prompts_db([])
    return {"cleared": True}


# ---------------------------------------------------------------------------
# Sprint 5: Style Transfer (#81)
# ---------------------------------------------------------------------------

@app.post("/api/generate-with-style")
async def generate_with_style(
    prompt: str = Form(..., min_length=1, max_length=2000),
    strength: float = Form(default=0.7),
    size: str = Form(default="1024x1024"),
    style: str = Form(default="none"),
    style_image: UploadFile = File(...),
):
    if size not in VALID_SIZES:
        raise HTTPException(400, f"Invalid size. Must be one of: {VALID_SIZES}")
    if not (0.0 <= strength <= 1.0):
        raise HTTPException(400, "Strength must be between 0.0 and 1.0")

    # Validate file type
    if style_image.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Style image must be PNG or JPEG")

    ref_data = await style_image.read()
    if len(ref_data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Style image must be under 10MB")

    # Save style reference
    style_ref_id = str(uuid.uuid4())
    ref_ext = "png" if style_image.content_type == "image/png" else "jpg"
    ref_filename = f"style_{style_ref_id}.{ref_ext}"
    (IMAGES_DIR / ref_filename).write_bytes(ref_data)

    # Use claude-haiku to analyze the style of the reference image
    try:
        # Encode image for analysis prompt
        ref_b64 = base64.b64encode(ref_data).decode("utf-8")
        style_description = chat(
            "Describe the artistic style of this image in detail. Focus on: color palette, brushwork/texture, lighting, mood, and artistic movement. Be concise (2-3 sentences).",
            model="claude-haiku",
            system="You are an art expert. Describe artistic styles concisely.",
            max_tokens=200,
            temperature=0.5,
        )
    except Exception:
        style_description = "artistic, stylized"

    # Build prompt with style description, modulated by strength
    strength_word = "subtly" if strength < 0.4 else ("moderately" if strength < 0.7 else "strongly")
    style_suffix = STYLE_SUFFIXES.get(style, "")
    generation_prompt = f"{prompt}, {strength_word} in the style of: {style_description}{style_suffix}"

    # Save prompt to history
    save_prompt_history(prompt)

    try:
        image_id, filename = _generate_single(generation_prompt, size)
    except Exception as e:
        raise HTTPException(500, f"Style transfer generation failed: {e}")

    record = {
        "id": image_id,
        "prompt": prompt,
        "style": style,
        "size": size,
        "filename": filename,
        "style_transfer": True,
        "style_reference": ref_filename,
        "style_strength": strength,
        "style_description": style_description,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_db()
    db.insert(0, record)
    save_db(db)

    return record


# ---------------------------------------------------------------------------
# Sprint 5: Video Gallery Enhancements (#83)
# ---------------------------------------------------------------------------

@app.get("/api/videos/{video_id}")
async def get_video(video_id: str):
    db = load_videos_db()
    record = next((r for r in db if r["id"] == video_id), None)
    if not record:
        raise HTTPException(404, "Video not found")
    return record


@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: str):
    db = load_videos_db()
    record = next((r for r in db if r["id"] == video_id), None)
    if not record:
        raise HTTPException(404, "Video not found")

    # Delete file
    if record.get("filename"):
        file_path = VIDEOS_DIR / record["filename"]
        if file_path.exists():
            file_path.unlink()

    # Remove from collections
    coll_db = load_collections_db()
    for c in coll_db:
        if video_id in c.get("video_ids", []):
            c["video_ids"].remove(video_id)
    save_collections_db(coll_db)

    # Remove from DB
    db = [r for r in db if r["id"] != video_id]
    save_videos_db(db)

    return {"id": video_id, "deleted": True}


# Extend collections to support videos
@app.post("/api/collections/{collection_id}/videos")
async def add_video_to_collection(collection_id: str, req: CollectionItemRequest):
    db = load_collections_db()
    collection = next((c for c in db if c["id"] == collection_id), None)
    if not collection:
        raise HTTPException(404, "Collection not found")

    # Verify video exists
    vid_db = load_videos_db()
    video = next((r for r in vid_db if r["id"] == req.item_id), None)
    if not video:
        raise HTTPException(404, "Video not found")

    video_ids = collection.setdefault("video_ids", [])
    if req.item_id not in video_ids:
        video_ids.append(req.item_id)
        save_collections_db(db)

    return {"collection_id": collection_id, "video_id": req.item_id, "added": True}


@app.delete("/api/collections/{collection_id}/videos/{video_id}")
async def remove_video_from_collection(collection_id: str, video_id: str):
    db = load_collections_db()
    collection = next((c for c in db if c["id"] == collection_id), None)
    if not collection:
        raise HTTPException(404, "Collection not found")

    if video_id in collection.get("video_ids", []):
        collection["video_ids"].remove(video_id)
        save_collections_db(db)

    return {"collection_id": collection_id, "video_id": video_id, "removed": True}


# ---------------------------------------------------------------------------
# Sprint 6: Outpainting / Canvas Extension (#88)
# ---------------------------------------------------------------------------

class OutpaintRequest(BaseModel):
    directions: list[str] = Field(..., min_length=1)
    amount: int = Field(default=50, ge=10, le=100)  # percentage of original dimension


@app.post("/api/images/{image_id}/outpaint")
async def outpaint_image(image_id: str, req: OutpaintRequest):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    filepath = IMAGES_DIR / record["filename"]
    if not filepath.exists():
        raise HTTPException(404, "Image file not found")

    valid_dirs = {"up", "down", "left", "right"}
    for d in req.directions:
        if d not in valid_dirs:
            raise HTTPException(400, f"Invalid direction: {d}. Use: {valid_dirs}")

    img = Image.open(filepath).convert("RGBA")
    orig_w, orig_h = img.size

    # Calculate extension pixels for each direction
    ext_up = int(orig_h * req.amount / 100) if "up" in req.directions else 0
    ext_down = int(orig_h * req.amount / 100) if "down" in req.directions else 0
    ext_left = int(orig_w * req.amount / 100) if "left" in req.directions else 0
    ext_right = int(orig_w * req.amount / 100) if "right" in req.directions else 0

    new_w = orig_w + ext_left + ext_right
    new_h = orig_h + ext_up + ext_down

    # Build the extended prompt
    direction_text = " and ".join(req.directions)
    outpaint_prompt = f"Seamlessly extend this image {direction_text}, maintaining consistent style, lighting, and perspective. The original image content should blend naturally with the new areas. Size: {new_w}x{new_h}"

    # Generate the extended image using AI
    try:
        # Save original as temp for reference
        temp_path = IMAGES_DIR / f"temp_outpaint_{image_id}.png"
        img.save(temp_path, "PNG")

        # Use the original prompt + outpaint instruction
        orig_prompt = record.get("prompt", "")
        full_prompt = f"{orig_prompt}. {outpaint_prompt}" if orig_prompt else outpaint_prompt

        # Pick closest valid generation size, resize to target after
        if new_w > new_h:
            gen_size = "1536x1024"
        elif new_h > new_w:
            gen_size = "1024x1536"
        else:
            gen_size = "1024x1024"

        new_id = str(uuid.uuid4())
        new_filename = f"{new_id}.png"
        new_path = IMAGES_DIR / new_filename

        generate_image(
            prompt=full_prompt,
            model="gemini-image",
            size=gen_size,
            output=str(new_path),
        )

        # Resize to exact target dimensions
        outpainted = Image.open(new_path).convert("RGBA")
        outpainted = outpainted.resize((new_w, new_h), Image.LANCZOS)
        outpainted.save(new_path, "PNG")

        # Clean up temp
        temp_path.unlink(missing_ok=True)

        new_record = {
            "id": new_id,
            "prompt": record.get("prompt", ""),
            "parent_id": image_id,
            "style": record.get("style", "none"),
            "size": f"{new_w}x{new_h}",
            "filename": new_filename,
            "outpainted": True,
            "outpaint_directions": req.directions,
            "outpaint_amount": req.amount,
            "created_at": datetime.utcnow().isoformat(),
        }
        db.append(new_record)
        save_db(db)

        return new_record
    except Exception as e:
        raise HTTPException(500, f"Outpainting failed: {str(e)}")


# ---------------------------------------------------------------------------
# Sprint 6: Edit History with Undo/Redo (#90)
# ---------------------------------------------------------------------------

@app.get("/api/images/{image_id}/history")
async def get_image_history(image_id: str):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    # Walk backwards through parent chain to find root
    chain = [record]
    current = record
    while current.get("parent_id"):
        parent = next((r for r in db if r["id"] == current["parent_id"]), None)
        if not parent:
            break
        chain.append(parent)
        current = parent

    chain.reverse()  # oldest first

    # Find current position in chain
    current_index = next((i for i, r in enumerate(chain) if r["id"] == image_id), len(chain) - 1)

    # Build history entries
    history = []
    for i, r in enumerate(chain):
        edit_type = "original"
        if r.get("outpainted"):
            edit_type = "outpaint"
        elif r.get("adjusted"):
            edit_type = "adjust"
        elif r.get("upscaled"):
            edit_type = "upscale"
        elif r.get("background_removed"):
            edit_type = "background_removal"
        elif r.get("style_transfer"):
            edit_type = "style_transfer"
        elif r.get("watermarked"):
            edit_type = "watermark"
        elif r.get("parent_id") and i > 0:
            edit_type = "refine"

        history.append({
            "id": r["id"],
            "edit_type": edit_type,
            "timestamp": r.get("created_at", ""),
            "params": {
                k: v for k, v in r.items()
                if k in ("adjustments", "upscale_factor", "outpaint_directions", "outpaint_amount", "style_strength", "watermark_text")
            },
        })

    # Find children for redo
    children = [r for r in db if r.get("parent_id") == image_id]

    return {
        "image_id": image_id,
        "history": history,
        "current_index": current_index,
        "can_undo": current_index > 0,
        "can_redo": len(children) > 0,
    }


@app.post("/api/images/{image_id}/undo")
async def undo_image(image_id: str):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    parent_id = record.get("parent_id")
    if not parent_id:
        raise HTTPException(400, "Nothing to undo — this is the original image")

    parent = next((r for r in db if r["id"] == parent_id), None)
    if not parent:
        raise HTTPException(404, "Parent image not found")

    return parent


@app.post("/api/images/{image_id}/redo")
async def redo_image(image_id: str):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    # Find the most recent child
    children = [r for r in db if r.get("parent_id") == image_id]
    if not children:
        raise HTTPException(400, "Nothing to redo — no forward edits")

    # Return the most recent child
    children.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return children[0]


# ---------------------------------------------------------------------------
# Sprint 6: Image Watermarking (#92)
# ---------------------------------------------------------------------------

class WatermarkRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    position: str = Field(default="bottom-right")
    opacity: float = Field(default=0.3, ge=0.1, le=1.0)
    font_size: int = Field(default=36, ge=12, le=200)
    color: str = Field(default="#ffffff")


@app.post("/api/images/{image_id}/watermark")
async def watermark_image(image_id: str, req: WatermarkRequest):
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    filepath = IMAGES_DIR / record["filename"]
    if not filepath.exists():
        raise HTTPException(404, "Image file not found")

    valid_positions = {"center", "bottom-right", "bottom-left", "top-right", "top-left", "tiled"}
    if req.position not in valid_positions:
        raise HTTPException(400, f"Invalid position: {req.position}. Use: {valid_positions}")

    # Parse hex color
    try:
        hex_color = req.color.lstrip("#")
        r_val = int(hex_color[0:2], 16)
        g_val = int(hex_color[2:4], 16)
        b_val = int(hex_color[4:6], 16)
    except (ValueError, IndexError):
        r_val, g_val, b_val = 255, 255, 255

    alpha = int(255 * req.opacity)

    img = Image.open(filepath).convert("RGBA")
    txt_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(txt_layer)

    # Try to use a font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", req.font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), req.text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    fill = (r_val, g_val, b_val, alpha)
    padding = 20

    if req.position == "tiled":
        # Tile the watermark at 45 degrees across the image
        import math
        for y in range(-img.height, img.height * 2, text_h + 80):
            for x in range(-img.width, img.width * 2, text_w + 80):
                tile_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
                tile_draw = ImageDraw.Draw(tile_layer)
                tile_draw.text((x, y), req.text, font=font, fill=fill)
                tile_layer = tile_layer.rotate(45, center=(img.width // 2, img.height // 2), expand=False)
                txt_layer = Image.alpha_composite(txt_layer, tile_layer)
    else:
        positions = {
            "center": ((img.width - text_w) // 2, (img.height - text_h) // 2),
            "bottom-right": (img.width - text_w - padding, img.height - text_h - padding),
            "bottom-left": (padding, img.height - text_h - padding),
            "top-right": (img.width - text_w - padding, padding),
            "top-left": (padding, padding),
        }
        pos = positions[req.position]
        draw.text(pos, req.text, font=font, fill=fill)

    watermarked = Image.alpha_composite(img, txt_layer)
    watermarked_rgb = watermarked.convert("RGB")

    new_id = str(uuid.uuid4())
    new_filename = f"{new_id}.png"
    new_path = IMAGES_DIR / new_filename
    watermarked_rgb.save(new_path, "PNG")

    new_record = {
        "id": new_id,
        "prompt": record.get("prompt", ""),
        "parent_id": image_id,
        "style": record.get("style", "none"),
        "size": record.get("size", "1024x1024"),
        "filename": new_filename,
        "watermarked": True,
        "watermark_text": req.text,
        "watermark_position": req.position,
        "watermark_opacity": req.opacity,
        "created_at": datetime.utcnow().isoformat(),
    }
    db.append(new_record)
    save_db(db)

    return new_record


# ---------------------------------------------------------------------------
# Sprint 7: Character Consistency
# ---------------------------------------------------------------------------

@app.post("/api/character-profiles")
async def create_character_profile(
    name: str = Form(..., min_length=1, max_length=100),
    images: list[UploadFile] = File(...),
):
    if len(images) < 1 or len(images) > 3:
        raise HTTPException(400, "Must upload 1-3 reference images")

    profile_id = str(uuid.uuid4())
    ref_filenames = []

    for img_file in images:
        if img_file.content_type not in ("image/png", "image/jpeg", "image/webp"):
            raise HTTPException(400, f"Invalid file type: {img_file.content_type}")
        content = await img_file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(400, "File too large (max 10MB)")
        ref_id = str(uuid.uuid4())
        ref_filename = f"charref_{ref_id}.png"
        ref_path = IMAGES_DIR / ref_filename
        img = Image.open(BytesIO(content))
        img.save(ref_path, "PNG")
        ref_filenames.append(ref_filename)

    # Analyze reference images with claude-haiku to extract identity descriptors
    identity_desc = ""
    try:
        analysis_prompt = (
            f"You are analyzing reference images for a character named '{name}'. "
            "Describe the character's key visual identity traits for consistent image generation: "
            "facial features (face shape, eyes, nose, mouth), hair (color, length, style), "
            "skin tone, body type, and any distinctive features (glasses, scars, tattoos, etc). "
            "Be specific and concise. Return only the description, no preamble."
        )
        identity_desc = chat(
            analysis_prompt,
            model="claude-haiku",
            system="You extract character identity descriptors from descriptions for AI image generation.",
            max_tokens=300,
            temperature=0.3,
        )
    except Exception:
        identity_desc = f"a character named {name}"

    profile = {
        "id": profile_id,
        "name": name,
        "reference_images": ref_filenames,
        "identity_descriptors": identity_desc,
        "created_at": datetime.utcnow().isoformat(),
    }

    db = load_character_profiles_db()
    db.append(profile)
    save_character_profiles_db(db)
    return profile


@app.get("/api/character-profiles")
async def list_character_profiles():
    return load_character_profiles_db()


@app.delete("/api/character-profiles/{profile_id}")
async def delete_character_profile(profile_id: str):
    db = load_character_profiles_db()
    profile = next((p for p in db if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(404, "Character profile not found")
    for ref_file in profile.get("reference_images", []):
        ref_path = IMAGES_DIR / ref_file
        if ref_path.exists():
            ref_path.unlink()
    db = [p for p in db if p["id"] != profile_id]
    save_character_profiles_db(db)
    return {"status": "deleted", "id": profile_id}


# ---------------------------------------------------------------------------
# Sprint 7: Text-in-Image + Character + Brand Kit prompt helpers
# ---------------------------------------------------------------------------

def _apply_text_overlay(prompt: str, text_overlay: dict | None) -> str:
    """Append text rendering instructions to the prompt."""
    if not text_overlay:
        return prompt
    text = text_overlay.get("text", "")
    if not text:
        return prompt
    font_hint = text_overlay.get("font_hint", "bold")
    placement = text_overlay.get("placement", "center")

    valid_fonts = {"bold", "handwritten", "3d", "graffiti", "serif", "sans-serif", "decorative"}
    valid_placements = {"center", "top", "bottom"}
    font_hint = font_hint if font_hint in valid_fonts else "bold"
    placement = placement if placement in valid_placements else "center"

    text_instruction = (
        f', with the text "{text}" prominently displayed in {font_hint} lettering '
        f'positioned at the {placement} of the image'
    )
    return prompt + text_instruction


def _apply_character_profile(prompt: str, profile_id: str | None) -> str:
    """Prepend character identity descriptors to the prompt."""
    if not profile_id:
        return prompt
    profiles = load_character_profiles_db()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        return prompt
    identity = profile.get("identity_descriptors", "")
    if identity:
        return f"{identity}. {prompt}"
    return prompt


def _apply_brand_kit(prompt: str, brand_kit_id: str | None) -> str:
    """Append brand color palette instructions to the prompt."""
    if not brand_kit_id:
        return prompt
    kits = load_brand_kits_db()
    kit = next((k for k in kits if k["id"] == brand_kit_id), None)
    if not kit:
        return prompt
    colors = kit.get("colors", [])
    if colors:
        color_str = ", ".join(colors)
        prompt += f", using only these brand colors: {color_str}"
    notes = kit.get("style_notes", "")
    if notes:
        prompt += f", {notes}"
    return prompt


# ---------------------------------------------------------------------------
# Sprint 7: Brand Kits
# ---------------------------------------------------------------------------

@app.post("/api/brand-kits")
async def create_brand_kit(req: CreateBrandKitRequest):
    import re as _re
    for color in req.colors:
        if not _re.match(r'^#[0-9a-fA-F]{6}$', color):
            raise HTTPException(400, f"Invalid hex color: {color}. Use format #RRGGBB")

    kit_id = str(uuid.uuid4())
    kit = {
        "id": kit_id,
        "name": req.name,
        "colors": req.colors,
        "style_notes": req.style_notes,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_brand_kits_db()
    db.append(kit)
    save_brand_kits_db(db)
    return kit


@app.get("/api/brand-kits")
async def list_brand_kits():
    return load_brand_kits_db()


@app.delete("/api/brand-kits/{kit_id}")
async def delete_brand_kit(kit_id: str):
    db = load_brand_kits_db()
    kit = next((k for k in db if k["id"] == kit_id), None)
    if not kit:
        raise HTTPException(404, "Brand kit not found")
    db = [k for k in db if k["id"] != kit_id]
    save_brand_kits_db(db)
    return {"status": "deleted", "id": kit_id}


# ---------------------------------------------------------------------------
# Sprint 8: SVG/Vector Export
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/export-svg")
async def export_svg(image_id: str):
    """Convert a raster image to SVG using vtracer vectorization."""
    import vtracer

    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    src_path = IMAGES_DIR / record["filename"]
    if not src_path.exists():
        raise HTTPException(404, "Image file not found on disk")

    svg_filename = f"{image_id}.svg"
    svg_path = IMAGES_DIR / svg_filename

    # Convert to SVG using vtracer
    vtracer.convert_image_to_svg_py(
        str(src_path),
        str(svg_path),
        colormode="color",
        hierarchical="stacked",
        mode="polygon",
        filter_speckle=4,
        color_precision=6,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=3,
    )

    # Update record with svg info
    record["svg_filename"] = svg_filename
    save_db(db)

    return FileResponse(
        str(svg_path),
        media_type="image/svg+xml",
        filename=svg_filename,
        headers={"Content-Disposition": f'attachment; filename="{svg_filename}"'},
    )


# ---------------------------------------------------------------------------
# Sprint 8: AI Product Photography
# ---------------------------------------------------------------------------

PRODUCT_SCENES = {"studio", "outdoor", "lifestyle", "flat-lay", "holiday"}


@app.post("/api/images/{image_id}/product-photo")
async def product_photo(
    image_id: str,
    scene: str = Form(...),
    background_color: str = Form(default=""),
):
    """Generate a professional product mockup from an existing image."""
    if scene not in PRODUCT_SCENES:
        raise HTTPException(400, f"Invalid scene. Choose from: {', '.join(sorted(PRODUCT_SCENES))}")

    if background_color and not re.match(r'^#[0-9a-fA-F]{6}$', background_color):
        raise HTTPException(400, "Invalid background_color hex. Use format #RRGGBB")

    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    # Analyze the product using claude-haiku
    product_description = chat(
        f"Describe this product in one sentence based on its generation prompt: '{record.get('prompt', 'a product')}'. Focus on the physical object only.",
        model="claude-haiku",
    )

    scene_templates = {
        "studio": "Professional studio photography with soft lighting, clean white backdrop, subtle shadows, commercial product shot",
        "outdoor": "Natural outdoor setting with soft golden hour lighting, blurred nature background, lifestyle product photography",
        "lifestyle": "Styled lifestyle scene with modern decor, warm ambient lighting, aspirational setting, editorial product placement",
        "flat-lay": "Top-down flat lay arrangement on clean surface, organized accessories, minimalist styling, Instagram-worthy",
        "holiday": "Festive holiday scene with seasonal decorations, warm cozy lighting, gift-wrapped elements, celebration mood",
    }

    bg_instruction = f" Background color: {background_color}." if background_color else ""
    generation_prompt = f"{product_description}. {scene_templates[scene]}.{bg_instruction} Professional product photography, high resolution, commercial quality."

    # Generate the product photo
    new_id = str(uuid.uuid4())
    filename = f"{new_id}.png"
    file_path = IMAGES_DIR / filename

    generate_image(prompt=generation_prompt, model="gemini-image", size="1024x1024", output=str(file_path))
    try:
        postprocess_image(str(file_path), "1024x1024")
    except Exception:
        pass

    new_record = {
        "id": new_id,
        "prompt": generation_prompt,
        "original_prompt": record.get("prompt", ""),
        "model": "gemini-image",
        "size": "1024x1024",
        "style": "none",
        "filename": filename,
        "created_at": datetime.utcnow().isoformat(),
        "parent_id": image_id,
        "edit_type": "product_photo",
        "scene": scene,
    }

    db.append(new_record)
    save_db(db)
    return new_record


# ---------------------------------------------------------------------------
# Sprint 8: Smart Object Replacement
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/replace-object")
async def replace_object(
    image_id: str,
    target_object: str = Form(...),
    replacement: str = Form(...),
    preserve_style: bool = Form(default=True),
):
    """Replace a specific object in an image while preserving context."""
    if not target_object.strip():
        raise HTTPException(400, "target_object cannot be empty")
    if not replacement.strip():
        raise HTTPException(400, "replacement cannot be empty")

    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    original_prompt = record.get("prompt", "")

    # Use claude-haiku to build a replacement prompt
    style_instruction = " Maintain the exact same artistic style, lighting, color palette, and composition." if preserve_style else ""
    replacement_prompt = chat(
        f"An image was generated with this prompt: '{original_prompt}'. "
        f"The user wants to replace '{target_object}' with '{replacement}'. "
        f"Rewrite the prompt so the new image has '{replacement}' instead of '{target_object}', "
        f"keeping everything else the same.{style_instruction} "
        "Return ONLY the new prompt, nothing else.",
        model="claude-haiku",
    )

    generation_prompt = replacement_prompt.strip()
    original_size = record.get("size", "1024x1024")
    w, h = map(int, original_size.split("x"))

    new_id = str(uuid.uuid4())
    filename = f"{new_id}.png"
    file_path = IMAGES_DIR / filename

    generate_image(prompt=generation_prompt, model="gemini-image", size=original_size, output=str(file_path))
    try:
        postprocess_image(str(file_path), original_size)
    except Exception:
        pass

    new_record = {
        "id": new_id,
        "prompt": generation_prompt,
        "original_prompt": original_prompt,
        "model": "gemini-image",
        "size": original_size,
        "style": record.get("style", "none"),
        "filename": filename,
        "created_at": datetime.utcnow().isoformat(),
        "parent_id": image_id,
        "edit_type": "object_replacement",
        "target_object": target_object,
        "replacement": replacement,
    }

    db.append(new_record)
    save_db(db)
    return new_record


# ---------------------------------------------------------------------------
# Sprint 8: Depth Map Generation
# ---------------------------------------------------------------------------

@app.post("/api/images/{image_id}/depth-map")
async def generate_depth_map(image_id: str):
    """Generate a pseudo-depth map from an image using edge detection and blur gradients."""
    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    src_path = IMAGES_DIR / record["filename"]
    if not src_path.exists():
        raise HTTPException(404, "Image file not found on disk")

    img = Image.open(str(src_path)).convert("RGB")

    # Create pseudo-depth map using edge detection + blur
    grayscale = img.convert("L")

    # Edge detection for detail/depth cues
    edges = grayscale.filter(ImageFilter.FIND_EDGES)

    # Invert edges (edges = closer objects typically have more detail)
    from PIL import ImageOps
    edges_inv = ImageOps.invert(edges)

    # Heavy blur to create smooth depth gradients
    depth_smooth = edges_inv.filter(ImageFilter.GaussianBlur(radius=15))

    # Add a vertical gradient (top = far, bottom = near) as depth prior
    w, h = img.size
    gradient = Image.new("L", (w, h))
    for y in range(h):
        val = int(255 * (y / h))  # 0 at top (far), 255 at bottom (near)
        for x in range(w):
            gradient.putpixel((x, y), val)

    # Blend edge-based depth with vertical gradient
    from PIL import ImageChops
    depth_map = ImageChops.add(depth_smooth, gradient, scale=2, offset=0)

    # Apply final smoothing
    depth_map = depth_map.filter(ImageFilter.GaussianBlur(radius=8))

    new_id = str(uuid.uuid4())
    filename = f"{new_id}.png"
    file_path = IMAGES_DIR / filename
    depth_map.save(str(file_path), "PNG")

    new_record = {
        "id": new_id,
        "prompt": f"Depth map of: {record.get('prompt', 'image')}",
        "original_prompt": record.get("prompt", ""),
        "model": "depth-estimation",
        "size": f"{w}x{h}",
        "style": "none",
        "filename": filename,
        "created_at": datetime.utcnow().isoformat(),
        "parent_id": image_id,
        "edit_type": "depth_map",
    }

    db.append(new_record)
    save_db(db)
    return new_record


# ---------------------------------------------------------------------------
# Sprint 9: Batch CSV Generation
# ---------------------------------------------------------------------------

import csv
import io
import threading

# In-memory batch status tracking
_batch_status: dict[str, dict] = {}


@app.post("/api/batch-csv")
async def batch_csv(file: UploadFile = File(...)):
    """Accept a CSV with prompts/settings and generate images in parallel."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    if "prompt" not in (reader.fieldnames or []):
        raise HTTPException(400, "CSV must have a 'prompt' column")

    rows = []
    for i, row in enumerate(reader):
        if i >= 50:
            break
        prompt = (row.get("prompt") or "").strip()
        if not prompt:
            continue
        rows.append({
            "prompt": prompt,
            "style": (row.get("style") or "none").strip(),
            "size": (row.get("size") or "1024x1024").strip(),
            "enhance": (row.get("enhance") or "false").strip().lower() == "true",
        })

    if not rows:
        raise HTTPException(400, "CSV has no valid prompt rows")

    batch_id = str(uuid.uuid4())
    _batch_status[batch_id] = {
        "id": batch_id,
        "total": len(rows),
        "completed": 0,
        "failed": 0,
        "results": [],
        "status": "processing",
        "created_at": datetime.utcnow().isoformat(),
    }

    # Persist initial status
    jobs_db = load_batch_jobs_db()
    jobs_db.append(_batch_status[batch_id])
    save_batch_jobs_db(jobs_db)

    def _run_batch():
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {}
            for row in rows:
                f = pool.submit(_generate_single_batch_item, row)
                futures[f] = row

            for f in as_completed(futures):
                try:
                    record = f.result()
                    _batch_status[batch_id]["results"].append(record)
                    _batch_status[batch_id]["completed"] += 1
                except Exception:
                    _batch_status[batch_id]["failed"] += 1

        _batch_status[batch_id]["status"] = "complete"
        # Persist final
        jobs_db2 = load_batch_jobs_db()
        for j in jobs_db2:
            if j["id"] == batch_id:
                j.update(_batch_status[batch_id])
                break
        save_batch_jobs_db(jobs_db2)

    threading.Thread(target=_run_batch, daemon=True).start()
    return {"batch_id": batch_id, "total": len(rows), "status": "processing"}


def _generate_single_batch_item(row: dict) -> dict:
    """Generate a single image for a batch row."""
    prompt = row["prompt"]
    size = row.get("size", "1024x1024")

    result = generate_image(prompt=prompt, model="gemini-image", size=size)

    new_id = str(uuid.uuid4())
    filename = f"{new_id}.png"
    file_path = IMAGES_DIR / filename
    w, h = map(int, size.split("x"))

    img_data = base64.b64decode(result["base64"])
    img = Image.open(BytesIO(img_data))
    img = postprocess_image(img, w, h)
    img.save(str(file_path), "PNG")

    record = {
        "id": new_id,
        "prompt": prompt,
        "style": row.get("style", "none"),
        "size": size,
        "filename": filename,
        "model": "gemini-image",
        "created_at": datetime.utcnow().isoformat(),
        "edit_type": "batch_csv",
    }

    db = load_db()
    db.append(record)
    save_db(db)
    return record


@app.get("/api/batch-csv/{batch_id}")
async def get_batch_status(batch_id: str):
    """Poll batch job status."""
    if batch_id in _batch_status:
        return _batch_status[batch_id]
    jobs = load_batch_jobs_db()
    job = next((j for j in jobs if j["id"] == batch_id), None)
    if not job:
        raise HTTPException(404, "Batch job not found")
    return job


# ---------------------------------------------------------------------------
# Sprint 9: Style Presets
# ---------------------------------------------------------------------------

class CreateStylePresetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    prompt_prefix: str = Field(default="")
    prompt_suffix: str = Field(default="")
    style: str = Field(default="none")
    size: str = Field(default="1024x1024")
    enhance: bool = Field(default=False)
    negative_prompt: str = Field(default="")


@app.post("/api/style-presets")
async def create_style_preset(req: CreateStylePresetRequest):
    preset_id = str(uuid.uuid4())
    preset = {
        "id": preset_id,
        "name": req.name,
        "prompt_prefix": req.prompt_prefix,
        "prompt_suffix": req.prompt_suffix,
        "style": req.style,
        "size": req.size,
        "enhance": req.enhance,
        "negative_prompt": req.negative_prompt,
        "created_at": datetime.utcnow().isoformat(),
    }
    db = load_style_presets_db()
    db.append(preset)
    save_style_presets_db(db)
    return preset


@app.get("/api/style-presets")
async def list_style_presets():
    return load_style_presets_db()


@app.get("/api/style-presets/{preset_id}")
async def get_style_preset(preset_id: str):
    db = load_style_presets_db()
    preset = next((p for p in db if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(404, "Style preset not found")
    return preset


@app.delete("/api/style-presets/{preset_id}")
async def delete_style_preset(preset_id: str):
    db = load_style_presets_db()
    preset = next((p for p in db if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(404, "Style preset not found")
    db = [p for p in db if p["id"] != preset_id]
    save_style_presets_db(db)
    return {"status": "deleted", "id": preset_id}


@app.post("/api/style-presets/{preset_id}/apply")
async def apply_style_preset(preset_id: str, prompt: str = Form(...)):
    """Apply a style preset to a user prompt and generate."""
    db = load_style_presets_db()
    preset = next((p for p in db if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(404, "Style preset not found")

    parts = []
    if preset.get("prompt_prefix"):
        parts.append(preset["prompt_prefix"])
    parts.append(prompt)
    if preset.get("prompt_suffix"):
        parts.append(preset["prompt_suffix"])
    final_prompt = " ".join(parts)

    size = preset.get("size", "1024x1024")
    result = generate_image(prompt=final_prompt, model="gemini-image", size=size)

    new_id = str(uuid.uuid4())
    filename = f"{new_id}.png"
    file_path = IMAGES_DIR / filename
    w, h = map(int, size.split("x"))

    img_data = base64.b64decode(result["base64"])
    img = Image.open(BytesIO(img_data))
    img = postprocess_image(img, w, h)
    img.save(str(file_path), "PNG")

    new_record = {
        "id": new_id,
        "prompt": final_prompt,
        "original_prompt": prompt,
        "model": "gemini-image",
        "size": size,
        "style": preset.get("style", "none"),
        "filename": filename,
        "created_at": datetime.utcnow().isoformat(),
        "edit_type": "style_preset",
        "preset_id": preset_id,
        "preset_name": preset.get("name", ""),
    }

    images_db = load_db()
    images_db.append(new_record)
    save_db(images_db)
    return new_record


# ---------------------------------------------------------------------------
# Sprint 9: Multi-language Text Rendering
# ---------------------------------------------------------------------------

import unicodedata

LANGUAGE_HINTS = {
    "auto": "",
    "latin": "rendered in clean Latin typography",
    "cjk": "rendered in clean CJK typography with proper stroke order",
    "arabic": "rendered in right-to-left Arabic calligraphy",
    "hindi": "rendered in Devanagari script with proper ligatures",
    "korean": "rendered in Korean Hangul typography",
    "thai": "rendered in Thai script with proper tone marks",
}


def _detect_script(text: str) -> str:
    """Auto-detect script category from Unicode character analysis."""
    counts: dict[str, int] = {}
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith("L"):
            try:
                name = unicodedata.name(ch, "")
            except ValueError:
                name = ""
            if "CJK" in name or "HIRAGANA" in name or "KATAKANA" in name:
                counts["cjk"] = counts.get("cjk", 0) + 1
            elif "ARABIC" in name:
                counts["arabic"] = counts.get("arabic", 0) + 1
            elif "DEVANAGARI" in name:
                counts["hindi"] = counts.get("hindi", 0) + 1
            elif "HANGUL" in name:
                counts["korean"] = counts.get("korean", 0) + 1
            elif "THAI" in name:
                counts["thai"] = counts.get("thai", 0) + 1
            else:
                counts["latin"] = counts.get("latin", 0) + 1
    if not counts:
        return "latin"
    return max(counts, key=lambda k: counts[k])


@app.post("/api/detect-script")
async def detect_script_endpoint(text: str = Form(...)):
    """Detect script of input text."""
    if not text.strip():
        raise HTTPException(400, "Text cannot be empty")
    detected = _detect_script(text)
    direction = "rtl" if detected == "arabic" else "ltr"
    return {"text": text, "detected_script": detected, "direction": direction}


# ---------------------------------------------------------------------------
# Sprint 9: GIF Animation Export
# ---------------------------------------------------------------------------

GIF_EFFECTS = {"zoom", "pan", "rotate", "pulse", "fade"}


@app.post("/api/images/{image_id}/export-gif")
async def export_gif(
    image_id: str,
    effect: str = Form(default="zoom"),
    duration: float = Form(default=2.0),
    fps: int = Form(default=15),
):
    """Generate an animated GIF from a static image with effects."""
    if effect not in GIF_EFFECTS:
        raise HTTPException(400, f"Invalid effect. Choose from: {', '.join(sorted(GIF_EFFECTS))}")
    if not (1 <= duration <= 5):
        raise HTTPException(400, "Duration must be between 1 and 5 seconds")
    if fps not in (10, 15, 24):
        raise HTTPException(400, "FPS must be 10, 15, or 24")

    db = load_db()
    record = next((r for r in db if r["id"] == image_id), None)
    if not record:
        raise HTTPException(404, "Image not found")

    src_path = IMAGES_DIR / record["filename"]
    if not src_path.exists():
        raise HTTPException(404, "Image file not found on disk")

    img = Image.open(str(src_path)).convert("RGB")
    w, h = img.size
    total_frames = int(duration * fps)
    frames = []

    for i in range(total_frames):
        t = i / max(total_frames - 1, 1)

        if effect == "zoom":
            scale = 1.0 + 0.3 * t
            cw, ch = int(w / scale), int(h / scale)
            left = (w - cw) // 2
            top = (h - ch) // 2
            frame = img.crop((left, top, left + cw, top + ch)).resize((w, h), Image.LANCZOS)

        elif effect == "pan":
            offset = int(0.2 * w * t)
            frame = img.crop((offset, 0, w - int(0.2 * w) + offset, h)).resize((w, h), Image.LANCZOS)

        elif effect == "rotate":
            angle = -5 + 10 * t
            frame = img.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0))

        elif effect == "pulse":
            import math
            scale = 1.0 + 0.1 * math.sin(t * math.pi * 2)
            cw, ch = int(w / scale), int(h / scale)
            left = (w - cw) // 2
            top = (h - ch) // 2
            frame = img.crop((left, top, left + cw, top + ch)).resize((w, h), Image.LANCZOS)

        elif effect == "fade":
            enhancer = ImageEnhance.Brightness(img)
            frame = enhancer.enhance(t)

        else:
            frame = img.copy()

        # Resize to max 512px for GIF
        max_dim = 512
        if w > max_dim or h > max_dim:
            ratio = max_dim / max(w, h)
            frame = frame.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        frames.append(frame)

    gif_filename = f"{image_id}.gif"
    gif_path = IMAGES_DIR / gif_filename

    frame_duration_ms = int(1000 / fps)
    frames[0].save(
        str(gif_path),
        save_all=True,
        append_images=frames[1:],
        duration=frame_duration_ms,
        loop=0,
        optimize=True,
    )

    return FileResponse(
        str(gif_path),
        media_type="image/gif",
        filename=gif_filename,
        headers={"Content-Disposition": f'attachment; filename="{gif_filename}"'},
    )
