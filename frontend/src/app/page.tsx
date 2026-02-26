"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  generateImage,
  enhancePrompt,
  refineImage,
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
  watermarkImage,
  exportSvg,
  replaceObject,
  detectScript,
  type ImageRecord,
  type VideoRecord,
  type AdjustParams,
  type PromptEntry,
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

const BRUSH_SIZES = [
  { id: "small", label: "S", size: 10 },
  { id: "medium", label: "M", size: 25 },
  { id: "large", label: "L", size: 50 },
];


export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("none");
  const [size, setSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Results
  const [result, setResultRaw] = useState<ImageRecord | null>(null);

  // Undo/redo history stack
  const [resultHistory, setResultHistory] = useState<ImageRecord[]>([]);
  const [resultIndex, setResultIndex] = useState(-1);
  const canUndo = resultIndex > 0;
  const canRedo = resultIndex < resultHistory.length - 1;

  const setResult = useCallback((img: ImageRecord | null) => {
    setResultRaw(img);
    if (img) {
      setResultHistory((prev) => {
        const trimmed = prev.slice(0, resultIndex + 1);
        return [...trimmed, img];
      });
      setResultIndex((prev) => prev + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultIndex]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prevIndex = resultIndex - 1;
    setResultIndex(prevIndex);
    setResultRaw(resultHistory[prevIndex]);
  }, [canUndo, resultIndex, resultHistory]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIndex = resultIndex + 1;
    setResultIndex(nextIndex);
    setResultRaw(resultHistory[nextIndex]);
  }, [canRedo, resultIndex, resultHistory]);

  // Refinement
  const [refinementInput, setRefinementInput] = useState("");
  const [refining, setRefining] = useState(false);

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
  const [videoProgress, setVideoProgress] = useState(0);
  const videoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Image-to-video (animate)
  const [animateOpen, setAnimateOpen] = useState(false);
  const [animatePrompt, setAnimatePrompt] = useState("");
  const [animateQuality, setAnimateQuality] = useState<"standard" | "pro">("standard");
  const [animating, setAnimating] = useState(false);
  const [animateResult, setAnimateResult] = useState<VideoRecord | null>(null);
  const [animateElapsed, setAnimateElapsed] = useState(0);
  const [animateProgress, setAnimateProgress] = useState(0);
  const animatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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



  // Watermark
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(36);
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarking, setWatermarking] = useState(false);


  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sprint 7: Text overlay
  const [textOverlayOpen, setTextOverlayOpen] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [overlayFont, setOverlayFont] = useState("bold");
  const [overlayPlacement, setOverlayPlacement] = useState("center");

  // Sprint 8: SVG export, object replacement
  const [svgExporting, setSvgExporting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [replacePreserveStyle, setReplacePreserveStyle] = useState(true);
  const [replaceLoading, setReplaceLoading] = useState(false);

  // Sprint 9: Multi-language text
  const [detectedScript, setDetectedScript] = useState<string | null>(null);
  const [detectedDirection, setDetectedDirection] = useState<string>("ltr");


  const clearResults = () => {
    setResultRaw(null);
    setResultHistory([]);
    setResultIndex(-1);
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
    setWatermarkOpen(false);
    setWatermarkText("");
    setReplaceOpen(false);
    setReplaceTarget("");
    setReplaceWith("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    clearResults();

    try {
      if (referenceFile) {
        const image = await generateFromImage(prompt, referenceFile, style, size);
        setResult(image);
      } else {
        const req_params = {
          prompt, style, size,
          text_overlay: textOverlayOpen && overlayText ? { text: overlayText, font_hint: overlayFont, placement: overlayPlacement } as TextOverlay : undefined,
        };
        const image = (await generateImage(req_params)) as ImageRecord;
        setResult(image);
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

  const handleReplaceObject = async () => {
    if (!result || !replaceTarget.trim() || !replaceWith.trim()) return;
    setReplaceLoading(true);
    setError("");
    try {
      const replaced = await replaceObject(result.id, replaceTarget, replaceWith, replacePreserveStyle);
      setResult(replaced);
      setReplaceOpen(false);
      setReplaceTarget("");
      setReplaceWith("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Object replacement failed");
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refinementInput.trim() || !result) return;
    setRefining(true);
    setError("");
    const instruction = refinementInput;
    setRefinementInput("");

    try {
      const refined = await refineImage(result.id, instruction);
      setResult(refined);
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
    setVideoProgress(0);

    try {
      const video = await generateVideo(prompt, videoSize, videoQuality);
      // Start polling
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        setVideoElapsed(Math.floor((Date.now() - startTime) / 1000));
        try {
          const status = await getVideoStatus(video.id);
          setVideoProgress(status.progress || 0);
          if (status.status === "completed") {
            clearInterval(pollInterval);
            videoPollRef.current = null;
            setVideoResult(status);
            setVideoLoading(false);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            videoPollRef.current = null;
            setError(typeof status.error === "string" ? status.error : status.error?.message || "Video generation failed");
            setVideoLoading(false);
          }
        } catch {
          // Keep polling on transient errors
        }
      }, 5000);
      videoPollRef.current = pollInterval;
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
    setAnimateProgress(0);

    try {
      const video = await imageToVideo(result.id, animatePrompt, animateQuality);
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        setAnimateElapsed(Math.floor((Date.now() - startTime) / 1000));
        try {
          const status = await getVideoStatus(video.id);
          setAnimateProgress(status.progress || 0);
          if (status.status === "completed") {
            clearInterval(pollInterval);
            animatePollRef.current = null;
            setAnimateResult(status);
            setAnimating(false);
          } else if (status.status === "failed") {
            clearInterval(pollInterval);
            animatePollRef.current = null;
            setError(typeof status.error === "string" ? status.error : status.error?.message || "Animation failed");
            setAnimating(false);
          }
        } catch {
          // Keep polling
        }
      }, 5000);
      animatePollRef.current = pollInterval;
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


  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

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

  // Social template selection
  const handleTemplateSelect = (tmpl: typeof SOCIAL_TEMPLATES[0]) => {
    setSelectedTemplate(tmpl.id);
    setSize(tmpl.size);
  };



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
                      Standard
                    </button>
                    <button
                      onClick={() => setVideoQuality("pro")}
                      className={`flex-1 py-2 rounded-[8px] text-sm transition-all ${
                        videoQuality === "pro"
                          ? "bg-[var(--primary)] text-[var(--foreground)]"
                          : "bg-[var(--border)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      Pro
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
                      Generating Video... {videoProgress}% ({videoElapsed}s)
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
                <p className="text-[var(--foreground)] text-sm font-medium">Generating video... {videoProgress}%</p>
                <div className="w-48 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-500" style={{ width: `${videoProgress}%` }} />
                </div>
                <p className="text-[var(--muted)] text-xs">
                  Elapsed: {videoElapsed}s
                </p>
                {videoElapsed > 300 && (
                  <p className="text-yellow-500 text-xs">Generation is taking longer than expected. You can cancel and retry.</p>
                )}
                <button
                  onClick={() => { if (videoPollRef.current) { clearInterval(videoPollRef.current); videoPollRef.current = null; } setVideoLoading(false); setVideoElapsed(0); setVideoProgress(0); }}
                  className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
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
                <p className="text-[var(--foreground)] text-sm font-medium">Animating image... {animateProgress}%</p>
                <div className="w-48 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${animateProgress}%` }} />
                </div>
                <p className="text-[var(--muted)] text-xs">
                  Elapsed: {animateElapsed}s
                </p>
                {animateElapsed > 300 && (
                  <p className="text-yellow-500 text-xs">Animation is taking longer than expected. You can cancel and retry.</p>
                )}
                <button
                  onClick={() => { if (animatePollRef.current) { clearInterval(animatePollRef.current); animatePollRef.current = null; } setAnimating(false); setAnimateElapsed(0); setAnimateProgress(0); }}
                  className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
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
                  Creating your image...
                </p>
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
                      onClick={() => { setWatermarkOpen(!watermarkOpen); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        watermarkOpen
                          ? "border-amber-500 text-amber-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-amber-500"
                      }`}
                    >
                      💧 Watermark
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
                      onClick={() => { setReplaceOpen(!replaceOpen); }}
                      className={`px-4 py-2 bg-[var(--surface)] border rounded-[8px] text-sm transition-all ${
                        replaceOpen
                          ? "border-orange-500 text-orange-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-orange-500"
                      }`}
                    >
                      🔄 Replace
                    </button>
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Undo (⌘Z)"
                    >
                      ↩ Undo
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Redo (⌘⇧Z)"
                    >
                      ↪ Redo
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
                    <p className="text-sm text-[var(--foreground)] opacity-80">{result.enhanced_prompt}</p>
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
