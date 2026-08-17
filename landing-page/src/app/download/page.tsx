'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, Download, Smartphone, Shield, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const VIDEO_URL = 'https://videos.pexels.com/video-files/8128311/8128311-uhd_2560_1440_25fps.mp4';

function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-black/30 z-10" />
      <video
        ref={videoRef}
        className="absolute inset-0 min-w-full min-h-full object-cover w-auto h-auto"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
    </div>
  );
}

export default function DownloadPage() {
  const [adminApk, setAdminApk] = useState<any>(null);
  const [clientApk, setClientApk] = useState<any>(null);
  const [loadingApk, setLoadingApk] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/apk/download?type=admin')
      .then(r => r.json())
      .then(data => { if (data.version) setAdminApk(data); })
      .catch(() => {});

    fetch('/api/apk/download?type=client')
      .then(r => r.json())
      .then(data => { if (data.version) setClientApk(data); })
      .catch(() => {})
      .finally(() => setLoadingApk(false));
  }, []);

  const handleDownload = async (type: 'admin' | 'client') => {
    const apk = type === 'admin' ? adminApk : clientApk;
    if (!apk?.download_url) return;

    setDownloading(type);
    setDownloadComplete(null);

    const a = document.createElement('a');
    a.href = apk.download_url;
    a.download = apk.filename || `epix-${type}.apk`;
    a.click();

    setTimeout(() => {
      setDownloading(null);
      setDownloadComplete(type);
      setTimeout(() => setDownloadComplete(null), 3000);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
      <VideoBackground />

      <div className="relative z-20 w-full max-w-md" style={{ animation: 'fadeIn 0.5s ease-out' }}>
        {/* Back to home */}
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors text-sm">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* Main Card */}
        <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10">
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold mb-2 relative group">
              <span className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-blue-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500 animate-pulse" />
              <span className="relative inline-block text-3xl font-bold mb-2 text-white">
                Download Apps
              </span>
            </h2>
            <p className="text-white/80 flex flex-col items-center space-y-1">
              <span className="relative group cursor-default">
                <span className="relative inline-block">Get the Epix Shots apps for your device</span>
              </span>
              <span className="text-xs text-white/50">
                Available for Android devices
              </span>
              <div className="flex space-x-2 text-xs text-white/40">
                <span>📱</span>
                <span className="animate-bounce">📷</span>
                <span>🏆</span>
              </div>
            </p>
          </div>

          {/* Download Cards */}
          <div className="space-y-4">
            {/* Admin App Card */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Admin App</h3>
                  <p className="text-white/50 text-sm">For photographers & studios</p>
                </div>
              </div>

              <p className="text-white/60 text-sm mb-4">
                Manage galleries, clients, bookings, and payments. Upload photos, track revenue, and grow your photography business.
              </p>

              {adminApk && (
                <div className="flex items-center gap-2 mb-4 text-xs text-white/40">
                  <span>Version {adminApk.version}</span>
                  <span>•</span>
                  <span>{(adminApk.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              )}

              <button
                onClick={() => handleDownload('admin')}
                disabled={!adminApk || downloading === 'admin'}
                className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${
                  downloadComplete === 'admin'
                    ? 'bg-green-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                }`}
              >
                {downloadComplete === 'admin' ? (
                  <>
                    <CheckCircle size={18} />
                    Download Started
                  </>
                ) : downloading === 'admin' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download Admin APK
                  </>
                )}
              </button>
            </div>

            {/* Client App Card */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all duration-300 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Client App</h3>
                  <p className="text-white/50 text-sm">For photography clients</p>
                </div>
              </div>

              <p className="text-white/60 text-sm mb-4">
                Access your photo galleries, view and download high-resolution images, and share your beautiful moments with family and friends.
              </p>

              {clientApk && (
                <div className="flex items-center gap-2 mb-4 text-xs text-white/40">
                  <span>Version {clientApk.version}</span>
                  <span>•</span>
                  <span>{(clientApk.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              )}

              <button
                onClick={() => handleDownload('client')}
                disabled={!clientApk || downloading === 'client'}
                className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${
                  downloadComplete === 'client'
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40'
                }`}
              >
                {downloadComplete === 'client' ? (
                  <>
                    <CheckCircle size={18} />
                    Download Started
                  </>
                ) : downloading === 'client' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download Client APK
                  </>
                )}
              </button>
            </div>
          </div>

          {/* No APKs available */}
          {!loadingApk && !adminApk && !clientApk && (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">Apps are not available for download yet. Check back later.</p>
            </div>
          )}

          {/* Store Links */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-white/40 text-xs text-center mb-3">Or download from stores</p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-sm font-medium transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                </svg>
                Play Store
              </a>
              <a
                href="https://apps.apple.com/app/epix-visuals-studios-co/id6478863262"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-sm font-medium transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-white/40 text-xs">
          <p>Need help? <a href="mailto:info@epixshots.co.ke" className="text-white/60 hover:text-white transition-colors">Contact support</a></p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
