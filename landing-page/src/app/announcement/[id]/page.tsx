'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Smartphone, ArrowRight, Megaphone } from 'lucide-react';

const GradientBackground = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
);

const SUPABASE_URL = 'https://gghqurnamjdxoriuuopf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaHF1cm5hbWpkeG9yaXV1b3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTI4MDEsImV4cCI6MjA5MTkyODgwMX0.VXEMNxA70znWq0dVK3hEkWhG8u5JVu0Z3-xLM3qQYuc';

export default function AnnouncementSharePage() {
    const params = useParams();
    const id = params?.id as string;
    const [announcement, setAnnouncement] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [triedDeepLink, setTriedDeepLink] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        setIsMobile(/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua));
        setIsIOS(/iPhone|iPad|iPod/i.test(ua));
        setIsAndroid(/Android/i.test(ua));
    }, []);

    useEffect(() => {
        if (!id) return;
        fetch(`${SUPABASE_URL}/rest/v1/announcements?id=eq.${id}&select=id,title,content,created_at`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
            },
        })
            .then(r => r.json())
            .then(data => {
                if (data?.length > 0) setAnnouncement(data[0]);
                else setError(true);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    const deepLink = `epix-visuals://announcement?id=${id}`;
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co';
    const appStoreUrl = 'https://apps.apple.com/app/epix-visuals-studios-co/id6478863262';

    const handleOpenApp = () => {
        window.location.href = deepLink;
        setTimeout(() => setTriedDeepLink(true), 2500);
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
            <GradientBackground />

            <div className="relative z-20 w-full max-w-md animate-fadeIn">
                <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10">
                    <div className="mb-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
                            <Megaphone className="w-8 h-8 text-white" />
                        </div>
                        {loading ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-7 bg-white/10 rounded w-48 mx-auto" />
                                <div className="h-4 bg-white/10 rounded w-64 mx-auto" />
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {announcement?.title || 'Announcement'}
                                </h2>
                                {announcement?.content && (
                                    <p className="text-white/60 text-sm line-clamp-3">{announcement.content}</p>
                                )}
                                {!error && !announcement && (
                                    <p className="text-white/60 text-sm">Announcement not found or no longer available.</p>
                                )}
                                {error && (
                                    <p className="text-red-400 text-sm">Unable to load announcement.</p>
                                )}
                            </>
                        )}
                    </div>

                    {!loading && announcement?.created_at && (
                        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Published</p>
                            <p className="text-white font-medium">
                                {new Date(announcement.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    )}
                    {loading && (
                        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
                            <div className="h-3 bg-white/10 rounded w-20 mx-auto mb-2" />
                            <div className="h-4 bg-white/10 rounded w-40 mx-auto" />
                        </div>
                    )}

                    {isMobile && !triedDeepLink && (
                        <>
                            <button
                                onClick={handleOpenApp}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-3 mb-4"
                            >
                                <Smartphone size={20} />
                                View in App
                                <ArrowRight size={18} />
                            </button>
                            <p className="text-center text-white/40 text-xs mb-6">
                                Open the app to view the full announcement
                            </p>
                        </>
                    )}

                    {isMobile && triedDeepLink && (
                        <>
                            <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                                <p className="text-yellow-400 text-sm font-medium">Don&apos;t have the app yet?</p>
                                <p className="text-white/50 text-xs mt-1">Download it to view announcements</p>
                            </div>
                            <div className="space-y-3">
                                {isAndroid && (
                                    <a href={playStoreUrl} className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                                        </svg>
                                        Get on Google Play
                                    </a>
                                )}
                                {isIOS && (
                                    <a href={appStoreUrl} className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                        </svg>
                                        Download on the App Store
                                    </a>
                                )}
                            </div>
                            <p className="text-center text-white/40 text-xs mt-4">
                                After installing, open the link again to view announcements
                            </p>
                        </>
                    )}

                    {!isMobile && (
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
                                Open the app to view the full announcement
                            </p>

                            <div className="relative flex items-center justify-center mb-6">
                                <div className="border-t border-white/10 absolute w-full" />
                                <span className="bg-transparent px-4 relative text-white/50 text-sm">don&apos;t have the app?</span>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                                        </svg>
                                        Play Store
                                    </a>
                                    <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm">
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
