'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Copy, Check, ArrowRight, Smartphone, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const GradientBackground = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
);

function UnlockContent() {
    const searchParams = useSearchParams();
    const code = searchParams.get('code') || '';
    const [copied, setCopied] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [triedDeepLink, setTriedDeepLink] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        const mobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const ios = /iPhone|iPad|iPod/i.test(ua);
        const android = /Android/i.test(ua);
        setIsMobile(mobile);
        setIsIOS(ios);
        setIsAndroid(android);
    }, []);

    const deepLink = `epix-visuals://gallery?autoUnlock=true&accessCode=${code}`;
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co';
    const appStoreUrl = 'https://apps.apple.com/app/epix-visuals-studios-co/id6478863262';

    const handleOpenApp = () => {
        window.location.href = deepLink;
        // If deep link fails (app not installed), show download after a delay
        setTimeout(() => setTriedDeepLink(true), 2500);
    };

    const handleCopy = async () => {
        if (!code) return;
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
            <GradientBackground />

            <div className="relative z-20 w-full max-w-md animate-fadeIn">
                <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🔐</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Your Gallery is Ready!</h2>
                        <p className="text-white/60 text-sm">Use the access code below to unlock your photos</p>
                    </div>

                    {/* Access Code Card */}
                    {code && (
                        <div className="mb-6 p-5 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-white/50 text-xs mb-2 uppercase tracking-wider">Access Code</p>
                            <p className="text-3xl font-black text-yellow-400 tracking-widest mb-3">{code}</p>
                            <button
                                onClick={handleCopy}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                            >
                                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
                            </button>
                        </div>
                    )}

                    {!code && (
                        <div className="mb-6 p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                            <p className="text-red-400 text-sm">No access code found. Please check the link and try again.</p>
                        </div>
                    )}

                    {/* Mobile: Open in App */}
                    {isMobile && !triedDeepLink && (
                        <>
                            <button
                                onClick={handleOpenApp}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-3 mb-4"
                            >
                                <Smartphone size={20} />
                                Open in App
                                <ArrowRight size={18} />
                            </button>
                            <p className="text-center text-white/40 text-xs mb-6">
                                The app will open and automatically unlock your gallery
                            </p>
                        </>
                    )}

                    {/* Mobile: App not installed — show download */}
                    {isMobile && triedDeepLink && (
                        <>
                            <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                                <p className="text-yellow-400 text-sm font-medium">Don&apos;t have the app yet?</p>
                                <p className="text-white/50 text-xs mt-1">Download it to view your photos</p>
                            </div>
                            <div className="space-y-3">
                                {isAndroid && (
                                    <a
                                        href={playStoreUrl}
                                        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                                        </svg>
                                        Get on Google Play
                                    </a>
                                )}
                                {isIOS && (
                                    <a
                                        href={appStoreUrl}
                                        className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                        </svg>
                                        Download on the App Store
                                    </a>
                                )}
                            </div>
                            <p className="text-center text-white/40 text-xs mt-4">
                                After installing, open the link again to unlock your gallery
                            </p>
                        </>
                    )}

                    {/* Desktop: Show both options */}
                    {!isMobile && (
                        <>
                            {/* Open in App */}
                            <button
                                onClick={handleOpenApp}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-3 mb-4"
                            >
                                <Smartphone size={20} />
                                Open in App
                                <ArrowRight size={18} />
                            </button>
                            <p className="text-center text-white/40 text-xs mb-6">
                                The app will open and automatically unlock your gallery
                            </p>

                            {/* Divider */}
                            <div className="relative flex items-center justify-center mb-6">
                                <div className="border-t border-white/10 absolute w-full" />
                                <span className="bg-transparent px-4 relative text-white/50 text-sm">don&apos;t have the app?</span>
                            </div>

                            {/* Download Links */}
                            <div className="space-y-3">
                                <Link
                                    href="/download"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors font-medium"
                                >
                                    <Download size={18} />
                                    Download App
                                </Link>

                                <div className="grid grid-cols-2 gap-3">
                                    <a
                                        href={playStoreUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                                        </svg>
                                        Play Store
                                    </a>
                                    <a
                                        href={appStoreUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                        </svg>
                                        App Store
                                    </a>
                                </div>
                            </div>
                        </>
                    )}
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
            `}</style>
        </div>
    );
}

export default function UnlockPage() {
    return (
        <Suspense fallback={
            <div className="relative min-h-screen w-full flex items-center justify-center px-4">
                <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
                <div className="relative z-20 w-full max-w-md">
                    <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10 space-y-4 animate-pulse">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/10" />
                        <div className="h-7 bg-white/10 rounded w-48 mx-auto" />
                        <div className="h-4 bg-white/10 rounded w-64 mx-auto" />
                        <div className="h-20 bg-white/10 rounded-xl" />
                        <div className="h-12 bg-white/10 rounded-xl" />
                    </div>
                </div>
            </div>
        }>
            <UnlockContent />
        </Suspense>
    );
}
