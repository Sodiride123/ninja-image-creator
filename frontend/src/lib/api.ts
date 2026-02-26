/**
 * API client for Image Creator backend.
 * Uses Next.js rewrites to proxy /api/* requests to the backend,
 * avoiding cross-origin issues with the sandbox auth gate.
 */

export const API_URL = "";

export interface ImageRecord {
  id: string;
  prompt: string;
  enhanced_prompt?: string | null;
  original_prompt?: string;
  refinement_instruction?: string;
  parent_id?: string;
  style: string;
  size: string;
  filename: string;
  group_id?: string;
  model?: string;
  comparison_id?: string;
  reference_filename?: string;
  favorited?: boolean;
  inpainted?: boolean;
  upscaled?: boolean;
  upscale_factor?: number;
  background_removed?: boolean;
  style_transfer?: boolean;
  created_at: string;
}

export interface TextOverlay {
  text: string;
  font_hint?: string;
  placement?: string;
}

export interface GenerateRequest {
  prompt: string;
  style?: string;
  size?: string;
  count?: number;
  text_overlay?: TextOverlay;
}

export interface GalleryResponse {
  images: ImageRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchResponse {
  images: ImageRecord[];
  group_id: string;
}


export async function generateImage(
  req: GenerateRequest
): Promise<ImageRecord | BatchResponse> {
  const res = await fetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(err.detail || "Image generation failed");
  }
  return res.json();
}

export async function refineImage(
  imageId: string,
  instruction: string
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, instruction }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Refinement failed" }));
    throw new Error(err.detail || "Image refinement failed");
  }
  return res.json();
}

export async function generateFromImage(
  prompt: string,
  file: File,
  style?: string,
  size?: string
): Promise<ImageRecord> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("reference", file);
  if (style) formData.append("style", style);
  if (size) formData.append("size", size);

  const res = await fetch(`${API_URL}/api/generate-from-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Image generation from reference failed");
  }
  return res.json();
}

export async function enhancePrompt(prompt: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/enhance-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Prompt enhancement failed");
  const data = await res.json();
  return data.enhanced;
}

export async function listImages(
  page = 1,
  limit = 20,
  search?: string,
  favorites?: boolean
): Promise<GalleryResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (favorites) params.set("favorites", "true");
  const res = await fetch(`${API_URL}/api/images?${params}`);
  if (!res.ok) throw new Error("Failed to load gallery");
  return res.json();
}

export function getImageUrl(imageId: string): string {
  return `${API_URL}/api/images/${imageId}/file`;
}

export function getDownloadUrl(imageId: string, format: string = "png"): string {
  return `${API_URL}/api/images/${imageId}/download?format=${format}`;
}

export async function inpaintImage(
  imageId: string,
  mask: string,
  prompt: string
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/inpaint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, mask, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Inpainting failed" }));
    throw new Error(err.detail || "Inpainting failed");
  }
  return res.json();
}

export async function upscaleImage(
  imageId: string,
  scale: number = 2
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/upscale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, scale }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upscale failed" }));
    throw new Error(err.detail || "Image upscaling failed");
  }
  return res.json();
}

export async function toggleFavorite(
  imageId: string
): Promise<{ id: string; favorited: boolean }> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/favorite`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to toggle favorite");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 4: Video Generation
// ---------------------------------------------------------------------------

export interface VideoRecord {
  id: string;
  sora_video_id: string;
  prompt: string;
  parent_image_id?: string;
  size: string;
  quality: string;
  model: string;
  status: string;
  progress: number;
  filename: string | null;
  error?: string | { code?: string; message?: string };
  created_at: string;
}

export interface VideoListResponse {
  videos: VideoRecord[];
  total: number;
  page: number;
  limit: number;
}

export async function generateVideo(
  prompt: string,
  size: string = "1280x720",
  quality: string = "standard"
): Promise<VideoRecord> {
  const res = await fetch(`${API_URL}/api/generate-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size, quality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Video generation failed" }));
    throw new Error(err.detail || "Video generation failed");
  }
  return res.json();
}

export async function imageToVideo(
  imageId: string,
  prompt: string,
  quality: string = "standard"
): Promise<VideoRecord> {
  const res = await fetch(`${API_URL}/api/image-to-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, prompt, quality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Image-to-video failed" }));
    throw new Error(err.detail || "Image-to-video failed");
  }
  return res.json();
}

export async function getVideoStatus(videoId: string): Promise<VideoRecord> {
  const res = await fetch(`${API_URL}/api/videos/${videoId}/status`);
  if (!res.ok) throw new Error("Failed to get video status");
  return res.json();
}

export function getVideoUrl(videoId: string): string {
  return `${API_URL}/api/videos/${videoId}/file`;
}

export async function listVideos(
  page = 1,
  limit = 20
): Promise<VideoListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_URL}/api/videos?${params}`);
  if (!res.ok) throw new Error("Failed to load videos");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 4: Image Adjustments
// ---------------------------------------------------------------------------

export interface AdjustParams {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  blur?: number;
}

export async function adjustImage(
  imageId: string,
  params: AdjustParams
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Adjustment failed" }));
    throw new Error(err.detail || "Image adjustment failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 4: Collections
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  name: string;
  image_ids: string[];
  image_count: number;
  images?: ImageRecord[];
  created_at: string;
}

export async function createCollection(name: string): Promise<Collection> {
  const res = await fetch(`${API_URL}/api/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create collection");
  return res.json();
}

export async function listCollections(): Promise<{ collections: Collection[] }> {
  const res = await fetch(`${API_URL}/api/collections`);
  if (!res.ok) throw new Error("Failed to load collections");
  return res.json();
}

export async function getCollection(collectionId: string): Promise<Collection> {
  const res = await fetch(`${API_URL}/api/collections/${collectionId}`);
  if (!res.ok) throw new Error("Failed to load collection");
  return res.json();
}

export async function addToCollection(
  collectionId: string,
  imageId: string
): Promise<{ collection_id: string; image_id: string; added: boolean }> {
  const res = await fetch(`${API_URL}/api/collections/${collectionId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId }),
  });
  if (!res.ok) throw new Error("Failed to add to collection");
  return res.json();
}

export async function removeFromCollection(
  collectionId: string,
  imageId: string
): Promise<{ collection_id: string; image_id: string; removed: boolean }> {
  const res = await fetch(`${API_URL}/api/collections/${collectionId}/images/${imageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove from collection");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 5: Background Removal
// ---------------------------------------------------------------------------

export async function removeBackground(imageId: string): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/remove-background`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Background removal failed" }));
    throw new Error(err.detail || "Background removal failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 5: Prompt History
// ---------------------------------------------------------------------------

export interface PromptEntry {
  prompt: string;
  created_at: string;
}

export async function getPromptHistory(
  limit = 50
): Promise<{ prompts: PromptEntry[] }> {
  const res = await fetch(`${API_URL}/api/prompts/history?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load prompt history");
  return res.json();
}

export async function getPromptSuggestions(
  q: string
): Promise<{ suggestions: PromptEntry[] }> {
  const res = await fetch(`${API_URL}/api/prompts/suggestions?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to get suggestions");
  return res.json();
}

export async function clearPromptHistory(): Promise<{ cleared: boolean }> {
  const res = await fetch(`${API_URL}/api/prompts/history`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear history");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 5: Style Transfer
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Sprint 5: Video Gallery Enhancements
// ---------------------------------------------------------------------------

export async function getVideo(videoId: string): Promise<VideoRecord> {
  const res = await fetch(`${API_URL}/api/videos/${videoId}`);
  if (!res.ok) throw new Error("Failed to load video");
  return res.json();
}

export async function deleteVideo(
  videoId: string
): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${API_URL}/api/videos/${videoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete video");
  return res.json();
}

export async function addVideoToCollection(
  collectionId: string,
  videoId: string
): Promise<{ collection_id: string; video_id: string; added: boolean }> {
  const res = await fetch(`${API_URL}/api/collections/${collectionId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: videoId, item_type: "video" }),
  });
  if (!res.ok) throw new Error("Failed to add video to collection");
  return res.json();
}

export async function removeVideoFromCollection(
  collectionId: string,
  videoId: string
): Promise<{ collection_id: string; video_id: string; removed: boolean }> {
  const res = await fetch(`${API_URL}/api/collections/${collectionId}/videos/${videoId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove video from collection");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 6: Watermarking
// ---------------------------------------------------------------------------

export async function watermarkImage(
  imageId: string,
  text: string,
  position?: string,
  opacity?: number,
  fontSize?: number,
  color?: string
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/watermark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      position: position || "bottom-right",
      opacity: opacity ?? 0.3,
      font_size: fontSize ?? 36,
      color: color || "#ffffff",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Watermarking failed" }));
    throw new Error(err.detail || "Watermarking failed");
  }
  return res.json();
}


// ---------------------------------------------------------------------------
// Sprint 8: SVG/Vector Export
// ---------------------------------------------------------------------------

export async function exportSvg(imageId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/export-svg`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "SVG export failed" }));
    throw new Error(err.detail || "SVG export failed");
  }
  return res.blob();
}

// ---------------------------------------------------------------------------
// Sprint 8: Smart Object Replacement
// ---------------------------------------------------------------------------

export async function replaceObject(
  imageId: string,
  targetObject: string,
  replacement: string,
  preserveStyle: boolean = true
): Promise<ImageRecord> {
  const formData = new FormData();
  formData.append("target_object", targetObject);
  formData.append("replacement", replacement);
  formData.append("preserve_style", String(preserveStyle));
  const res = await fetch(`${API_URL}/api/images/${imageId}/replace-object`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Object replacement failed" }));
    throw new Error(err.detail || "Object replacement failed");
  }
  return res.json();
}


// ---------------------------------------------------------------------------
// Sprint 9: Multi-language Text Detection
// ---------------------------------------------------------------------------

export interface ScriptDetection {
  text: string;
  script: string;
  direction: string;
  language_hint: string;
}

export async function detectScript(text: string): Promise<ScriptDetection> {
  const formData = new FormData();
  formData.append("text", text);
  const res = await fetch(`${API_URL}/api/detect-script`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Script detection failed");
  return res.json();
}

