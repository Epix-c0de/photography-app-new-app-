'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Lock,
  Unlock,
  X,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  ImageIcon,
  Loader2,
  Eye,
} from 'lucide-react';
const SUPABASE_URL = 'https://gghqurnamjdxoriuuopf.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaHF1cm5hbWpkeG9yaXV1b3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTI4MDEsImV4cCI6MjA5MTkyODgwMX0.VXEMNxA70znWq0dVK3hEkWhG8u5JVu0Z3-xLM3qQYuc';

const rpcHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

interface ShareValidation {
  valid: boolean;
  error_message?: string;
  share_id?: string;
  gallery_name?: string;
  requires_password?: boolean;
  allow_downloads?: boolean;
  allow_resharing?: boolean;
  expiration_date?: string;
  photo_count?: number;
}

interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  caption?: string;
}

function SkeletonLoader() {
  return (
    <div className="min-h-screen w-full bg-[#141414] flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/5 animate-pulse" />
          <div className="h-7 w-48 mx-auto rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-32 mx-auto rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="p-8 rounded-2xl bg-black/50 border border-white/10 backdrop-blur space-y-4">
          <div className="h-10 w-full rounded-lg bg-white/5 animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PasswordGate({
  galleryName,
  password,
  setPassword,
  onSubmit,
  error,
  loading,
}: {
  galleryName: string;
  password: string;
  setPassword: (v: string) => void;
  onSubmit: () => void;
  error: string;
  loading: boolean;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() && !loading) onSubmit();
  };

  return (
    <div className="min-h-screen w-full bg-[#141414] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="p-8 rounded-2xl bg-black/50 border border-white/10 backdrop-blur">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8960C] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
              <Lock className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{galleryName}</h2>
            <p className="text-white/60 text-sm">This gallery is password protected</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim() || loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-black font-bold text-lg hover:from-[#E0C04A] hover:to-[#D4AF37] transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  Unlock Gallery
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full bg-[#141414] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="p-8 rounded-2xl bg-black/50 border border-white/10 backdrop-blur text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Gallery</h2>
          <p className="text-white/60 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}

function FullscreenViewer({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
  allowDownloads,
  allowResharing,
  onDownload,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  allowDownloads: boolean;
  allowResharing: boolean;
  onDownload: (photo: Photo) => void;
}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastTouch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const lastTap = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const photo = photos[index];

  const resetTransform = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetTransform();
  }, [index, resetTransform]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, []);

  const getTouchDist = (t1: any, t2: any) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e: any) => {
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      lastTouch.current = { dist, mid };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouch.current) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const ratio = newDist / lastTouch.current.dist;
      setScale((s) => Math.min(Math.max(s * ratio, 0.5), 5));
      lastTouch.current.dist = newDist;
    }
  };

  const handleTouchEnd = () => {
    lastTouch.current = null;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1) {
        resetTransform();
      } else {
        setScale(2.5);
      }
    }
    lastTap.current = now;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: photo.caption || 'Gallery Photo', url: photo.url });
      } catch {}
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/70 text-sm font-medium">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          {allowDownloads && (
            <button
              onClick={() => onDownload(photo)}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Download photo"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          {allowResharing && (
            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Share photo"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <button
          onClick={onPrev}
          className="absolute left-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div
          className="w-full h-full flex items-center justify-center cursor-zoom-in select-none"
          onClick={handleDoubleTap}
        >
          <img
            src={photo.url}
            alt={photo.caption || `Photo ${index + 1}`}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
            }}
            draggable={false}
          />
        </div>

        <button
          onClick={onNext}
          className="absolute right-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function GalleryContent({ id, code }: { id: string; code: string | null }) {
  const [validation, setValidation] = useState<ShareValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const validate = async (pwd?: string) => {
      try {
        setLoading(true);
        setError('');

        const body: Record<string, string> = { p_share_token: id };
        if (pwd) body.p_password = pwd;

        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_share_access`, {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          setError('Failed to validate gallery access.');
          setLoading(false);
          return;
        }

        const data: ShareValidation = await res.json();
        setValidation(data);

        if (data.valid && data.share_id) {
          fetchPhotos(data.share_id);
        }
      } catch {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      validate(code);
    } else {
      validate();
    }
  }, [id, code]);

  const fetchPhotos = async (shareId: string) => {
    try {
      setPhotosLoading(true);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_share_photos`, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({ p_share_id: shareId }),
      });

      if (!res.ok) {
        setPhotos([]);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setPhotos(data);
      } else {
        setPhotos([]);
      }
    } catch {
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim() || passwordLoading) return;

    try {
      setPasswordLoading(true);
      setPasswordError('');

      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_share_access`, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({ p_share_token: id, p_password: password }),
      });

      if (!res.ok) {
        setPasswordError('Failed to validate password.');
        setPasswordLoading(false);
        return;
      }

      const data: ShareValidation = await res.json();

      if (data.valid) {
        setValidation(data);
        if (data.share_id) {
          fetchPhotos(data.share_id);
        }
      } else {
        setPasswordError(data.error_message || 'Incorrect password. Please try again.');
      }
    } catch {
      setPasswordError('An unexpected error occurred.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDownload = async (photo: Photo) => {
    if (!validation?.allow_downloads) return;

    try {
      if (validation.share_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/gallery_downloads`, {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify({
            share_id: validation.share_id,
            photo_id: photo.id,
            downloaded_at: new Date().toISOString(),
          }),
        });
      }

      const link = document.createElement('a');
      link.href = photo.url;
      link.download = `photo-${photo.id}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {}
  };

  const formatExpiration = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    return `Expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  if (error) {
    return <ErrorView message={error} />;
  }

  if (validation && !validation.valid && validation.requires_password) {
    return (
      <PasswordGate
        galleryName={validation.gallery_name || 'Gallery'}
        password={password}
        setPassword={setPassword}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
        loading={passwordLoading}
      />
    );
  }

  if (validation && !validation.valid) {
    return (
      <ErrorView message={validation.error_message || 'This gallery is not available or has expired.'} />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#141414]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {validation?.gallery_name || 'Gallery'}
          </h1>

          <div className="flex items-center gap-4 flex-wrap">
            {validation?.photo_count !== undefined && (
              <div className="flex items-center gap-1.5 text-white/50 text-sm">
                <Eye className="w-4 h-4" />
                <span>
                  {photos.length || validation.photo_count} photo
                  {(photos.length || validation.photo_count) !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {validation?.expiration_date && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[#D4AF37] text-xs font-medium">
                  {formatExpiration(validation.expiration_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-lg">No photos in this gallery</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setViewerIndex(idx)}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-[#D4AF37]/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60"
              >
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.caption || `Photo ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 text-xs font-medium">
                      {idx + 1}
                    </span>
                    <div className="flex gap-1.5">
                      {validation?.allow_downloads && (
                        <div className="p-1.5 rounded-md bg-black/50 backdrop-blur">
                          <Download className="w-3.5 h-3.5 text-white/70" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && (
        <FullscreenViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() =>
            setViewerIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
          }
          onNext={() =>
            setViewerIndex((prev) =>
              prev !== null && prev < photos.length - 1 ? prev + 1 : prev
            )
          }
          allowDownloads={validation?.allow_downloads ?? false}
          allowResharing={validation?.allow_resharing ?? false}
          onDownload={handleDownload}
        />
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

function GalleryPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const code = searchParams.get('code');

  return <GalleryContent id={id} code={code} />;
}

export default function GallerySharePage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <GalleryPageInner />
    </Suspense>
  );
}
