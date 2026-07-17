'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '◈', exact: true },
  { href: '/dashboard/photographers', label: 'Photographers', icon: '📸' },
  { href: '/dashboard/clients', label: 'All Clients', icon: '👥' },
  { href: '/dashboard/revenue', label: 'Revenue', icon: '💰' },
  { href: '/dashboard/sms-analytics', label: 'SMS Analytics', icon: '📨' },
  { href: '/dashboard/referrals', label: 'Referrals', icon: '🔗' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
  { href: '/dashboard/fraud', label: 'Fraud Detection', icon: '🛡️' },
  { href: '/dashboard/health', label: 'Platform Health', icon: '💓' },
  { href: '/dashboard/features', label: 'Feature Flags', icon: '🚩' },
  { href: '/dashboard/sms-credits', label: 'SMS Credits', icon: '💳' },
  { href: '/dashboard/bulk-sms', label: 'Bulk SMS', icon: '📲' },
  { href: '/dashboard/moderation', label: 'Moderation', icon: '👁️' },
  { href: '/dashboard/chat', label: 'Chat', icon: '💬' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single() as any;
      if (profile?.role !== 'super_admin') { router.push('/login'); return; }
      setLoading(false);

      // Unread messages from photographers
      const { count } = await supabase.from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('sender_role', 'photographer');
      setUnread(count || 0);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#080810' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col fixed h-full"
        style={{ background: 'linear-gradient(180deg, #0F0F1A 0%, #080810 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>E</div>
            <div>
              <p className="font-black text-sm" style={{ color: '#D4AF37' }}>Super Admin</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Platform Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge = item.href === '/dashboard/chat' && unread > 0 ? unread : null;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}>
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold w-full text-left transition-colors hover:bg-white/5"
            style={{ color: 'rgba(255,59,48,0.7)' }}>
            <span className="text-base w-5 text-center">↩</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 min-h-screen">
        <div className="sticky top-0 z-10 px-8 py-4 flex items-center justify-between"
          style={{ background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
            👑 Super Admin
          </span>
        </div>
        <div className="px-8 py-8"><ErrorBoundary>{children}</ErrorBoundary></div>
      </main>
    </div>
  );
}
