"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  generateImage,
  enhancePrompt,
  refineImage,
  compareModels,
  generateFromImage,
  inpaintImage,
  upscaleImage,
  adjustImage,
  generateVideo,
  imageToVideo,
  getVideoStatus,
  getVideoUrl,
  getImageUrl,
  getDownloadUrl,
  removeBackground,
  getPromptHistory,
  getPromptSuggestions,
  clearPromptHistory,
  generateWithStyle,
  outpaintImage,
  getImageHistory,
  undoImage,
  redoImage,
  watermarkImage,
  createCharacterProfile,
  listCharacterProfiles,
  deleteCharacterProfile,
  createBrandKit,
  listBrandKits,
  deleteBrandKit,
  exportSvg,
  productPhoto,
  replaceObject,
  generateDepthMap,
  uploadBatchCsv,
  getBatchStatus,
  listStylePresets,
  createStylePreset,
  deleteStylePreset,
  applyStylePreset,
  detectScript,
  exportGif,
  type ImageRecord,
  type ProductScene,
  type StylePreset,
  type BatchJob,
  type GifEffect,
  type BatchResponse,
  type CompareResponse,
  type VideoRecord,
  type AdjustParams,
  type PromptEntry,
  type HistoryEntry,
  type CharacterProfile,
  type BrandKit,
  type TextOverlay,
} from "@/lib/api";

const STYLES = [
  { id: "none", label: "No Style", icon: "✨" },
  { id: "photorealistic", label: "Photo", icon: "📷" },
  { id: "digital-art", label: "Digital Art", icon: "🎨" },
  { id: "watercolor", label: "Watercolor", icon: "💧" },
  { id: "oil-painting", label: "Oil Paint", icon: "🖼️" },
  { id: "anime", label: "Anime", icon: "🎌" },
  { id: "3d-render", label: "3D Render", icon: "🧊" },
  { id: "minimalist", label: "Minimal", icon: "◽" },
  { id: "vintage", label: "Vintage", icon: "📼" },
];

const SIZES = [
  { id: "1024x1024", label: "Square", ratio: "1:1", previewW: 24, previewH: 24 },
  { id: "1024x1536", label: "Portrait", ratio: "2:3", previewW: 18, previewH: 27 },
  { id: "1536x1024", label: "Landscape", ratio: "3:2", previewW: 30, previewH: 20 },
];

const SOCIAL_TEMPLATES = [
  { id: "ig-post", label: "IG Post", platform: "Instagram", dims: "1080x1080", size: "1024x1024", icon: "📸" },
  { id: "ig-story", label: "IG Story", platform: "Instagram", dims: "1080x1920", size: "1024x1536", icon: "📱" },
  { id: "yt-thumb", label: "YouTube", platform: "YouTube", dims: "1280x720", size: "1536x1024", icon: "🎬" },
  { id: "linkedin", label: "LinkedIn", platform: "LinkedIn", dims: "1200x627", size: "1536x1024", icon: "💼" },
  { id: "twitter", label: "X Header", platform: "X/Twitter", dims: "1500x500", size: "1536x1024", icon: "🐦" },
  { id: "fb-cover", label: "FB Cover", platform: "Facebook", dims: "820x312", size: "1536x1024", icon: "📘" },
];

const VIDEO_SIZES = [
  { id: "1280x720", label: "Landscape", ratio: "16:9" },
  { id: "720x1280", label: "Portrait", ratio: "9:16" },
];

const VARIATION_COUNTS = [1, 2, 4];
const BRUSH_SIZES = [
  { id: "small", label: "S", size: 10 },
  { id: "medium", label: "M", size: 25 },
  { id: "large", label: "L", size: 50 },
];

interface ThreadItem {
  type: "prompt" | "image" | "refinement";
  text?: string;
  image?: ImageRecord;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("none");
  const [size, setSize] = useState("1024x1024");
  const [enhance, setEnhance] = useState(false);
  const [variationCount, setVariationCount] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Results
  const [result, setResult] = useState<ImageRecord | null>(null);
  const [batchResults, setBatchResults] = useState<ImageRecord[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);

  // Refinement
  const [refinementInput, setRefinementInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [thread, setThread] = useState<ThreadItem[]>([]);

  // Reference image upload
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Inpainting
  const [inpaintMode, setInpaintMode] = useState(false);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(25);
  const [inpainting, setInpainting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskHistory, setMaskHistory] = useState<ImageData[]>([]);

  // Upscaling
  const [upscaling, setUpscaling] = useState(false);

  // Zoom/Pan viewer
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Share
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Video generation
  const [videoMode, setVideoMode] = useState(false);
  const [videoSize, setVideoSize] = useState("1280x720");
  const [videoQuality, setVideoQuality] = useState<"standard" | "pro">("standard");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoRecord | null>(null);
  const [videoElapsed, setVideoElapsed] = useState(0);

  // Image-to-video (animate)
  const [animateOpen, setAnimateOpen] = useState(false);
  const [animatePrompt, setAnimatePrompt] = useState("");
  const [animateQuality, setAnimateQuality] = useState<"standard" | "pro">("standard");
  const [animating, setAnimating] = useState(false);
  const [animateResult, setAnimateResult] = useState<VideoRecord | null>(null);
  const [animateElapsed, setAnimateElapsed] = useState(0);

  // Image adjustments
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustParams, setAdjustParams] = useState<AdjustParams>({
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    sharpness: 1.0,
    blur: 0,
  });

  // Background removal
  const [removingBg, setRemovingBg] = useState(false);

  // Prompt history
  const [promptHistory, setPromptHistory] = useState<PromptEntry[]>([]);
  const [promptSuggestions, setPromptSuggestions] = useState<PromptEntry[]>([]);
  const [showPromptDropdown, setShowPromptDropdown] = useState(false);
  const [promptDropdownIndex, setPromptDropdownIndex] = useState(-1);
  const promptDropdownRef = useRef<HTMLDivElement>(null);

  // Style transfer
  const [styleRefFile, setStyleRefFile] = useState<File | null>(null);
  const [styleRefPreview, setStyleRefPreview] = useState<string | null>(null);
  const [styleStrength, setStyleStrength] = useState(0.7);
  const styleRefInputRef = useRef<HTMLInputElement>(null);

  // Outpainting
  const [outpaintOpen, setOutpaintOpen] = useState(false);
  const [outpaintDirs, setOutpaintDirs] = useState<string[]>([]);
  const [outpaintAmount, setOutpaintAmount] = useState(50);
  const [extending, setExtending] = useState(false);

  // Edit history / undo-redo
  const [editHistory, setEditHistory] = useState<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Watermark
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(36);
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarking, setWatermarking] = useState(false);

  // Composition guides
  const [guideType, setGuideType] = useState<string | null>(null);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sprint 7: Character profiles
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [charName, setCharName] = useState("");
  const [charFiles, setCharFiles] = useState<File[]>([]);
  const [charCreating, setCharCreating] = useState(false);
  const [charPanelOpen, setCharPanelOpen] = useState(false);
  const charFileRef = useRef<HTMLInputElement>(null);

  // Sprint 7: Text overlay
  const [textOverlayOpen, setTextOverlayOpen] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [overlayFont, setOverlayFont] = useState("bold");
  const [overlayPlacement, setOverlayPlacement] = useState("center");

  // Sprint 7: Brand kits
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [selectedBrandKit, setSelectedBrandKit] = useState<string | null>(null);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitColors, setNewKitColors] = useState<string[]>(["#3B82F6"]);
  const [newKitNotes, setNewKitNotes] = useState("");
  const [kitCreating, setKitCreating] = useState(false);

  // Sprint 8: SVG export, product photo, object replacement, depth map
  const [svgExporting, setSvgExporting] = useState(false);
  const [productPhotoOpen, setProductPhotoOpen] = useState(false);
  const [productScene, setProductScene] = useState<ProductScene>("studio");
  const [productBgColor, setProductBgColor] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [replacePreserveStyle, setReplacePreserveStyle] = useState(true);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [depthMapLoading, setDepthMapLoading] = useState(false);
  const [depthMapResult, setDepthMapResult] = useState<ImageRecord | null>(null);
  const [depthMapView, setDepthMapView] = useState(false);

  // Sprint 9: Batch CSV generation
  const [batchCsvOpen, setBatchCsvOpen] = useState(false);
  const [batchCsvFile, setBatchCsvFile] = useState<File | null>(null);
  const [batchCsvUploading, setBatchCsvUploading] = useState(false);
  const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
  const batchCsvRef = useRef<HTMLInputElement>(null);

  // Sprint 9: Style presets
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [stylePresetsOpen, setStylePresetsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetPrefix, setNewPresetPrefix] = useState("");
  const [newPresetSuffix, setNewPresetSuffix] = useState("");
  const [presetCreating, setPresetCreating] = useState(false);
  const [presetApplying, setPresetApplying] = useState<string | null>(null);

  // Sprint 9: Multi-language text
  const [detectedScript, setDetectedScript] = useState<string | null>(null);
  const [detectedDirection, setDetectedDirection] = useState<string>("ltr");

  // Sprint 9: GIF animation export
  const [gifOpen, setGifOpen] = useState(false);
  const [gifEffect, setGifEffect] = useState<GifEffect>("zoom");
  const [gifDuration, setGifDuration] = useState(2);
  const [gifFps, setGifFps] = useState(15);
  const [gifExporting, setGifExporting] = useState(false);

  const clearResults = () => {
    setResult(null);
    setBatchResults([]);
    setSelectedVariation(0);
    setCompareResult(null);
    setThread([]);
    setRefinementInput("");
    setInpaintMode(false);
    setInpaintPrompt("");
    setShareOpen(false);
    setVideoResult(null);
    setVideoElapsed(0);
    setAnimateOpen(false);
    setAnimateResult(null);
    setAnimateElapsed(0);
    setAdjustOpen(false);
    setAdjustParams({ brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpness: 1.0, blur: 0 });
    setOutpaintOpen(false);
    setOutpaintDirs([]);
    setWatermarkOpen(false);
    setWatermarkText("");
    setHistoryOpen(false);
    setGuideType(null);
    setProductPhotoOpen(false);
    setReplaceOpen(false);
    setReplaceTarget("");
    setReplaceWith("");
    setDepthMapResult(null);
    setDepthMapView(false);
    setBatchCsvOpen(false);
    setBatchCsvFile(null);
    setBatchJob(null);
    setGifOpen(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    clearResults();

    try {
      if (styleRefFile) {
        const image = await generateWithStyle(prompt, styleRefFile, styleStrength, size, style);
        setResult(image);
        setThread([
          { type: "prompt", text: prompt },
          { type: "image", image },
        ]);
      } else if (referenceFile) {
        const image = await generateFromImage(prompt, referenceFile, style, size);
        setResult(image);
        setThread([
          { type: "prompt", text: prompt },
          { type: "image", image },
        ]);
      } else if (compareMode) {
        const comparison = await compareModels(prompt, style, size);
        setCompareResult(comparison);
      } else if (variationCount > 1) {
        const req_params = {
          prompt, style, size, enhance, count: variationCount,
          character_profile_id: selectedCharacter || undefined,
          text_overlay: textOverlayOpen && overlayText ? { text: overlayText, font_hint: overlayFont, placement: overlayPlacement } as TextOverlay : undefined,
          brand_kit_id: selectedBrandKit || undefined,
        };
        const data = await generateImage(req_params);
        const batch = data as BatchResponse;
        setBatchResults(batch.images);
        setSelectedVariation(0);
      } else {
        const req_params = {
          prompt, style, size, enhance,
          character_profile_id: selectedCharacter || undefined,
          text_overlay: textOverlayOpen && overlayText ? { text: overlayText, font_hint: overlayFont, placement: overlayPlacement } as TextOverlay : undefined,
          brand_kit_id: selectedBrandKit || undefined,
        };
        const image = (await generateImage(req_params)) as ImageRecord;
        setResult(image);
        setThread([
          { type: "prompt", text: image.enhanced_prompt || prompt },
          { type: "image", image },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("CORS")) {
        setError("Unable to connect to the server. Please check your connection and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const enhanced = await enhancePrompt(prompt);
      setPrompt(enhanced);
    } catch {
      // silently fail
    } finally {
      setEnhancing(false);
    }
  };

  // Sprint 7: Character profile handlers
  const handleCreateCharacter = async () => {
    if (!charName.trim() || charFiles.length === 0) return;
    setCharCreating(true);
    try {
      const profile = await createCharacterProfile(charName, charFiles);
      setCharacterProfiles((prev) => [...prev, profile]);
      setCharName("");
      setCharFiles([]);
      setSelectedCharacter(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create character profile");
    } finally {
      setCharCreating(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
      await deleteCharacterProfile(id);
      setCharacterProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedCharacter === id) setSelectedCharacter(null);
    } catch {
      // silently fail
    }
  };

  // Sprint 7: Brand kit handlers
  const handleCreateBrandKit = async () => {
    if (!newKitName.trim() || newKitColors.length === 0) return;
    setKitCreating(true);
    try {
      const kit = await createBrandKit(newKitName, newKitColors, newKitNotes);
      setBrandKits((prev) => [...prev, kit]);
      setNewKitName("");
      setNewKitColors(["#3B82F6"]);
      setNewKitNotes("");
      setSelectedBrandKit(kit.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create brand kit");
    } finally {
      setKitCreating(false);
    }
  };

  const handleDeleteBrandKit = async (id: string) => {
    try {
      await deleteBrandKit(id);
      setBrandKits((prev) => prev.filter((k) => k.id !== id));
      if (selectedBrandKit === id) setSelectedBrandKit(null);
    } catch {
      // silently fail
    }
  };

  // Sprint 8 handlers
  const handleExportSvg = async () => {
    if (!result) return;
    setSvgExporting(true);
    try {
      const blob = await exportSvg(result.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.id}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SVG export failed");
    } finally {
      setSvgExporting(false);
    }
  };

  const handleProductPhoto = async () => {
    if (!result) return;
    setProductLoading(true);
    setError("");
    try {
      const photo = await productPhoto(result.id, productScene, productBgColor || undefined);
      setResult(photo);
      setThread((prev) => [...prev, { type: "image", image: photo }]);
      setProductPhotoOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Product photo failed");
    } finally {
      setProductLoading(false);
    }
  };

  const handleReplaceObject = async () => {
    if (!result || !replaceTarget.trim() || !replaceWith.trim()) return;
    setReplaceLoading(true);
    setError("");
    try {
      const replaced = await replaceObject(result.id, replaceTarget, replaceWith, replacePreserveStyle);
      setResult(replaced);
      setThread((prev) => [...prev, { type: "image", image: replaced }]);
      setReplaceOpen(false);
      setReplaceTarget("");
      setReplaceWith("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Object replacement failed");
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleDepthMap = async () => {
    if (!result) return;
    setDepthMapLoading(true);
    setError("");
    try {
      const dm = await generateDepthMap(result.id);
      setDepthMapResult(dm);
      setDepthMapView(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Depth map generation failed");
    } finally {
      setDepthMapLoading(false);
    }
  };

  // Sprint 9 handlers
  const handleBatchCsvUpload = async () => {
    if (!batchCsvFile) return;
    setBatchCsvUploading(true);
    setError("");
    setBatchJob(null);
    try {
      const { batch_id, total } = await uploadBatchCsv(batchCsvFile);
      setBatchJob({ batch_id, total, completed: 0, failed: 0, results: [] });
      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const status = await getBatchStatus(batch_id);
          setBatchJob(status);
          if (status.completed + status.failed >= status.total) {
            clearInterval(pollInterval);
            setBatchCsvUploading(false);
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch CSV upload failed");
      setBatchCsvUploading(false);
    }
  };

  const handleCreateStylePreset = async () => {
    if (!newPresetName.trim()) return;
    setPresetCreating(true);
    try {
      const preset = await createStylePreset({
        name: newPresetName,
        prompt_prefix: newPresetPrefix,
        prompt_suffix: newPresetSuffix,
        style,
        size,
        enhance,
      });
      setStylePresets((prev) => [...prev, preset]);
      setNewPresetName("");
      setNewPresetPrefix("");
      setNewPresetSuffix("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create preset");
    } finally {
      setPresetCreating(false);
    }
  };

  const handleDeleteStylePreset = async (id: string) => {
    try {
      await deleteStylePreset(id);
      setStylePresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silently fail
    }
  };

  const handleApplyPreset = async (preset: StylePreset) => {
    if (!prompt.trim()) return;
    setPresetApplying(preset.id);
    setError("");
    try {
      const image = await applyStylePreset(preset.id, prompt);
      setResult(image);
      setThread([
        { type: "prompt", text: `[${preset.name}] ${prompt}` },
        { type: "image", image },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply preset");
    } finally {
      setPresetApplying(null);
    }
  };

  const handleExportGif = async () => {
    if (!result) return;
    setGifExporting(true);
    try {
      const blob = await exportGif(result.id, gifEffect, gifDuration, gifFps);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.id}-${gifEffect}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("GIF downloaded!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "GIF export failed");
    } finally {
      setGifExporting(false);
    }
  };

  const handleRefine = async () => {
    if (!refinementInput.trim() || !result) return;
    setRefining(true);
    setError("");
    const instruction = refinementInput;
    setRefinementInput("");

    setThread((prev) => [...prev, { type: "refinement", text: instruction }]);

    try {
      const refined = await refineImage(result.id, instruction);
      setResult(refined);
      setThread((prev) => [...prev, { type: "image", image: refined }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  };

  const handleStartFresh = () => {
    setPrompt("");
    clearResults();
    setError("");
    setReferenceFile(null);
    setReferencePreview(null);
    setSelectedTemplate(null);
  };

  // Video generation with polling
  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    setVideoLoading(true);
    setError("");
    setVideoResult(null);
    setVideoElapsed(0);

    try {
      const video = await generateVideo(prompt, videoSize, videoQuality);
      // Start polling
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        setVideoElapsed(Math.floor((Date.now() - startTime) / 1000));
        try {
          const status = await getVideoStatus(video.id);
          if (status.status === "completed") {
            clearInterval(pollInterval);
            setVideoResult(status);
            setVideoLoading(false);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setError(status.error || "Video generation failed");
            setVideoLoading(false);
          }
        } catch {
          // Keep polling on transient errors
        }
      }, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video generation failed");
      setVideoLoading(false);
    }
  };

  // Image-to-video (animate)
  const handleAnimate = async () => {
    if (!result || !animatePrompt.trim()) return;
    setAnimating(true);
    setError("");
    setAnimateResult(null);
    setAnimateElapsed(0);

    try {
      const video = await imageToVideo(result.id, animatePrompt, animateQuality);
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        setAnimateElapsed(Math.floor((Date.now() - startTime) / 1000));
        try {
          const status = await getVideoStatus(video.id);
          if (status.status === "completed") {
            clearInterval(pollInterval);
            setAnimateResult(status);
            setAnimating(false);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            setError(status.error || "Animation failed");
            setAnimating(false);
          }
        } catch {
          // Keep polling
        }
      }, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Animation failed");
      setAnimating(false);
    }
  };

  // Image adjustments
  const handleApplyAdjustments = async () => {
    if (!result) return;
    setAdjusting(true);
    setError("");
    try {
      const adjusted = await adjustImage(result.id, adjustParams);
      setResult(adjusted);
      setAdjustOpen(false);
      setAdjustParams({ brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpness: 1.0, blur: 0 });
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: "Applied adjustments" },
        { type: "image", image: adjusted },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  // Background removal handler
  const handleRemoveBackground = async () => {
    if (!result) return;
    setRemovingBg(true);
    setError("");
    try {
      const bgRemoved = await removeBackground(result.id);
      setResult(bgRemoved);
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: "Removed background" },
        { type: "image", image: bgRemoved },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Background removal failed");
    } finally {
      setRemovingBg(false);
    }
  };

  // Prompt history — load on focus
  const loadPromptHistory = async () => {
    try {
      const data = await getPromptHistory(10);
      setPromptHistory(data.prompts);
    } catch {}
  };

  // Prompt suggestions — filter as user types
  useEffect(() => {
    if (prompt.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const data = await getPromptSuggestions(prompt.trim());
          setPromptSuggestions(data.suggestions);
        } catch {}
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setPromptSuggestions([]);
    }
  }, [prompt]);

  const handlePromptFocus = () => {
    loadPromptHistory();
    setShowPromptDropdown(true);
    setPromptDropdownIndex(-1);
  };

  const handlePromptBlur = () => {
    // Delay to allow click on dropdown items
    setTimeout(() => setShowPromptDropdown(false), 200);
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    const items = prompt.trim().length >= 2 ? promptSuggestions : promptHistory;
    if (!showPromptDropdown || items.length === 0) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPromptDropdownIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPromptDropdownIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && promptDropdownIndex >= 0) {
      e.preventDefault();
      setPrompt(items[promptDropdownIndex].prompt);
      setShowPromptDropdown(false);
    } else if (e.key === "Escape") {
      setShowPromptDropdown(false);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearPromptHistory();
      setPromptHistory([]);
    } catch {}
  };

  // Style reference handlers
  const handleStyleRefSelect = (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      setError("Style image must be PNG or JPEG");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Style image must be under 10MB");
      return;
    }
    setStyleRefFile(file);
    setStyleRefPreview(URL.createObjectURL(file));
    setError("");
  };

  const removeStyleRef = () => {
    setStyleRefFile(null);
    setStyleRefPreview(null);
    setStyleStrength(0.7);
    if (styleRefInputRef.current) styleRefInputRef.current.value = "";
  };

  // Outpainting handler
  const handleOutpaint = async () => {
    if (!result || outpaintDirs.length === 0) return;
    setExtending(true);
    setError("");
    try {
      const extended = await outpaintImage(result.id, outpaintDirs, outpaintAmount);
      setResult(extended);
      setOutpaintOpen(false);
      setOutpaintDirs([]);
      setOutpaintAmount(50);
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: `Extended image: ${outpaintDirs.join(", ")} by ${outpaintAmount}%` },
        { type: "image", image: extended },
      ]);
      loadEditHistory(extended.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outpainting failed");
    } finally {
      setExtending(false);
    }
  };

  const toggleOutpaintDir = (dir: string) => {
    setOutpaintDirs((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    );
  };

  // Edit history
  const loadEditHistory = async (imageId: string) => {
    try {
      const hist = await getImageHistory(imageId);
      setEditHistory(hist.history);
      setCanUndo(hist.can_undo);
      setCanRedo(hist.can_redo);
    } catch {
      setEditHistory([]);
      setCanUndo(false);
      setCanRedo(false);
    }
  };

  const handleUndo = async () => {
    if (!result || !canUndo) return;
    setError("");
    try {
      const prev = await undoImage(result.id);
      setResult(prev);
      setThread((t) => [...t, { type: "refinement", text: "Undo" }, { type: "image", image: prev }]);
      loadEditHistory(prev.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot undo");
    }
  };

  const handleRedo = async () => {
    if (!result || !canRedo) return;
    setError("");
    try {
      const next = await redoImage(result.id);
      setResult(next);
      setThread((t) => [...t, { type: "refinement", text: "Redo" }, { type: "image", image: next }]);
      loadEditHistory(next.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot redo");
    }
  };

  // Load history when result changes
  useEffect(() => {
    if (result?.id) {
      loadEditHistory(result.id);
    } else {
      setEditHistory([]);
      setCanUndo(false);
      setCanRedo(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (result && canUndo) handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (result && canRedo) handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id, canUndo, canRedo]);

  // Watermark handler
  const handleWatermark = async () => {
    if (!result || !watermarkText.trim()) return;
    setWatermarking(true);
    setError("");
    try {
      const marked = await watermarkImage(result.id, watermarkText, watermarkPosition, watermarkOpacity, watermarkFontSize, watermarkColor);
      setResult(marked);
      setWatermarkOpen(false);
      setWatermarkText("");
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: `Added watermark: "${watermarkText}"` },
        { type: "image", image: marked },
      ]);
      loadEditHistory(marked.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Watermarking failed");
    } finally {
      setWatermarking(false);
    }
  };

  // Theme toggle — initialize from localStorage + system preference
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Sprint 7: Load character profiles and brand kits on mount
  // Sprint 9: Also load style presets
  useEffect(() => {
    listCharacterProfiles().then(setCharacterProfiles).catch(() => {});
    listBrandKits().then(setBrandKits).catch(() => {});
    listStylePresets().then(setStylePresets).catch(() => {});
  }, []);

  // Sprint 9: Detect script when overlay text changes
  useEffect(() => {
    if (overlayText.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const det = await detectScript(overlayText);
          setDetectedScript(det.script);
          setDetectedDirection(det.direction);
        } catch {
          setDetectedScript(null);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDetectedScript(null);
      setDetectedDirection("ltr");
    }
  }, [overlayText]);

  // File upload handlers
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      setError("Reference image must be PNG or JPEG");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Reference image must be under 10MB");
      return;
    }
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
    setError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    },
    [handleFileSelect]
  );

  const removeReference = () => {
    setReferenceFile(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Inpainting — initialize canvas when entering inpaint mode
  useEffect(() => {
    if (inpaintMode && canvasRef.current && result) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      img.src = getImageUrl(result.id);
    }
  }, [inpaintMode, result]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Save state for undo
    setMaskHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setIsDrawing(true);
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setMaskHistory([]);
  };

  const undoMask = () => {
    const canvas = canvasRef.current;
    if (!canvas || maskHistory.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = maskHistory[maskHistory.length - 1];
    ctx.putImageData(prev, 0, 0);
    setMaskHistory((h) => h.slice(0, -1));
  };

  const handleInpaint = async () => {
    if (!result || !inpaintPrompt.trim() || !canvasRef.current) return;
    setInpainting(true);
    setError("");

    // Export mask as base64 PNG — convert to black/white mask
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext("2d")!;
    const maskData = maskCtx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      const val = alpha > 0 ? 255 : 0;
      maskData.data[i] = val;
      maskData.data[i + 1] = val;
      maskData.data[i + 2] = val;
      maskData.data[i + 3] = 255;
    }
    maskCtx.putImageData(maskData, 0, 0);
    const maskBase64 = maskCanvas.toDataURL("image/png").split(",")[1];

    try {
      const inpainted = await inpaintImage(result.id, maskBase64, inpaintPrompt);
      setResult(inpainted);
      setInpaintMode(false);
      setInpaintPrompt("");
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: `Inpaint: ${inpaintPrompt}` },
        { type: "image", image: inpainted },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inpainting failed");
    } finally {
      setInpainting(false);
    }
  };

  // Upscale handler
  const handleUpscale = async (scale: number) => {
    if (!result) return;
    setUpscaling(true);
    setError("");
    try {
      const upscaled = await upscaleImage(result.id, scale);
      setResult(upscaled);
      setThread((prev) => [
        ...prev,
        { type: "refinement", text: `Upscaled ${scale}x` },
        { type: "image", image: upscaled },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upscaling failed");
    } finally {
      setUpscaling(false);
    }
  };

  // Reset zoom when result changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [result?.id]);

  // Zoom via scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (inpaintMode) return;
    e.preventDefault();
    setZoom((prev) => {
      const next = prev - e.deltaY * 0.002;
      return Math.min(Math.max(next, 1), 8);
    });
  }, [inpaintMode]);

  // Pan via mouse drag (only when zoomed in)
  const handleViewerMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || inpaintMode) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleViewerMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleViewerMouseUp = () => setIsPanning(false);

  // Pinch-to-zoom + touch pan
  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleViewerTouchStart = (e: React.TouchEvent) => {
    if (inpaintMode) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      setLastTouchDist(getTouchDist(e.touches));
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleViewerTouchMove = (e: React.TouchEvent) => {
    if (inpaintMode) return;
    if (e.touches.length === 2 && lastTouchDist !== null) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      if (dist !== null) {
        const scale = dist / lastTouchDist;
        setZoom((prev) => Math.min(Math.max(prev * scale, 1), 8));
        setLastTouchDist(dist);
      }
    } else if (e.touches.length === 1 && isPanning) {
      setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
    }
  };

  const handleViewerTouchEnd = () => {
    setIsPanning(false);
    setLastTouchDist(null);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Share — copy link
  const handleCopyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(getImageUrl(result.id));
    setToast("Link copied!");
    setTimeout(() => setToast(""), 2000);
    setShareOpen(false);
  };

  // Toast auto-dismiss
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  // Social template selection
  const handleTemplateSelect = (tmpl: typeof SOCIAL_TEMPLATES[0]) => {
    setSelectedTemplate(tmpl.id);
    setSize(tmpl.size);
  };

  const activeResult = result || (batchResults.length > 0 ? batchResults[selectedVariation] : null);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-[var(--foreground)] px-4 py-2 rounded-[8px] text-sm shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Image Creator
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-sm hover:border-[var(--primary)] transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <Link
              href="/gallery"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Gallery →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content — 40/60 split */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
          {/* Left Panel (40%) — Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image / Video Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setVideoMode(false)}
                className={`flex-1 py-2 rounded-[8px] text-sm font-medium transition-all ${
                  !videoMode
                    ? "bg-[var(--primary)] text-[var(--foreground)]"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Image
              </button>
              <button
                onClick={() => setVideoMode(true)}
                className={`flex-1 py-2 rounded-[8px] text-sm font-medium transition-all ${
                  videoMode
                    ? "bg-[var(--primary)] text-[var(--foreground)]"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Video
              </button>
            </div>

            {/* Reference Image Upload (image mode only) */}
            {!videoMode && <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Reference Image (optional)
              </label>
              {referencePreview ? (
                <div className="relative rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-full max-h-[160px] object-contain"
                  />
                  <button
                    onClick={removeReference}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full text-[var(--foreground)] text-xs flex items-center justify-center hover:bg-black/80"
                  >
                    ✕
                  </button>
                  <p className="text-xs text-[var(--muted)] px-3 py-2">Reference image</p>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-[12px] min-h-[100px] lg:min-h-[120px] bg-[var(--surface)] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                    dragActive
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <span className="text-2xl opacity-50">☁️</span>
                  <p className="text-sm text-[var(--muted)]">Drag & drop a reference image</p>
                  <p className="text-xs text-[var(--primary)]">or click to browse</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
            </div>}

            {/* Style Reference Upload (image mode only) */}
            {!videoMode && <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Style Reference (optional)
              </label>
              {styleRefPreview ? (
                <div className="rounded-[12px] overflow-hidden border border-purple-500/50 bg-[var(--surface)]">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={styleRefPreview}
                      alt="Style reference"
                      className="w-full max-h-[120px] object-contain"
                    />
                    <button
                      onClick={removeStyleRef}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full text-[var(--foreground)] text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-xs text-purple-400">Style reference</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)]">Strength</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        value={styleStrength}
                        onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                        className="flex-1 accent-purple-500"
                      />
                      <span className="text-xs text-[var(--foreground)] w-8 text-right">{styleStrength.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => styleRefInputRef.current?.click()}
                  className="w-full border border-dashed border-purple-500/30 rounded-[12px] py-3 px-4 bg-[var(--surface)] flex items-center gap-3 hover:border-purple-500/60 transition-colors"
                >
                  <span className="text-lg opacity-50">🎨</span>
                  <span className="text-sm text-[var(--muted)]">Upload a style reference image</span>
                </button>
              )}
              <input
                ref={styleRefInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleStyleRefSelect(e.target.files[0]);
                }}
              />
            </div>}

            {/* Prompt Input with History Dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                {videoMode ? "Describe your video" : "Describe your image"}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setPromptDropdownIndex(-1);
                }}
                placeholder={videoMode ? "Describe the video you want to create..." : "Describe the image you want to create..."}
                className="w-full min-h-[120px] bg-[var(--surface)] border border-[var(--border)] rounded-[6px] p-4 text-[var(--foreground)] placeholder-gray-500 resize-y focus:outline-none focus:border-[var(--primary)] transition-colors"
                onFocus={handlePromptFocus}
                onBlur={handlePromptBlur}
                onKeyDown={handlePromptKeyDown}
              />
              {/* Prompt History / Suggestions Dropdown */}
              {showPromptDropdown && (
                <div ref={promptDropdownRef} className="absolute left-0 right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] shadow-xl z-30 max-h-[200px] overflow-y-auto">
                  {(prompt.trim().length >= 2 ? promptSuggestions : promptHistory).length > 0 ? (
                    <>
                      {(prompt.trim().length >= 2 ? promptSuggestions : promptHistory).map((entry, i) => (
                        <button
                          key={`${entry.prompt}-${i}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPrompt(entry.prompt);
                            setShowPromptDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors truncate ${
                            i === promptDropdownIndex
                              ? "bg-[var(--primary)]/20 text-[var(--foreground)]"
                              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]"
                          }`}
                        >
                          {entry.prompt}
                        </button>
                      ))}
                      {prompt.trim().length < 2 && promptHistory.length > 0 && (
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleClearHistory();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[var(--border)] transition-colors border-t border-[var(--border)]"
                        >
                          Clear history
                        </button>
                      )}
                    </>
                  ) : prompt.trim().length >= 2 ? null : (
                    <div className="px-4 py-3 text-sm text-[var(--muted)]">No recent prompts</div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={handleEnhance}
                  disabled={!prompt.trim() || enhancing}
                  className="text-sm text-[var(--primary)] hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {enhancing ? "Enhancing..." : "✨ Enhance prompt"}
                </button>
                <span className="text-xs text-[var(--muted)]">Ctrl+Enter to generate</span>
              </div>
            </div>

            {/* Video-specific controls */}
            {videoMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                    Video Size
                  </label>
                  <div className="flex gap-3">
                    {VIDEO_SIZES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setVideoSize(s.id)}
                        className={`flex-1 py-3 rounded-[8px] text-sm text-center transition-all ${
                          videoSize === s.id
                            ? "border-2 border-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)]"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <div className="font-medium">{s.label}</div>
                        <div className="text-xs opacity-70">{s.ratio}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                    Quality
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVideoQuality("standard")}
                      className={`flex-1 py-2 rounded-[8px] text-sm transition-all ${
                        videoQuality === "standard"
                          ? "bg-[var(--primary)] text-[var(--foreground)]"
                          : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      Standard (~90s)
                    </button>
                    <button
                      onClick={() => setVideoQuality("pro")}
                      className={`flex-1 py-2 rounded-[8px] text-sm transition-all ${
                        videoQuality === "pro"
                          ? "bg-[var(--primary)] text-[var(--foreground)]"
                          : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      Pro (~120s)
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Image-specific controls */}
            {!videoMode && <>
            {/* Style Presets */}
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">Style</label>
              <div className="flex flex-wrap gap-2 overflow-x-auto">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                      style === s.id
                        ? "bg-[var(--primary)] text-[var(--foreground)]"
                        : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Aspect Ratio
              </label>
              <div className="flex gap-3">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSize(s.id); setSelectedTemplate(null); }}
                    className={`flex-1 py-3 rounded-[8px] text-sm text-center transition-all ${
                      size === s.id && !selectedTemplate
                        ? "border-2 border-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)]"
                        : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex justify-center mb-2">
                      <div
                        style={{ width: s.previewW, height: s.previewH }}
                        className={`border-2 rounded-[3px] ${
                          size === s.id && !selectedTemplate
                            ? "border-[var(--primary)]"
                            : "border-[var(--muted)] opacity-50"
                        }`}
                      />
                    </div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs opacity-70">{s.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Media Templates */}
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Social Media Templates
              </label>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t)}
                    className={`px-3 py-2 rounded-[8px] text-xs transition-all ${
                      selectedTemplate === t.id
                        ? "bg-[var(--primary)] text-[var(--foreground)]"
                        : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {t.icon} {t.label}
                    <span className="ml-1 opacity-60">{t.dims}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Variations */}
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Variations
              </label>
              <div className="flex gap-2">
                {VARIATION_COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setVariationCount(c);
                      if (c > 1) setCompareMode(false);
                    }}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      variationCount === c && !compareMode
                        ? "bg-[var(--primary)] text-[var(--foreground)]"
                        : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhance Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  enhance ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                }`}
                onClick={() => setEnhance(!enhance)}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    enhance ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </div>
              <span className="text-sm text-[var(--muted)]">Auto-enhance prompt</span>
            </label>
            </>}

            {/* Sprint 7: Text Overlay */}
            {!videoMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setTextOverlayOpen(!textOverlayOpen)}
                  className={`text-sm flex items-center gap-2 transition-colors ${textOverlayOpen ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  <span>🔤</span> Add Text {textOverlayOpen ? "▾" : "▸"}
                </button>
                {textOverlayOpen && (
                  <div className="bg-[var(--surface)] rounded-[12px] p-3 space-y-3 border border-[var(--border)]">
                    <input
                      type="text"
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value)}
                      placeholder="Text to render in image..."
                      maxLength={200}
                      className="w-full px-3 py-2 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      dir={detectedDirection === "rtl" ? "rtl" : "ltr"}
                    />
                    {detectedScript && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          {detectedScript} {detectedDirection === "rtl" ? "RTL" : "LTR"}
                        </span>
                        <span className="text-xs text-[var(--muted)]">Auto-detected</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-1">Font Style</p>
                      <div className="flex flex-wrap gap-1">
                        {["bold", "handwritten", "3d", "graffiti", "serif", "sans-serif", "decorative"].map((f) => (
                          <button
                            key={f}
                            onClick={() => setOverlayFont(f)}
                            className={`px-2 py-1 rounded-full text-xs capitalize transition-all ${
                              overlayFont === f
                                ? "bg-[var(--primary)] text-[var(--foreground)]"
                                : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-1">Placement</p>
                      <div className="flex gap-1">
                        {["top", "center", "bottom"].map((p) => (
                          <button
                            key={p}
                            onClick={() => setOverlayPlacement(p)}
                            className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${
                              overlayPlacement === p
                                ? "bg-[var(--primary)] text-[var(--foreground)]"
                                : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sprint 7: Character Profile Selector */}
            {!videoMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setCharPanelOpen(!charPanelOpen)}
                  className={`text-sm flex items-center gap-2 transition-colors ${charPanelOpen ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  <span>👤</span> Character {charPanelOpen ? "▾" : "▸"}
                  {selectedCharacter && <span className="text-xs bg-[var(--primary)] px-2 py-0.5 rounded-full text-[var(--foreground)]">Active</span>}
                </button>
                {charPanelOpen && (
                  <div className="bg-[var(--surface)] rounded-[12px] p-3 space-y-3 border border-[var(--border)]">
                    {characterProfiles.length > 0 && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedCharacter(null)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                            !selectedCharacter ? "bg-[var(--primary)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--border)]"
                          }`}
                        >
                          None
                        </button>
                        {characterProfiles.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedCharacter(p.id)}
                              className={`flex-1 text-left px-2 py-1.5 rounded text-sm transition-colors ${
                                selectedCharacter === p.id ? "bg-[var(--primary)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--border)]"
                              }`}
                            >
                              {p.name}
                            </button>
                            <button onClick={() => handleDeleteCharacter(p.id)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-[var(--border)] pt-2 space-y-2">
                      <p className="text-xs text-[var(--muted)]">New Character</p>
                      <input
                        type="text"
                        value={charName}
                        onChange={(e) => setCharName(e.target.value)}
                        placeholder="Character name"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <input
                        ref={charFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setCharFiles(Array.from(e.target.files).slice(0, 3));
                        }}
                      />
                      <button
                        onClick={() => charFileRef.current?.click()}
                        className="w-full px-3 py-1.5 text-sm bg-[var(--border)] text-[var(--muted)] rounded-[6px] hover:bg-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
                      >
                        {charFiles.length > 0 ? `${charFiles.length} image(s) selected` : "Upload Reference (1-3)"}
                      </button>
                      <button
                        onClick={handleCreateCharacter}
                        disabled={!charName.trim() || charFiles.length === 0 || charCreating}
                        className="w-full px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--foreground)] rounded-[6px] disabled:opacity-50 hover:bg-[var(--primary-hover)] transition-colors"
                      >
                        {charCreating ? "Creating..." : "Create Profile"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sprint 7: Brand Kit Selector */}
            {!videoMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setBrandPanelOpen(!brandPanelOpen)}
                  className={`text-sm flex items-center gap-2 transition-colors ${brandPanelOpen ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  <span>🎨</span> Brand Kit {brandPanelOpen ? "▾" : "▸"}
                  {selectedBrandKit && <span className="text-xs bg-[var(--primary)] px-2 py-0.5 rounded-full text-[var(--foreground)]">Active</span>}
                </button>
                {brandPanelOpen && (
                  <div className="bg-[var(--surface)] rounded-[12px] p-3 space-y-3 border border-[var(--border)]">
                    {brandKits.length > 0 && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setSelectedBrandKit(null)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                            !selectedBrandKit ? "bg-[var(--primary)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--border)]"
                          }`}
                        >
                          None
                        </button>
                        {brandKits.map((k) => (
                          <div key={k.id} className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedBrandKit(k.id)}
                              className={`flex-1 text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                                selectedBrandKit === k.id ? "bg-[var(--primary)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--border)]"
                              }`}
                            >
                              <span>{k.name}</span>
                              <span className="flex gap-0.5">
                                {k.colors.map((c, i) => (
                                  <span key={i} className="w-3 h-3 rounded-full inline-block border border-white/20" style={{ background: c }} />
                                ))}
                              </span>
                            </button>
                            <button onClick={() => handleDeleteBrandKit(k.id)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-[var(--border)] pt-2 space-y-2">
                      <p className="text-xs text-[var(--muted)]">New Brand Kit</p>
                      <input
                        type="text"
                        value={newKitName}
                        onChange={(e) => setNewKitName(e.target.value)}
                        placeholder="Kit name"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Colors (up to 6)</p>
                        <div className="flex gap-1 flex-wrap items-center">
                          {newKitColors.map((c, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <input
                                type="color"
                                value={c}
                                onChange={(e) => {
                                  const updated = [...newKitColors];
                                  updated[i] = e.target.value;
                                  setNewKitColors(updated);
                                }}
                                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                              />
                              {newKitColors.length > 1 && (
                                <button
                                  onClick={() => setNewKitColors(newKitColors.filter((_, j) => j !== i))}
                                  className="text-red-400 text-xs"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          {newKitColors.length < 6 && (
                            <button
                              onClick={() => setNewKitColors([...newKitColors, "#000000"])}
                              className="w-7 h-7 rounded border border-dashed border-[var(--border)] text-[var(--muted)] text-xs flex items-center justify-center hover:border-[var(--primary)]"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={newKitNotes}
                        onChange={(e) => setNewKitNotes(e.target.value)}
                        placeholder="Style notes (optional)"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <button
                        onClick={handleCreateBrandKit}
                        disabled={!newKitName.trim() || kitCreating}
                        className="w-full px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--foreground)] rounded-[6px] disabled:opacity-50 hover:bg-[var(--primary-hover)] transition-colors"
                      >
                        {kitCreating ? "Creating..." : "Create Brand Kit"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sprint 9: Style Presets */}
            {!videoMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setStylePresetsOpen(!stylePresetsOpen)}
                  className={`text-sm flex items-center gap-2 transition-colors ${stylePresetsOpen ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  <span>💾</span> Style Presets {stylePresetsOpen ? "▾" : "▸"}
                  {stylePresets.length > 0 && <span className="text-xs bg-[var(--border)] px-1.5 py-0.5 rounded-full text-[var(--muted)]">{stylePresets.length}</span>}
                </button>
                {stylePresetsOpen && (
                  <div className="bg-[var(--surface)] rounded-[12px] p-3 space-y-3 border border-[var(--border)]">
                    {stylePresets.length > 0 && (
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {stylePresets.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 group">
                            <button
                              onClick={() => handleApplyPreset(p)}
                              disabled={!prompt.trim() || presetApplying === p.id}
                              className="flex-1 text-left px-2 py-1.5 rounded text-sm text-[var(--muted)] hover:bg-[var(--primary)]/20 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                            >
                              <span className="font-medium">{p.name}</span>
                              {p.prompt_prefix && <span className="text-xs text-[var(--muted)] ml-1">"{p.prompt_prefix}..."</span>}
                              {presetApplying === p.id && <span className="text-xs ml-1">generating...</span>}
                            </button>
                            <button onClick={() => handleDeleteStylePreset(p.id)} className="text-red-400 hover:text-red-300 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-[var(--border)] pt-2 space-y-2">
                      <p className="text-xs text-[var(--muted)]">Save Current Settings</p>
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset name"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <input
                        type="text"
                        value={newPresetPrefix}
                        onChange={(e) => setNewPresetPrefix(e.target.value)}
                        placeholder="Prompt prefix (optional)"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <input
                        type="text"
                        value={newPresetSuffix}
                        onChange={(e) => setNewPresetSuffix(e.target.value)}
                        placeholder="Prompt suffix (optional)"
                        className="w-full px-3 py-1.5 bg-[var(--background)] rounded-[6px] text-sm text-[var(--foreground)] border border-[var(--border)] focus:border-[var(--primary)] outline-none"
                      />
                      <button
                        onClick={handleCreateStylePreset}
                        disabled={!newPresetName.trim() || presetCreating}
                        className="w-full px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--foreground)] rounded-[6px] disabled:opacity-50 hover:bg-[var(--primary-hover)] transition-colors"
                      >
                        {presetCreating ? "Saving..." : "Save Preset"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sprint 9: Batch CSV */}
            {!videoMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setBatchCsvOpen(!batchCsvOpen)}
                  className={`text-sm flex items-center gap-2 transition-colors ${batchCsvOpen ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  <span>📋</span> Batch CSV {batchCsvOpen ? "▾" : "▸"}
                </button>
                {batchCsvOpen && (
                  <div className="bg-[var(--surface)] rounded-[12px] p-3 space-y-3 border border-[var(--border)]">
                    <p className="text-xs text-[var(--muted)]">Upload a CSV with columns: prompt (required), style, size, enhance</p>
                    <input
                      ref={batchCsvRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setBatchCsvFile(e.target.files[0]);
                      }}
                    />
                    <button
                      onClick={() => batchCsvRef.current?.click()}
                      className="w-full px-3 py-2 text-sm bg-[var(--border)] text-[var(--muted)] rounded-[6px] hover:bg-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {batchCsvFile ? batchCsvFile.name : "Choose CSV file"}
                    </button>
                    <button
                      onClick={handleBatchCsvUpload}
                      disabled={!batchCsvFile || batchCsvUploading}
                      className="w-full px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--foreground)] rounded-[6px] disabled:opacity-50 hover:bg-[var(--primary-hover)] transition-colors"
                    >
                      {batchCsvUploading ? "Processing..." : "Upload & Generate"}
                    </button>
                    {batchJob && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--muted)]">Progress</span>
                          <span className="text-[var(--foreground)]">{batchJob.completed}/{batchJob.total} done{batchJob.failed > 0 ? `, ${batchJob.failed} failed` : ""}</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--primary)] rounded-full transition-all"
                            style={{ width: `${((batchJob.completed + batchJob.failed) / batchJob.total) * 100}%` }}
                          />
                        </div>
                        {batchJob.results.length > 0 && (
                          <div className="grid grid-cols-3 gap-1 max-h-[150px] overflow-y-auto">
                            {batchJob.results.map((img) => (
                              <button
                                key={img.id}
                                onClick={() => {
                                  setResult(img);
                                  setThread([{ type: "prompt", text: img.prompt }, { type: "image", image: img }]);
                                }}
                                className="rounded overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getImageUrl(img.id)} alt={img.prompt} className="w-full h-auto" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generate + Compare row */}
            <div className="flex gap-3">
              {videoMode ? (
                <button
                  onClick={handleGenerateVideo}
                  disabled={!prompt.trim() || videoLoading}
                  className="flex-1 h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--foreground)] font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {videoLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating Video... {videoElapsed}s
                    </span>
                  ) : (
                    "Generate Video"
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || loading}
                    className="flex-1 h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--foreground)] font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      "Generate Image"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (!compareMode) setVariationCount(1);
                    }}
                    className={`px-4 h-12 rounded-[8px] text-sm font-medium transition-all ${
                      compareMode
                        ? "bg-[var(--primary)] text-[var(--foreground)]"
                        : "border border-[var(--border)] text-[var(--primary)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    Compare
                  </button>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-[12px] text-red-400 text-sm flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p>{error}</p>
                  <button onClick={handleGenerate} className="mt-2 text-sm text-[var(--primary)] hover:text-blue-300">
                    Retry →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel (60%) — Image Display */}
          <div className="lg:col-span-3 flex flex-col items-start">
            {videoLoading ? (
              <div className="w-full aspect-video max-w-xl bg-[var(--surface)] rounded-[12px] flex flex-col items-center justify-center gap-4 border border-[var(--border)]">
                <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--foreground)] text-sm font-medium">Generating video...</p>
                <p className="text-[var(--muted)] text-sm animate-pulse">
                  Elapsed: {videoElapsed}s {videoQuality === "pro" ? "(~120s expected)" : "(~90s expected)"}
                </p>
                <div className="w-48 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${Math.min((videoElapsed / (videoQuality === "pro" ? 120 : 90)) * 100, 95)}%` }} />
                </div>
              </div>
            ) : videoResult ? (
              <div className="w-full max-w-xl space-y-4">
                <div className="relative rounded-[12px] overflow-hidden border border-[var(--border)]">
                  <video
                    src={getVideoUrl(videoResult.id)}
                    controls
                    autoPlay
                    loop
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={getVideoUrl(videoResult.id)}
                    download={`video-${videoResult.id}.mp4`}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--foreground)] rounded-[8px] text-sm transition-colors"
                  >
                    Download MP4
                  </a>
                  <button onClick={handleStartFresh} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-4 py-2">
                    Start fresh
                  </button>
                </div>
              </div>
            ) : animating ? (
              <div className="w-full aspect-video max-w-xl bg-[var(--surface)] rounded-[12px] flex flex-col items-center justify-center gap-4 border border-[var(--border)]">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--foreground)] text-sm font-medium">Animating image...</p>
                <p className="text-[var(--muted)] text-sm animate-pulse">Elapsed: {animateElapsed}s</p>
              </div>
            ) : animateResult ? (
              <div className="w-full max-w-xl space-y-4">
                <div className="relative rounded-[12px] overflow-hidden border border-[var(--border)]">
                  <video
                    src={getVideoUrl(animateResult.id)}
                    controls
                    autoPlay
                    loop
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={getVideoUrl(animateResult.id)}
                    download={`animated-${animateResult.id}.mp4`}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--foreground)] rounded-[8px] text-sm transition-colors"
                  >
                    Download MP4
                  </a>
                  <button onClick={() => { setAnimateResult(null); setAnimateOpen(false); }} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-4 py-2">
                    Back to image
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="w-full aspect-square max-w-xl bg-[var(--surface)] rounded-[12px] flex flex-col items-center justify-center gap-4 border border-[var(--border)] relative overflow-hidden">
                <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--muted)] text-sm animate-pulse">
                  {compareMode ? "Comparing models..." : variationCount > 1 ? `Generating ${variationCount} variations...` : "Creating your image..."}
                </p>
              </div>
            ) : compareResult ? (
              /* ===== Model Comparison View ===== */
              <div className="w-full space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {compareResult.results.map((r) => (
                    <div key={r.model} className="flex-1">
                      {r.image ? (
                        <div className="relative group rounded-[12px] overflow-hidden border border-[var(--border)]">
                          <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-[var(--foreground)] text-xs px-2 py-1 rounded-[6px] border-l-2" style={{ borderLeftColor: r.model === "gemini-image" ? "#14b8a6" : "#a78bfa" }}>
                            {r.model === "gemini-image" ? "Gemini" : "GPT"}
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getImageUrl(r.image.id)} alt={r.image.prompt} className="w-full h-auto" />
                          <a href={getDownloadUrl(r.image.id)} className="absolute top-3 right-3 px-3 py-2 bg-black/50 backdrop-blur-sm text-[var(--foreground)] text-sm rounded-[8px] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-black/70">
                            ⬇ Download
                          </a>
                          <button
                            onClick={() => {
                              setResult(r.image!);
                              setCompareResult(null);
                              setThread([
                                { type: "prompt", text: prompt },
                                { type: "image", image: r.image! },
                              ]);
                            }}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--foreground)] rounded-[8px] h-10 px-6 text-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                          >
                            Pick this one
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-[12px] bg-red-500/10 border border-red-500/30 p-6 text-center flex-1">
                          <p className="text-red-400 text-sm mb-2">{r.model === "gemini-image" ? "Gemini" : "GPT"} unavailable</p>
                          <p className="text-xs text-[var(--muted)]">{r.error}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : batchResults.length > 0 ? (
              /* ===== Variations Grid ===== */
              <div className="w-full space-y-4">
                <div className={`grid gap-4 ${batchResults.length >= 4 ? "grid-cols-1 sm:grid-cols-2" : batchResults.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {batchResults.map((img, i) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedVariation(i)}
                      className={`relative group rounded-[12px] overflow-hidden cursor-pointer transition-all ${
                        selectedVariation === i
                          ? "border-2 border-[var(--primary)] shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                          : "border-2 border-transparent hover:border-[var(--border)]"
                      }`}
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(img.id)} alt={img.prompt} className="w-full h-auto" />
                      <a href={getDownloadUrl(img.id)} className="absolute top-3 right-3 px-3 py-2 bg-black/50 backdrop-blur-sm text-[var(--foreground)] text-sm rounded-[8px] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-black/70">
                        ⬇ Download
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setResult(img);
                          setBatchResults([]);
                          setThread([
                            { type: "prompt", text: prompt },
                            { type: "image", image: img },
                          ]);
                        }}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--foreground)] rounded-[8px] h-8 px-4 text-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      >
                        Use this one
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : result ? (
              /* ===== Single Image + Tools ===== */
              <div className="w-full max-w-xl space-y-4">
                {/* Current image with zoom/pan viewer */}
                <div
                  ref={viewerRef}
                  className={`relative group rounded-[12px] overflow-hidden border border-[var(--border)] ${zoom > 1 && !inpaintMode ? "cursor-grab active:cursor-grabbing" : ""}`}
                  onWheel={handleWheel}
                  onMouseDown={handleViewerMouseDown}
                  onMouseMove={handleViewerMouseMove}
                  onMouseUp={handleViewerMouseUp}
                  onMouseLeave={handleViewerMouseUp}
                  onTouchStart={handleViewerTouchStart}
                  onTouchMove={handleViewerTouchMove}
                  onTouchEnd={handleViewerTouchEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(result.id)}
                    alt={result.prompt}
                    className="w-full h-auto"
                    draggable={false}
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: "center center",
                      transition: isPanning ? "none" : "transform 0.1s ease-out",
                      ...(result.background_removed ? {
                        backgroundImage: "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)",
                        backgroundSize: "20px 20px",
                      } : {}),
                    }}
                  />

                  {/* Inpaint canvas overlay */}
                  {inpaintMode && (
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                  )}

                  {/* Composition guide overlay */}
                  {guideType && !inpaintMode && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 300 300" preserveAspectRatio="none">
                      {guideType === "thirds" && (
                        <>
                          <line x1="100" y1="0" x2="100" y2="300" stroke="cyan" strokeWidth="0.5" opacity="0.6" />
                          <line x1="200" y1="0" x2="200" y2="300" stroke="cyan" strokeWidth="0.5" opacity="0.6" />
                          <line x1="0" y1="100" x2="300" y2="100" stroke="cyan" strokeWidth="0.5" opacity="0.6" />
                          <line x1="0" y1="200" x2="300" y2="200" stroke="cyan" strokeWidth="0.5" opacity="0.6" />
                        </>
                      )}
                      {guideType === "golden" && (
                        <>
                          <line x1="114" y1="0" x2="114" y2="300" stroke="gold" strokeWidth="0.5" opacity="0.6" />
                          <line x1="186" y1="0" x2="186" y2="300" stroke="gold" strokeWidth="0.5" opacity="0.6" />
                          <line x1="0" y1="114" x2="300" y2="114" stroke="gold" strokeWidth="0.5" opacity="0.6" />
                          <line x1="0" y1="186" x2="300" y2="186" stroke="gold" strokeWidth="0.5" opacity="0.6" />
                        </>
                      )}
                      {guideType === "center" && (
                        <>
                          <line x1="150" y1="0" x2="150" y2="300" stroke="lime" strokeWidth="0.5" opacity="0.5" />
                          <line x1="0" y1="150" x2="300" y2="150" stroke="lime" strokeWidth="0.5" opacity="0.5" />
                          <circle cx="150" cy="150" r="40" stroke="lime" strokeWidth="0.5" fill="none" opacity="0.4" />
                        </>
                      )}
                      {guideType === "diagonal" && (
                        <>
                          <line x1="0" y1="0" x2="300" y2="300" stroke="orange" strokeWidth="0.5" opacity="0.5" />
                          <line x1="300" y1="0" x2="0" y2="300" stroke="orange" strokeWidth="0.5" opacity="0.5" />
                        </>
                      )}
                    </svg>
                  )}

                  {/* Zoom controls */}
                  {!inpaintMode && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
                      {zoom > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                          className="px-2 py-1 bg-black/60 backdrop-blur-sm text-[var(--foreground)] text-xs rounded-[6px] hover:bg-black/80 transition-colors"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.5, 1)); }}
                        className="w-7 h-7 bg-black/60 backdrop-blur-sm text-[var(--foreground)] text-sm rounded-[6px] hover:bg-black/80 transition-colors flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="px-2 py-1 bg-black/60 backdrop-blur-sm text-[var(--foreground)] text-xs rounded-[6px] min-w-[40px] text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.5, 8)); }}
                        className="w-7 h-7 bg-black/60 backdrop-blur-sm text-[var(--foreground)] text-sm rounded-[6px] hover:bg-black/80 transition-colors flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  )}

                  {/* Download button */}
                  {!inpaintMode && (
                    <a href={getDownloadUrl(result.id)} className="absolute top-3 right-3 px-3 py-2 bg-black/50 backdrop-blur-sm text-[var(--foreground)] text-sm rounded-[8px] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-black/70">
                      ⬇ Download
                    </a>
                  )}

                  {/* Resolution badge */}
                  {result.upscaled && (
                    <div className="absolute top-3 left-3 bg-green-500/80 backdrop-blur-sm text-[var(--foreground)] text-xs px-2 py-1 rounded-[6px]">
                      {result.size} ({result.upscale_factor}x)
                    </div>
                  )}
                </div>

                {/* Action buttons row: Inpaint, Upscale, Adjust, Animate, Share */}
                {!inpaintMode && !adjustOpen && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setInpaintMode(true)}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all"
                    >
                      🖌️ Edit Region
                    </button>
                    <button
                      onClick={handleRemoveBackground}
                      disabled={removingBg}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-50"
                    >
                      {removingBg ? "Removing..." : "🔲 Remove BG"}
                    </button>
                    <button
                      onClick={() => handleUpscale(2)}
                      disabled={upscaling}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-50"
                    >
                      {upscaling ? "Upscaling..." : "⬆ Upscale 2x"}
                    </button>
                    <button
                      onClick={() => handleUpscale(4)}
                      disabled={upscaling}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-50"
                    >
                      ⬆ 4x
                    </button>
                    <button
                      onClick={() => setAdjustOpen(true)}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all"
                    >
                      🎨 Adjust
                    </button>
                    <button
                      onClick={() => { setOutpaintOpen(!outpaintOpen); setWatermarkOpen(false); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        outpaintOpen
                          ? "border-teal-500 text-teal-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-teal-500"
                      }`}
                    >
                      🔲 Extend
                    </button>
                    <button
                      onClick={() => { setWatermarkOpen(!watermarkOpen); setOutpaintOpen(false); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        watermarkOpen
                          ? "border-amber-500 text-amber-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-amber-500"
                      }`}
                    >
                      💧 Watermark
                    </button>
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Undo (Ctrl+Z)"
                    >
                      ↩ Undo
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      ↪ Redo
                    </button>
                    <button
                      onClick={() => setHistoryOpen(!historyOpen)}
                      className={`px-3 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        historyOpen
                          ? "border-[var(--primary)] text-[var(--primary)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)]"
                      }`}
                    >
                      📜 History
                    </button>
                    <button
                      onClick={() => setAnimateOpen(!animateOpen)}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        animateOpen
                          ? "border-purple-500 text-purple-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-purple-500"
                      }`}
                    >
                      🎬 Animate
                    </button>
                    <button
                      onClick={() => { setProductPhotoOpen(!productPhotoOpen); setReplaceOpen(false); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        productPhotoOpen
                          ? "border-emerald-500 text-emerald-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-emerald-500"
                      }`}
                    >
                      📦 Product Shot
                    </button>
                    <button
                      onClick={() => { setReplaceOpen(!replaceOpen); setProductPhotoOpen(false); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        replaceOpen
                          ? "border-orange-500 text-orange-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-orange-500"
                      }`}
                    >
                      🔄 Replace
                    </button>
                    <button
                      onClick={handleDepthMap}
                      disabled={depthMapLoading}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-50"
                    >
                      {depthMapLoading ? "Generating..." : "🗺️ 3D Depth"}
                    </button>
                    <button
                      onClick={() => { setGifOpen(!gifOpen); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        gifOpen
                          ? "border-pink-500 text-pink-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-pink-500"
                      }`}
                    >
                      🎞️ GIF
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShareOpen(!shareOpen)}
                        className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all"
                      >
                        🔗 Share
                      </button>
                      {shareOpen && (
                        <div className="absolute top-full mt-2 left-0 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-3 shadow-xl z-20 min-w-[180px] space-y-2">
                          <button onClick={handleCopyLink} className="w-full text-left px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-[6px] transition-colors">
                            📋 Copy image link
                          </button>
                          <a href={getDownloadUrl(result.id, "png")} className="block px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-[6px] transition-colors">
                            📄 Download PNG
                          </a>
                          <a href={getDownloadUrl(result.id, "jpeg")} className="block px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-[6px] transition-colors">
                            📸 Download JPEG
                          </a>
                          <a href={getDownloadUrl(result.id, "webp")} className="block px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-[6px] transition-colors">
                            🌐 Download WebP
                          </a>
                          <button onClick={handleExportSvg} disabled={svgExporting} className="w-full text-left px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-[6px] transition-colors disabled:opacity-50">
                            {svgExporting ? "⏳ Exporting..." : "🔷 Download SVG"}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setGuideType(guideType ? null : "thirds")}
                        className={`px-3 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                          guideType
                            ? "border-cyan-500 text-cyan-400"
                            : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-cyan-500"
                        }`}
                      >
                        📐 Guide
                      </button>
                      {guideType && (
                        <div className="absolute top-full mt-2 left-0 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-2 shadow-xl z-20 min-w-[160px] space-y-1">
                          {[
                            { id: "thirds", label: "Rule of Thirds" },
                            { id: "golden", label: "Golden Ratio" },
                            { id: "center", label: "Center Cross" },
                            { id: "diagonal", label: "Diagonals" },
                          ].map((g) => (
                            <button
                              key={g.id}
                              onClick={() => setGuideType(g.id)}
                              className={`w-full text-left px-3 py-2 text-sm rounded-[6px] transition-colors ${
                                guideType === g.id
                                  ? "bg-cyan-500/20 text-cyan-400"
                                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]"
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setGuideType(null)}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[var(--border)] rounded-[6px] transition-colors border-t border-[var(--border)] mt-1 pt-2"
                          >
                            Hide guides
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Animate controls */}
                {animateOpen && !inpaintMode && !adjustOpen && (
                  <div className="space-y-3 bg-[var(--surface)] rounded-[12px] border border-purple-500/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Animate this image</span>
                      <button onClick={() => setAnimateOpen(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                    <input
                      value={animatePrompt}
                      onChange={(e) => setAnimatePrompt(e.target.value)}
                      placeholder="Describe the motion... (e.g., zoom in slowly, camera pan left)"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[8px] h-10 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-purple-500 transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAnimate(); }}
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-[var(--muted)]">Quality:</span>
                      <button
                        onClick={() => setAnimateQuality("standard")}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          animateQuality === "standard" ? "bg-purple-500 text-[var(--foreground)]" : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => setAnimateQuality("pro")}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          animateQuality === "pro" ? "bg-purple-500 text-[var(--foreground)]" : "bg-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        Pro
                      </button>
                      <button
                        onClick={handleAnimate}
                        disabled={!animatePrompt.trim()}
                        className="ml-auto bg-purple-500 hover:bg-purple-600 rounded-[8px] h-8 px-4 text-sm text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Animate
                      </button>
                    </div>
                  </div>
                )}

                {/* Outpainting controls */}
                {outpaintOpen && !inpaintMode && !adjustOpen && (
                  <div className="space-y-3 bg-[var(--surface)] rounded-[12px] border border-teal-500/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Extend Image</span>
                      <button onClick={() => { setOutpaintOpen(false); setOutpaintDirs([]); }} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--muted)] mb-2 block">Directions</span>
                      <div className="grid grid-cols-4 gap-2">
                        {(["up", "down", "left", "right"] as const).map((dir) => (
                          <button
                            key={dir}
                            onClick={() => toggleOutpaintDir(dir)}
                            className={`py-2 rounded-[8px] text-sm capitalize transition-all ${
                              outpaintDirs.includes(dir)
                                ? "bg-teal-500 text-[var(--foreground)]"
                                : "bg-[var(--border)] text-[var(--muted)] hover:bg-teal-500/30 hover:text-[var(--foreground)]"
                            }`}
                          >
                            {dir === "up" ? "↑" : dir === "down" ? "↓" : dir === "left" ? "←" : "→"} {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">Amount</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={10}
                        value={outpaintAmount}
                        onChange={(e) => setOutpaintAmount(parseInt(e.target.value))}
                        className="flex-1 accent-teal-500"
                      />
                      <span className="text-xs text-[var(--foreground)] w-10 text-right">{outpaintAmount}%</span>
                    </div>
                    <button
                      onClick={handleOutpaint}
                      disabled={outpaintDirs.length === 0 || extending}
                      className="w-full bg-teal-500 hover:bg-teal-600 rounded-[8px] h-9 text-sm text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {extending ? "Extending..." : `Extend ${outpaintDirs.join(", ") || "..."}`}
                    </button>
                  </div>
                )}

                {/* Watermark controls */}
                {watermarkOpen && !inpaintMode && !adjustOpen && (
                  <div className="space-y-3 bg-[var(--surface)] rounded-[12px] border border-amber-500/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Add Watermark</span>
                      <button onClick={() => { setWatermarkOpen(false); setWatermarkText(""); }} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                    <input
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Watermark text..."
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[8px] h-10 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <div>
                      <span className="text-xs text-[var(--muted)] mb-2 block">Position</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "bottom-right", label: "Bottom Right" },
                          { id: "bottom-left", label: "Bottom Left" },
                          { id: "top-right", label: "Top Right" },
                          { id: "top-left", label: "Top Left" },
                          { id: "center", label: "Center" },
                          { id: "tiled", label: "Tiled" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setWatermarkPosition(p.id)}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${
                              watermarkPosition === p.id
                                ? "bg-amber-500 text-[var(--foreground)]"
                                : "bg-[var(--border)] text-[var(--muted)] hover:bg-amber-500/30"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">Opacity</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-xs text-[var(--foreground)] w-10 text-right">{watermarkOpacity.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">Font Size</span>
                      <input
                        type="range"
                        min={12}
                        max={200}
                        step={4}
                        value={watermarkFontSize}
                        onChange={(e) => setWatermarkFontSize(parseInt(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-xs text-[var(--foreground)] w-10 text-right">{watermarkFontSize}px</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">Color</span>
                      <input
                        type="color"
                        value={watermarkColor}
                        onChange={(e) => setWatermarkColor(e.target.value)}
                        className="w-8 h-8 rounded border-none cursor-pointer"
                      />
                      <span className="text-xs text-[var(--muted)]">{watermarkColor}</span>
                    </div>
                    <button
                      onClick={handleWatermark}
                      disabled={!watermarkText.trim() || watermarking}
                      className="w-full bg-amber-500 hover:bg-amber-600 rounded-[8px] h-9 text-sm text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {watermarking ? "Applying..." : "Apply Watermark"}
                    </button>
                  </div>
                )}

                {/* Product photography panel */}
                {productPhotoOpen && !inpaintMode && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-emerald-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Product Photography</span>
                      <button onClick={() => setProductPhotoOpen(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["studio", "outdoor", "lifestyle", "flat-lay", "holiday"] as ProductScene[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setProductScene(s)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                            productScene === s
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                              : "border-[var(--border)] text-[var(--muted)] hover:border-emerald-500/50"
                          }`}
                        >
                          {s === "studio" && "📸 "}
                          {s === "outdoor" && "🌿 "}
                          {s === "lifestyle" && "🏠 "}
                          {s === "flat-lay" && "📐 "}
                          {s === "holiday" && "🎄 "}
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted)] mb-1 block">Background color (optional)</label>
                      <input
                        type="color"
                        value={productBgColor || "#ffffff"}
                        onChange={(e) => setProductBgColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      {productBgColor && (
                        <button onClick={() => setProductBgColor("")} className="ml-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Clear</button>
                      )}
                    </div>
                    <button
                      onClick={handleProductPhoto}
                      disabled={productLoading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-[8px] h-9 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {productLoading ? "Generating..." : `Generate ${productScene} shot`}
                    </button>
                  </div>
                )}

                {/* Object replacement panel */}
                {replaceOpen && !inpaintMode && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-orange-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Replace Object</span>
                      <button onClick={() => setReplaceOpen(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
                    </div>
                    <input
                      type="text"
                      placeholder="Object to replace (e.g., 'the cat')"
                      value={replaceTarget}
                      onChange={(e) => setReplaceTarget(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[6px] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Replace with (e.g., 'a golden retriever')"
                      value={replaceWith}
                      onChange={(e) => setReplaceWith(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-[6px] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-orange-500"
                    />
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={replacePreserveStyle}
                        onChange={(e) => setReplacePreserveStyle(e.target.checked)}
                        className="rounded"
                      />
                      Preserve style
                    </label>
                    <button
                      onClick={handleReplaceObject}
                      disabled={!replaceTarget.trim() || !replaceWith.trim() || replaceLoading}
                      className="w-full bg-orange-500 hover:bg-orange-600 rounded-[8px] h-9 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {replaceLoading ? "Replacing..." : "Replace Object"}
                    </button>
                  </div>
                )}

                {/* Depth map side-by-side view */}
                {depthMapView && depthMapResult && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--border)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Depth Map</span>
                      <button onClick={() => setDepthMapView(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Original</p>
                        <img src={getImageUrl(result!.id)} alt="Original" className="w-full rounded-[8px]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Depth Map</p>
                        <img src={getImageUrl(depthMapResult.id)} alt="Depth map" className="w-full rounded-[8px]" />
                      </div>
                    </div>
                    <a
                      href={getDownloadUrl(depthMapResult.id, "png")}
                      className="block text-center w-full bg-[var(--primary)] hover:bg-blue-600 rounded-[8px] h-9 leading-9 text-sm text-white transition-colors"
                    >
                      Download Depth Map
                    </a>
                  </div>
                )}

                {/* GIF export panel */}
                {gifOpen && !inpaintMode && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-pink-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Export as GIF</span>
                      <button onClick={() => setGifOpen(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--muted)] mb-2 block">Effect</span>
                      <div className="flex flex-wrap gap-2">
                        {(["zoom", "pan", "rotate", "pulse", "fade"] as GifEffect[]).map((e) => (
                          <button
                            key={e}
                            onClick={() => setGifEffect(e)}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                              gifEffect === e
                                ? "bg-pink-500/20 border-pink-500 text-pink-400"
                                : "border-[var(--border)] text-[var(--muted)] hover:border-pink-500/50"
                            }`}
                          >
                            {e === "zoom" && "🔍 "}
                            {e === "pan" && "↔️ "}
                            {e === "rotate" && "🔄 "}
                            {e === "pulse" && "💓 "}
                            {e === "fade" && "🌅 "}
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">Duration</span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={0.5}
                        value={gifDuration}
                        onChange={(e) => setGifDuration(parseFloat(e.target.value))}
                        className="flex-1 accent-pink-500"
                      />
                      <span className="text-xs text-[var(--foreground)] w-10 text-right">{gifDuration}s</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)] w-16">FPS</span>
                      <div className="flex gap-2">
                        {[10, 15, 24].map((f) => (
                          <button
                            key={f}
                            onClick={() => setGifFps(f)}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${
                              gifFps === f
                                ? "bg-pink-500 text-white"
                                : "bg-[var(--border)] text-[var(--muted)] hover:bg-pink-500/30"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleExportGif}
                      disabled={gifExporting}
                      className="w-full bg-pink-500 hover:bg-pink-600 rounded-[8px] h-9 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {gifExporting ? "Exporting GIF..." : `Export ${gifEffect} GIF`}
                    </button>
                  </div>
                )}

                {/* Edit history panel */}
                {historyOpen && editHistory.length > 0 && !inpaintMode && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--border)] p-4 space-y-2 max-h-[250px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">Edit History</span>
                      <button onClick={() => setHistoryOpen(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Close
                      </button>
                    </div>
                    {editHistory.map((entry, i) => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm ${
                          entry.id === result?.id
                            ? "bg-[var(--primary)]/20 text-[var(--foreground)] border border-[var(--primary)]/30"
                            : "text-[var(--muted)] hover:bg-[var(--border)]"
                        }`}
                      >
                        <span className="text-xs text-[var(--muted)] w-5">{i + 1}</span>
                        <span className="capitalize">{entry.edit_type.replace("_", " ")}</span>
                        <span className="text-xs text-[var(--muted)] ml-auto">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adjustment sliders */}
                {adjustOpen && (
                  <div className="space-y-3 bg-[var(--surface)] rounded-[12px] border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Adjust Image</span>
                      <button onClick={() => { setAdjustOpen(false); setAdjustParams({ brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpness: 1.0, blur: 0 }); }} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                    {[
                      { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.1, default: 1 },
                      { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.1, default: 1 },
                      { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.1, default: 1 },
                      { key: "sharpness", label: "Sharpness", min: 0, max: 2, step: 0.1, default: 1 },
                      { key: "blur", label: "Blur", min: 0, max: 10, step: 0.5, default: 0 },
                    ].map((s) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--muted)] w-20">{s.label}</span>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={adjustParams[s.key as keyof AdjustParams] ?? s.default}
                          onChange={(e) => setAdjustParams((prev) => ({ ...prev, [s.key]: parseFloat(e.target.value) }))}
                          className="flex-1 accent-[var(--primary)]"
                        />
                        <span className="text-xs text-[var(--foreground)] w-10 text-right">
                          {(adjustParams[s.key as keyof AdjustParams] ?? s.default).toFixed(1)}
                        </span>
                      </div>
                    ))}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setAdjustParams({ brightness: 1.0, contrast: 1.0, saturation: 1.0, sharpness: 1.0, blur: 0 })}
                        className="px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--border)] rounded-[6px]"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleApplyAdjustments}
                        disabled={adjusting}
                        className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[8px] h-8 px-4 text-sm text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {adjusting ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Inpaint controls */}
                {inpaintMode && (
                  <div className="space-y-3 bg-[var(--surface)] rounded-[12px] border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--foreground)]">Draw mask on the area to edit</span>
                      <button onClick={() => { setInpaintMode(false); clearMask(); }} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                    {/* Brush size */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)]">Brush:</span>
                      {BRUSH_SIZES.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBrushSize(b.size)}
                          className={`w-8 h-8 rounded-full text-xs flex items-center justify-center transition-all ${
                            brushSize === b.size
                              ? "bg-[var(--primary)] text-[var(--foreground)]"
                              : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                      <button onClick={undoMask} className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 bg-[var(--border)] rounded-[6px]">
                        Undo
                      </button>
                      <button onClick={clearMask} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 bg-[var(--border)] rounded-[6px]">
                        Clear
                      </button>
                    </div>
                    {/* Inpaint prompt */}
                    <div className="flex gap-2">
                      <input
                        value={inpaintPrompt}
                        onChange={(e) => setInpaintPrompt(e.target.value)}
                        placeholder="What should go in the masked area?"
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-[8px] h-10 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        onKeyDown={(e) => { if (e.key === "Enter") handleInpaint(); }}
                        disabled={inpainting}
                      />
                      <button
                        onClick={handleInpaint}
                        disabled={!inpaintPrompt.trim() || inpainting}
                        className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[8px] h-10 px-4 text-sm text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {inpainting ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Enhanced prompt display */}
                {result.enhanced_prompt && (
                  <div className="p-4 bg-[var(--surface)] rounded-[12px] border border-[var(--border)]">
                    <p className="text-xs text-[var(--muted)] mb-1">Enhanced prompt:</p>
                    <p className="text-sm text-gray-300">{result.enhanced_prompt}</p>
                  </div>
                )}

                {/* Refinement Thread */}
                {thread.length > 2 && (
                  <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--border)] p-4 space-y-3 max-h-[500px] overflow-y-auto">
                    {thread.map((item, i) => (
                      <div key={i}>
                        {item.type === "prompt" && (
                          <div className="bg-[var(--border)] rounded-[12px] px-4 py-3 text-sm text-[var(--foreground)]">
                            {item.text}
                          </div>
                        )}
                        {item.type === "refinement" && (
                          <div>
                            <span className="text-xs text-[var(--muted)] italic">Refinement:</span>
                            <div className="bg-[var(--border)] rounded-[12px] px-4 py-3 text-sm text-[var(--foreground)] italic mt-1">
                              {item.text}
                            </div>
                          </div>
                        )}
                        {item.type === "image" && item.image && i > 0 && i < thread.length - 1 && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getImageUrl(item.image.id)}
                            alt="Refined"
                            className="w-full rounded-[12px] max-h-[300px] object-cover"
                          />
                        )}
                      </div>
                    ))}
                    {refining && (
                      <div className="h-32 bg-[var(--border)] rounded-[12px] animate-pulse" />
                    )}
                  </div>
                )}

                {/* Refinement Input */}
                {!inpaintMode && (
                  <>
                    <div className="flex gap-2 items-center">
                      <input
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        placeholder="Refine this image... (e.g., make it more vibrant)"
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-[8px] h-10 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRefine();
                        }}
                        disabled={refining}
                      />
                      <button
                        onClick={handleRefine}
                        disabled={!refinementInput.trim() || refining}
                        className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[8px] h-10 w-10 flex items-center justify-center text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {refining ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          "→"
                        )}
                      </button>
                    </div>
                    <button onClick={handleStartFresh} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                      ← Start fresh
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* ===== Empty State ===== */
              <div className="w-full aspect-square max-w-xl bg-[var(--surface)] rounded-[12px] flex flex-col items-center justify-center gap-3 border border-[var(--border)] border-dashed">
                <div className="text-5xl opacity-30">🖼️</div>
                <p className="text-[var(--muted)] text-sm">Your generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
