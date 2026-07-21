'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BrandingProvider } from '@/contexts/BrandingContext';
import {
  LayoutDashboard,
  Images,
  Users,
  Upload,
  MessageSquare,
  CreditCard,
  CalendarDays,
  FolderHeart,
  Film,
  Calendar,
  Package,
  Gift,
  Globe,
  Bell,
  Headphones,
  Settings,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true, color: '#D4AF37' },
  { href: '/dashboard/galleries', label: 'Galleries', icon: Images, color: '#8B5CF6' },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, color: '#3B82F6' },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload, color: '#10B981' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare, color: '#F59E0B' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: CreditCard, color: '#10B981' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: CalendarDays, color: '#3B82F6' },
  { href: '/dashboard/packages', label: 'Packages', icon: Package, color: '#8B5CF6' },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: FolderHeart, color: '#F43F5E' },
  { href: '/dashboard/bts', label: 'BTS & Posts', icon: Film, color: '#8B5CF6' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, color: '#F59E0B' },
  { href: '/dashboard/referrals', label: 'Referrals', icon: Gift, color: '#10B981' },
  { href: '/dashboard/social', label: 'Social', icon: Globe, color: '#3B82F6' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, color: '#F59E0B' },
  { href: '/dashboard/support', label: 'Support', icon: Headphones, color: '#8B5CF6' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, color: 'rgba(255,255,255,0.5)' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, email, role, subscription_status, subscription_expires_at, is_lifetime')
        .eq('id', session.user.id)
        .single() as any;

      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      const isActive = profile.role === 'super_admin' || profile.is_lifetime ||
        (profile.subscription_status === 'active' && profile.subscription_expires_at &&
          new Date(profile.subscription_expires_at) > new Date());

      if (!isActive) { router.push('/subscription-expired'); return; }

      if (profile.subscription_expires_at && !profile.is_lifetime) {
        const days = Math.max(0, Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / 86400000));
        setDaysLeft(days);
      }

      setAdminName(profile.name || session.user.email?.split('@')[0] || 'Photographer');
      setAdminEmail(profile.email || session.user.email || '');
      setLoading(false);

      const { data: clients } = await supabase.from('clients').select('id').eq('owner_admin_id', session.user.id);
      if (clients?.length) {
        const clientIds = clients.map((c: any) => c.id);
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .in('client_id', clientIds)
          .eq('sender_role', 'client')
          .eq('is_read', false);
        setInboxUnread(count || 0);
      }

      const { count: supportCount } = await supabase.from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('photographer_id', session.user.id)
        .eq('sender_role', 'super_admin')
        .eq('is_read', false);
      setSupportUnread(supportCount || 0);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#12121e' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(212,175,55,0.6)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#12121e' }}>
      {/* Sidebar */}
      <aside className="w-60 flex flex-col fixed h-full" style={{
        background: 'linear-gradient(180deg, rgba(26,26,46,0.98) 0%, rgba(18,18,30,0.99) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
      }}>
        {/* Logo */}
        <div className="px-6 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#12121e', boxShadow: '0 4px 12px rgba(212,175,55,0.3)' }}>
              E
            </div>
            <div>
              <p className="font-black text-sm" style={{ color: '#D4AF37' }}>Epix Visuals</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Studio Dashboard</p>
            </div>
          </div>
        </div>

        {/* Admin info */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,92,246,0.2))', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">{adminName}</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{adminEmail}</p>
            </div>
          </div>
          {daysLeft !== null && daysLeft <= 7 && (
            <div className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
              ⚠️ {daysLeft} days left — renew soon
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge = item.href === '/dashboard/inbox' && inboxUnread > 0 ? inboxUnread
              : item.href === '/dashboard/support' && supportUnread > 0 ? supportUnread
              : null;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={16} style={{ color: isActive ? '#D4AF37' : item.color, opacity: isActive ? 1 : 0.7 }} />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className="ml-auto min-w-[20px] h-5 rounded-full bg-[#D4AF37] text-[#12121e] text-[10px] font-bold flex items-center justify-center px-1.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="nav-item w-full text-left"
            style={{ color: 'rgba(244,63,94,0.7)' }}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-10 px-8 py-4 flex items-center justify-between"
          style={{ background: 'rgba(18,18,30,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
              ● Active
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="px-8 py-8 fade-in-up">
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </div>
      </main>
    </div>
  );
}
