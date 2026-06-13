'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PhotographerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, subscription_status, subscription_expires_at, is_lifetime')
        .eq('id', data.user.id)
        .single() as any;

      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin accounts only.');
      }

      // Check subscription
      const isActive = profile.role === 'super_admin' || profile.is_lifetime ||
        (profile.subscription_status === 'active' && profile.subscription_expires_at &&
          new Date(profile.subscription_expires_at) > new Date());

      if (!isActive) {
        router.push('/subscription-expired');
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, #080810 60%)' }}>

      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="w-full max-w-sm relative">
        {/* Glow */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 70%)', filter: 'blur(20px)' }} />

        <div className="relative" style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(13,13,25,0.95) 100%)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: 24,
          padding: 36,
          backdropFilter: 'blur(20px)',
        }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', boxShadow: '0 8px 32px rgba(212,175,55,0.3)' }}>
              📸
            </div>
            <h1 className="text-2xl font-black" style={{
              background: 'linear-gradient(90deg, #D4AF37, #F0D060)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Epix Visuals
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Photographer Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-xl p-3 text-sm"
                style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-2"
                style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.co.ke"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  color: 'white',
                  padding: '12px 16px',
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2"
                style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  color: 'white',
                  padding: '12px 16px',
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'rgba(212,175,55,0.4)' : 'linear-gradient(135deg, #D4AF37 0%, #F0D060 100%)',
                color: '#080810',
                fontWeight: 700,
                borderRadius: 12,
                padding: '14px',
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                marginTop: 8,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Signing in...' : 'Access Dashboard →'}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Don't have an account?{' '}
            <a href="http://localhost:3000/signup" style={{ color: 'rgba(212,175,55,0.6)' }}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
