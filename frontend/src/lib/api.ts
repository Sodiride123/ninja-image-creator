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
  enhance?: boolean;
  count?: number;
  character_profile_id?: string;
  text_overlay?: TextOverlay;
  brand_kit_id?: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  reference_images: string[];
  identity_descriptors: string;
  created_at: string;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: string[];
  style_notes: string;
  created_at: string;
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

export interface CompareResult {
  model: string;
  image: ImageRecord | null;
  error: string | null;
}

export interface CompareResponse {
  results: CompareResult[];
  comparison_id: string;
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

export async function compareModels(
  prompt: string,
  style?: string,
  size?: string
): Promise<CompareResponse> {
  const res = await fetch(`${API_URL}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, style, size }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Comparison failed" }));
    throw new Error(err.detail || "Model comparison failed");
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
  error?: string;
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

export async function generateWithStyle(
  prompt: string,
  styleImage: File,
  strength: number = 0.7,
  size?: string,
  style?: string
): Promise<ImageRecord> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("style_image", styleImage);
  formData.append("strength", String(strength));
  if (size) formData.append("size", size);
  if (style) formData.append("style", style);

  const res = await fetch(`${API_URL}/api/generate-with-style`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Style transfer failed" }));
    throw new Error(err.detail || "Style transfer failed");
  }
  return res.json();
}

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
// Sprint 6: Outpainting
// ---------------------------------------------------------------------------

export async function outpaintImage(
  imageId: string,
  directions: string[],
  amount: number
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/outpaint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directions, amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Outpainting failed" }));
    throw new Error(err.detail || "Outpainting failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 6: Edit History
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  edit_type: string;
  timestamp: string;
  params: Record<string, unknown>;
}

export interface ImageHistory {
  image_id: string;
  history: HistoryEntry[];
  current_index: number;
  can_undo: boolean;
  can_redo: boolean;
}

export async function getImageHistory(imageId: string): Promise<ImageHistory> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/history`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function undoImage(imageId: string): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/undo`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Cannot undo" }));
    throw new Error(err.detail || "Cannot undo");
  }
  return res.json();
}

export async function redoImage(imageId: string): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/redo`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Cannot redo" }));
    throw new Error(err.detail || "Cannot redo");
  }
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
// Sprint 7: Character Profiles
// ---------------------------------------------------------------------------

export async function createCharacterProfile(
  name: string,
  images: File[]
): Promise<CharacterProfile> {
  const formData = new FormData();
  formData.append("name", name);
  images.forEach((img) => formData.append("images", img));
  const res = await fetch(`${API_URL}/api/character-profiles`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Profile creation failed" }));
    throw new Error(err.detail || "Character profile creation failed");
  }
  return res.json();
}

export async function listCharacterProfiles(): Promise<CharacterProfile[]> {
  const res = await fetch(`${API_URL}/api/character-profiles`);
  if (!res.ok) throw new Error("Failed to load character profiles");
  return res.json();
}

export async function deleteCharacterProfile(
  profileId: string
): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_URL}/api/character-profiles/${profileId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete character profile");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 7: Streaming Preview (SSE)
// ---------------------------------------------------------------------------

export interface StreamEvent {
  type: "partial" | "complete" | "error";
  data: {
    stage?: number;
    total_stages?: number;
    progress_pct?: number;
    preview_base64?: string | null;
    id?: string;
    prompt?: string;
    filename?: string;
    error?: string;
    [key: string]: unknown;
  };
}

export function generateImageStream(
  req: GenerateRequest,
  onEvent: (event: StreamEvent) => void
): AbortController {
  const controller = new AbortController();

  fetch(`${API_URL}/api/generate-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onEvent({ type: "error", data: { error: "Stream request failed" } });
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent({
                type: eventType as StreamEvent["type"],
                data,
              });
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onEvent({ type: "error", data: { error: err.message } });
      }
    });

  return controller;
}

// ---------------------------------------------------------------------------
// Sprint 7: Brand Kits
// ---------------------------------------------------------------------------

export async function createBrandKit(
  name: string,
  colors: string[],
  styleNotes?: string
): Promise<BrandKit> {
  const res = await fetch(`${API_URL}/api/brand-kits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, colors, style_notes: styleNotes || "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Brand kit creation failed" }));
    throw new Error(err.detail || "Brand kit creation failed");
  }
  return res.json();
}

export async function listBrandKits(): Promise<BrandKit[]> {
  const res = await fetch(`${API_URL}/api/brand-kits`);
  if (!res.ok) throw new Error("Failed to load brand kits");
  return res.json();
}

export async function deleteBrandKit(
  kitId: string
): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_URL}/api/brand-kits/${kitId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete brand kit");
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
// Sprint 8: AI Product Photography
// ---------------------------------------------------------------------------

export type ProductScene = "studio" | "outdoor" | "lifestyle" | "flat-lay" | "holiday";

export async function productPhoto(
  imageId: string,
  scene: ProductScene,
  backgroundColor?: string
): Promise<ImageRecord> {
  const formData = new FormData();
  formData.append("scene", scene);
  if (backgroundColor) formData.append("background_color", backgroundColor);
  const res = await fetch(`${API_URL}/api/images/${imageId}/product-photo`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Product photo failed" }));
    throw new Error(err.detail || "Product photo generation failed");
  }
  return res.json();
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
// Sprint 8: Depth Map
// ---------------------------------------------------------------------------

export async function generateDepthMap(
  imageId: string
): Promise<ImageRecord> {
  const res = await fetch(`${API_URL}/api/images/${imageId}/depth-map`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Depth map generation failed" }));
    throw new Error(err.detail || "Depth map generation failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 9: Batch CSV Generation
// ---------------------------------------------------------------------------

export interface BatchJob {
  batch_id: string;
  total: number;
  completed: number;
  failed: number;
  results: ImageRecord[];
}

export async function uploadBatchCsv(file: File): Promise<{ batch_id: string; total: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/batch-csv`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Batch upload failed" }));
    throw new Error(err.detail || "Batch CSV upload failed");
  }
  return res.json();
}

export async function getBatchStatus(batchId: string): Promise<BatchJob> {
  const res = await fetch(`${API_URL}/api/batch-csv/${batchId}`);
  if (!res.ok) throw new Error("Failed to get batch status");
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprint 9: Style Presets
// ---------------------------------------------------------------------------

export interface StylePreset {
  id: string;
  name: string;
  prompt_prefix: string;
  prompt_suffix: string;
  style: string;
  size: string;
  enhance: boolean;
  negative_prompt: string;
  created_at: string;
}

export async function createStylePreset(preset: {
  name: string;
  prompt_prefix?: string;
  prompt_suffix?: string;
  style?: string;
  size?: string;
  enhance?: boolean;
  negative_prompt?: string;
}): Promise<StylePreset> {
  const res = await fetch(`${API_URL}/api/style-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preset),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Preset creation failed" }));
    throw new Error(err.detail || "Style preset creation failed");
  }
  return res.json();
}

export async function listStylePresets(): Promise<StylePreset[]> {
  const res = await fetch(`${API_URL}/api/style-presets`);
  if (!res.ok) throw new Error("Failed to load style presets");
  return res.json();
}

export async function deleteStylePreset(presetId: string): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_URL}/api/style-presets/${presetId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete style preset");
  return res.json();
}

export async function applyStylePreset(presetId: string, prompt: string): Promise<ImageRecord> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  const res = await fetch(`${API_URL}/api/style-presets/${presetId}/apply`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Preset apply failed" }));
    throw new Error(err.detail || "Failed to apply style preset");
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

// ---------------------------------------------------------------------------
// Sprint 9: GIF Animation Export
// ---------------------------------------------------------------------------

export type GifEffect = "zoom" | "pan" | "rotate" | "pulse" | "fade";

export async function exportGif(
  imageId: string,
  effect: GifEffect = "zoom",
  duration: number = 2,
  fps: number = 15
): Promise<Blob> {
  const formData = new FormData();
  formData.append("effect", effect);
  formData.append("duration", String(duration));
  formData.append("fps", String(fps));
  const res = await fetch(`${API_URL}/api/images/${imageId}/export-gif`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "GIF export failed" }));
    throw new Error(err.detail || "GIF export failed");
  }
  return res.blob();
}
