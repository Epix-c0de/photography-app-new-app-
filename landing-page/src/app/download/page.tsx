'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, Download, Smartphone, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const VIDEO_URL = 'https://videos.pexels.com/video-files/8128311/8128311-uhd_2560_1440_25fps.mp4';

// VideoBackground Component — copied from epix-shots-gallery-app
const VideoBackground = ({ videoUrl }: { videoUrl: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(error => {
                console.error("Video autoplay failed:", error);
            });
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
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};

export default function DownloadPage() {
    const [clientApk, setClientApk] = useState<any>(null);
    const [loadingApk, setLoadingApk] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);

    useEffect(() => {
        fetch('/api/apk/download?type=client')
            .then(r => r.json())
            .then(data => { if (data.version) setClientApk(data); })
            .catch(() => {})
            .finally(() => setLoadingApk(false));
    }, []);

    const handleDownload = async () => {
        if (!clientApk?.download_url) return;

        setDownloading(true);
        setDownloadComplete(false);

        const a = document.createElement('a');
        a.href = clientApk.download_url;
        a.download = clientApk.filename || 'epix-client.apk';
        a.click();

        setTimeout(() => {
            setDownloading(false);
            setDownloadComplete(true);
            setTimeout(() => setDownloadComplete(false), 3000);
        }, 1500);
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
            <VideoBackground videoUrl={VIDEO_URL} />

            <div className="relative z-20 w-full max-w-md animate-fadeIn">
                {/* Back to home */}
                <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors text-sm">
                    <ArrowLeft size={16} />
                    Back to Home
                </Link>

                {/* Main Card — exact copy of gaming-login card style */}
                <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10">
                    {/* Header — same style, changed text */}
                    <div className="mb-8 text-center">
                        <h2 className="text-3xl font-bold mb-2 relative group">
                            <span className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-blue-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500 animate-pulse"></span>
                            <span className="relative inline-block text-3xl font-bold mb-2 text-white">
                                Epix Shots
                            </span>
                            <span className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300"></span>
                        </h2>
                        <p className="text-white/80 flex flex-col items-center space-y-1">
                            <span className="relative group cursor-default">
                                <span className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                                <span className="relative inline-block animate-pulse">Your photography universe awaits</span>
                            </span>
                            <span className="text-xs text-white/50 animate-pulse">
                                [Download the app to get started]
                            </span>
                            <div className="flex space-x-2 text-xs text-white/40">
                                <span className="animate-pulse">📱</span>
                                <span className="animate-bounce">📷</span>
                                <span className="animate-pulse">🏆</span>
                            </div>
                        </p>
                    </div>

                    {/* Download Card — styled like the login form */}
                    <div className="space-y-6">
                        <div className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all duration-300 group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
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
                                onClick={handleDownload}
                                disabled={!clientApk || downloading}
                                className={`w-full py-3 rounded-lg ${downloadComplete
                                        ? 'bg-green-600'
                                        : 'bg-purple-600 hover:bg-purple-700'
                                    } text-white font-medium transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 flex items-center justify-center gap-2`}
                            >
                                {downloadComplete ? (
                                    <>
                                        <CheckCircle size={18} />
                                        Download Started
                                    </>
                                ) : downloading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Downloading...
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} />
                                        Download App
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* No APKs available */}
                    {!loadingApk && !clientApk && (
                        <div className="text-center py-8">
                            <p className="text-white/40 text-sm">App is not available for download yet. Check back later.</p>
                        </div>
                    )}

                    {/* Store Links — styled like social buttons */}
                    <div className="mt-6">
                        <div className="relative flex items-center justify-center">
                            <div className="border-t border-white/10 absolute w-full"></div>
                            <div className="bg-transparent px-4 relative text-white/60 text-sm">
                                or download from stores
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <a
                                href="https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center p-2 bg-white/5 border border-white/10 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                            >
                                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                                </svg>
                                Play Store
                            </a>
                            <a
                                href="https://apps.apple.com/app/epix-visuals-studios-co/id6478863262"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center p-2 bg-white/5 border border-white/10 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
                            >
                                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                </svg>
                                App Store
                            </a>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-white/60">
                        Need help?{' '}
                        <a href="mailto:info@epixshots.co.ke" className="font-medium text-white hover:text-purple-300 transition-colors">
                            Contact support
                        </a>
                    </p>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-in-out;
                }
                @keyframes success {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.9; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-success {
                    animation: success 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
}
