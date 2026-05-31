'use client';

import Link from 'next/link';

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="text-7xl">🎉</div>

        <div>
          <h1 className="text-4xl font-black mb-4">Welcome to Epix Visuals!</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Your account is active. Download the admin app to start uploading galleries and managing your clients.
          </p>
        </div>

        <div className="bg-card border border-gold/20 rounded-3xl p-8 space-y-6">
          <h2 className="text-xl font-bold">Download the Admin App</h2>

          <div className="space-y-3">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 hover:bg-white/10 transition-colors"
            >
              <span className="text-2xl">🤖</span>
              <div className="text-left">
                <p className="text-xs text-gray-400">Download on</p>
                <p className="font-bold">Google Play</p>
              </div>
            </a>

            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 hover:bg-white/10 transition-colors"
            >
              <span className="text-2xl">🍎</span>
              <div className="text-left">
                <p className="text-xs text-gray-400">Download on the</p>
                <p className="font-bold">App Store</p>
              </div>
            </a>
          </div>
        </div>

        <div className="bg-card border border-white/5 rounded-2xl p-6 text-left space-y-3">
          <h3 className="font-bold text-gold">Next steps:</h3>
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-3"><span className="text-gold font-bold">1.</span> Download and open the admin app</li>
            <li className="flex gap-3"><span className="text-gold font-bold">2.</span> Sign in with your email and password</li>
            <li className="flex gap-3"><span className="text-gold font-bold">3.</span> Upload your first client gallery</li>
            <li className="flex gap-3"><span className="text-gold font-bold">4.</span> Share the access code with your client</li>
          </ol>
        </div>

        <p className="text-gray-500 text-sm">
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" className="text-gold hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}
