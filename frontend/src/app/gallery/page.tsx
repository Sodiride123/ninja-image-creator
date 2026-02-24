"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listImages,
  getImageUrl,
  getDownloadUrl,
  toggleFavorite,
  listCollections,
  createCollection,
  getCollection,
  addToCollection,
  listVideos,
  getVideoUrl,
  deleteVideo,
  addVideoToCollection,
  type ImageRecord,
  type Collection,
  type VideoRecord,
} from "@/lib/api";

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState<"images" | "videos">("images");

  const [images, setImages] = useState<ImageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ImageRecord | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionImages, setCollectionImages] = useState<ImageRecord[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState<string | null>(null);

  // Videos
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [videoLoading, setVideoLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [addVideoToCollectionOpen, setAddVideoToCollectionOpen] = useState<string | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchImages = useCallback(() => {
    setLoading(true);
    listImages(page, 20, searchDebounced || undefined, favoritesOnly || undefined)
      .then((data) => {
        setImages(data.images);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, searchDebounced, favoritesOnly]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Fetch collections
  const fetchCollections = useCallback(() => {
    listCollections().then((data) => setCollections(data.collections)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      await createCollection(newCollectionName.trim());
      setNewCollectionName("");
      setShowNewCollection(false);
      fetchCollections();
    } catch {}
  };

  const handleViewCollection = async (c: Collection) => {
    try {
      const full = await getCollection(c.id);
      setSelectedCollection(full);
      setCollectionImages(full.images || []);
    } catch {}
  };

  const handleAddToCollection = async (collectionId: string, imageId: string) => {
    try {
      await addToCollection(collectionId, imageId);
      setAddToCollectionOpen(null);
      fetchCollections();
    } catch {}
  };

  const handleToggleFavorite = async (e: React.MouseEvent, img: ImageRecord) => {
    e.stopPropagation();
    try {
      const result = await toggleFavorite(img.id);
      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, favorited: result.favorited } : i))
      );
      if (selected?.id === img.id) {
        setSelected({ ...selected, favorited: result.favorited });
      }
    } catch {}
  };

  // Fetch videos
  const fetchVideos = useCallback(() => {
    setVideoLoading(true);
    listVideos(videoPage, 20)
      .then((data) => {
        setVideos(data.videos);
        setVideoTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setVideoLoading(false));
  }, [videoPage]);

  useEffect(() => {
    if (activeTab === "videos") {
      fetchVideos();
    }
  }, [activeTab, fetchVideos]);

  const handleDeleteVideo = async (videoId: string) => {
    if (deletingVideoId) return;
    setDeletingVideoId(videoId);
    try {
      await deleteVideo(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setVideoTotal((t) => t - 1);
      if (selectedVideo?.id === videoId) setSelectedVideo(null);
    } catch {}
    setDeletingVideoId(null);
  };

  const handleAddVideoToCollection = async (collectionId: string, videoId: string) => {
    try {
      await addVideoToCollection(collectionId, videoId);
      setAddVideoToCollectionOpen(null);
      fetchCollections();
    } catch {}
  };

  const totalPages = Math.ceil(total / 20);
  const videoTotalPages = Math.ceil(videoTotal / 20);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Image Creator
          </h1>
          <Link
            href="/"
            className="text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-[8px] transition-colors"
          >
            + New Image
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-1 w-fit">
          <button
            onClick={() => { setActiveTab("images"); setSelectedCollection(null); }}
            className={`px-5 py-2 rounded-[8px] text-sm font-medium transition-all ${
              activeTab === "images"
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            Images
          </button>
          <button
            onClick={() => { setActiveTab("videos"); setSelectedCollection(null); setSelected(null); }}
            className={`px-5 py-2 rounded-[8px] text-sm font-medium transition-all ${
              activeTab === "videos"
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            Videos
          </button>
        </div>

        {activeTab === "images" && <>
        {/* Search + Filter controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[8px] h-10 pl-9 pr-8 text-sm text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setFavoritesOnly(false); setPage(1); }}
              className={`px-4 py-2 rounded-[8px] text-sm transition-all ${
                !favoritesOnly
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setFavoritesOnly(true); setPage(1); }}
              className={`px-4 py-2 rounded-[8px] text-sm transition-all ${
                favoritesOnly
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white"
              }`}
            >
              ♥ Favorites
            </button>
          </div>
        </div>

        {/* Collections bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCollection(null)}
            className={`px-3 py-1.5 rounded-[8px] text-xs whitespace-nowrap transition-all ${
              !selectedCollection
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white"
            }`}
          >
            All Images
          </button>
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => handleViewCollection(c)}
              className={`px-3 py-1.5 rounded-[8px] text-xs whitespace-nowrap transition-all ${
                selectedCollection?.id === c.id
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white"
              }`}
            >
              📁 {c.name} ({c.image_count})
            </button>
          ))}
          {showNewCollection ? (
            <div className="flex gap-1 items-center">
              <input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="bg-[var(--surface)] border border-[var(--border)] rounded-[6px] h-7 px-2 text-xs text-white focus:outline-none focus:border-[var(--primary)] w-32"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); if (e.key === "Escape") setShowNewCollection(false); }}
              />
              <button onClick={handleCreateCollection} className="text-xs text-[var(--primary)] hover:text-blue-300">Save</button>
              <button onClick={() => setShowNewCollection(false)} className="text-xs text-[var(--muted)] hover:text-white">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCollection(true)}
              className="px-3 py-1.5 rounded-[8px] text-xs bg-[var(--surface)] border border-dashed border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--primary)] transition-all whitespace-nowrap"
            >
              + New Collection
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-4 text-[var(--muted)]">
          {selectedCollection ? `📁 ${selectedCollection.name}` : favoritesOnly ? "Favorites" : "Gallery"} ({selectedCollection ? collectionImages.length : total} images)
          {searchDebounced && !selectedCollection && <span className="text-sm font-normal ml-2">for &quot;{searchDebounced}&quot;</span>}
        </h2>

        {selectedCollection ? (
          /* Collection view */
          collectionImages.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-xl font-semibold text-white mb-2">Empty collection</h3>
              <p className="text-[var(--muted)]">Add images to this collection from the lightbox</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {collectionImages.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setSelected(img)}
                  className="group relative aspect-square rounded-[12px] overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getImageUrl(img.id)} alt={img.prompt} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <p className="text-xs text-white line-clamp-3">{img.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-[var(--surface)] rounded-xl animate-pulse border border-[var(--border)]"
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">{searchDebounced || favoritesOnly ? "🔍" : "🎨✨"}</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchDebounced ? "No results found" : favoritesOnly ? "No favorites yet" : "No images yet"}
            </h3>
            <p className="text-[var(--muted)] mb-6">
              {searchDebounced
                ? "Try a different search term"
                : favoritesOnly
                ? "Heart some images to see them here"
                : "Start creating by generating your first image"}
            </p>
            {!searchDebounced && !favoritesOnly && (
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-[8px] transition-colors"
              >
                Create Your First Image
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelected(img)}
                  className="group relative aspect-square rounded-[12px] overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(img.id)}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                  />
                  {/* Favorite heart */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, img)}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
                  >
                    {img.favorited ? "❤️" : "🤍"}
                  </button>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <p className="text-xs text-white line-clamp-3">
                      {img.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-[var(--muted)]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
        </>}

        {/* Videos Tab */}
        {activeTab === "videos" && (
          <>
            <h2 className="text-lg font-semibold mb-4 text-[var(--muted)]">
              Videos ({videoTotal})
            </h2>

            {videoLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-[var(--surface)] rounded-xl animate-pulse border border-[var(--border)]"
                  />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold text-white mb-2">No videos yet</h3>
                <p className="text-[var(--muted)] mb-6">Generate your first video from the creation page</p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-[8px] transition-colors"
                >
                  Create a Video
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => video.status === "completed" && setSelectedVideo(video)}
                      className="group relative aspect-video rounded-[12px] overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition-colors bg-[var(--surface)]"
                    >
                      {video.status === "completed" && video.filename ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <video
                            src={getVideoUrl(video.id)}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <span className="text-white text-xl ml-1">▶</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          {video.status === "failed" ? (
                            <span className="text-red-400 text-sm">Failed</span>
                          ) : (
                            <>
                              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs text-[var(--muted)]">{video.progress}%</span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <p className="text-xs text-white line-clamp-2">{video.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {videoTotalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => setVideoPage((p) => Math.max(1, p - 1))}
                      disabled={videoPage === 1}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-[var(--muted)]">
                      {videoPage} / {videoTotalPages}
                    </span>
                    <button
                      onClick={() => setVideoPage((p) => Math.min(videoTotalPages, p + 1))}
                      disabled={videoPage === videoTotalPages}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Lightbox Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-3xl w-full bg-[var(--surface)] rounded-[12px] overflow-hidden border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(selected.id)}
              alt={selected.prompt}
              className="w-full h-auto"
            />
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-300 flex-1">{selected.prompt}</p>
                <button
                  onClick={(e) => handleToggleFavorite(e, selected)}
                  className="text-xl hover:scale-110 transition-transform shrink-0"
                >
                  {selected.favorited ? "❤️" : "🤍"}
                </button>
              </div>
              {selected.enhanced_prompt && (
                <p className="text-xs text-[var(--muted)]">
                  Enhanced: {selected.enhanced_prompt}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>
                  {selected.style !== "none" ? selected.style : ""}{" "}
                  {selected.size}
                  {selected.upscaled && ` (${selected.upscale_factor}x upscaled)`}
                </span>
                <span>
                  {new Date(selected.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-3">
                <a
                  href={getDownloadUrl(selected.id, "png")}
                  className="flex-1 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-center rounded-lg text-sm transition-colors"
                >
                  Download PNG
                </a>
                <a
                  href={getDownloadUrl(selected.id, "jpeg")}
                  className="py-2 px-3 bg-[var(--border)] hover:bg-gray-600 text-white text-center rounded-lg text-sm transition-colors"
                >
                  JPEG
                </a>
                <a
                  href={getDownloadUrl(selected.id, "webp")}
                  className="py-2 px-3 bg-[var(--border)] hover:bg-gray-600 text-white text-center rounded-lg text-sm transition-colors"
                >
                  WebP
                </a>
                <button
                  onClick={() => setSelected(null)}
                  className="py-2 px-4 bg-[var(--border)] hover:bg-gray-600 text-white text-center rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
              {/* Add to collection */}
              {collections.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setAddToCollectionOpen(addToCollectionOpen === selected.id ? null : selected.id)}
                    className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                  >
                    📁 Add to collection
                  </button>
                  {addToCollectionOpen === selected.id && (
                    <div className="absolute bottom-full mb-2 left-0 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] p-2 shadow-xl z-30 min-w-[160px] space-y-1">
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleAddToCollection(c.id, selected.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:bg-[#334155] rounded-[6px] transition-colors"
                        >
                          📁 {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Video Lightbox Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="max-w-3xl w-full bg-[var(--surface)] rounded-[12px] overflow-hidden border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={getVideoUrl(selectedVideo.id)}
              className="w-full h-auto"
              controls
              autoPlay
            />
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-300">{selectedVideo.prompt}</p>
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>
                  {selectedVideo.model} &middot; {selectedVideo.size} &middot; {selectedVideo.quality}
                </span>
                <span>
                  {new Date(selectedVideo.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-3">
                <a
                  href={getVideoUrl(selectedVideo.id)}
                  download
                  className="flex-1 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-center rounded-lg text-sm transition-colors"
                >
                  Download MP4
                </a>
                <button
                  onClick={() => handleDeleteVideo(selectedVideo.id)}
                  disabled={deletingVideoId === selectedVideo.id}
                  className="py-2 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {deletingVideoId === selectedVideo.id ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="py-2 px-4 bg-[var(--border)] hover:bg-gray-600 text-white text-center rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
              {/* Add to collection */}
              {collections.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setAddVideoToCollectionOpen(addVideoToCollectionOpen === selectedVideo.id ? null : selectedVideo.id)}
                    className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                  >
                    📁 Add to collection
                  </button>
                  {addVideoToCollectionOpen === selectedVideo.id && (
                    <div className="absolute bottom-full mb-2 left-0 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] p-2 shadow-xl z-30 min-w-[160px] space-y-1">
                      {collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleAddVideoToCollection(c.id, selectedVideo.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:bg-[#334155] rounded-[6px] transition-colors"
                        >
                          📁 {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
