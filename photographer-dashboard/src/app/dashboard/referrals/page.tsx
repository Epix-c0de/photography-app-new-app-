'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Gift, Copy, Share2, Users, CreditCard, TrendingUp, 
  Loader2, CheckCircle, ExternalLink, MessageSquare 
} from 'lucide-react';

type ReferralStats = {
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_credits_earned: number;
  referral_code: string | null;
};

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-referral`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'stats' }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
        setCreditBalance(result.credit_balance);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-referral`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'get_code' }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setStats(prev => prev ? { ...prev, referral_code: result.referral_code } : null);
        showToast('Referral code generated!');
      }
    } catch (error) {
      showToast('Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (stats?.referral_code) {
      navigator.clipboard.writeText(stats.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Referral code copied!');
    }
  };

  const shareReferral = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-referral`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'share' }),
        }
      );

      const result = await response.json();
      if (result.success) {
        if (navigator.share) {
          await navigator.share({
            title: 'Join Epix Visuals',
            text: result.share_text,
            url: result.share_url,
          });
        } else {
          navigator.clipboard.writeText(result.share_text);
          showToast('Share link copied to clipboard!');
        }
      }
    } catch (error) {
      showToast('Failed to share');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: 'rgba(255,255,255,0.5)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading referrals...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: 'rgba(13,13,25,0.95)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px',
          color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>Referrals</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Refer other photographers and earn credits
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{
          background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Total Referrals</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#D4AF37' }}>
            {stats?.total_referrals || 0}
          </div>
        </div>
        
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Completed</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#34C759' }}>
            {stats?.completed_referrals || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Credits Earned</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#6C9AED' }}>
            {stats?.total_credits_earned || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Credit Balance</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'white' }}>
            {creditBalance}
          </div>
        </div>
      </div>

      {/* Referral Code */}
      <div style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D4AF37', marginBottom: 12 }}>
          Your Referral Code
        </h3>
        
        {stats?.referral_code ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                color: '#D4AF37',
                fontSize: 20,
                letterSpacing: 2,
                flex: 1,
              }}>
                {stats.referral_code}
              </span>
              <button
                onClick={copyCode}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(212,175,55,0.3)',
                  background: 'rgba(212,175,55,0.1)',
                  color: '#D4AF37',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={shareReferral}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
                color: '#080810',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Share2 size={18} />
              Share Referral Link
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              You haven't generated a referral code yet
            </p>
            <button
              onClick={generateCode}
              disabled={generating}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: generating ? 'rgba(212,175,55,0.5)' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
                color: '#080810',
                fontWeight: 700,
                fontSize: 14,
                cursor: generating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Gift size={16} />}
              {generating ? 'Generating...' : 'Generate Referral Code'}
            </button>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>How It Works</h3>
        
        <div style={{ display: 'grid', gap: 16 }}>
          {[
            { step: 1, title: 'Share your code', desc: 'Share your unique referral code with other photographers' },
            { step: 2, title: 'They sign up', desc: 'When they sign up using your code and pay KES 500' },
            { step: 3, title: 'You earn credits', desc: 'You get KES 100 credits for SMS/WhatsApp messages' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 16 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: 'rgba(212,175,55,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>Reward Tiers</h3>
        
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { referrals: '1-5', reward: 'KES 100 per referral', badge: 'Bronze' },
            { referrals: '6-15', reward: 'KES 150 per referral', badge: 'Silver' },
            { referrals: '16-30', reward: 'KES 200 per referral', badge: 'Gold' },
            { referrals: '31+', reward: 'KES 250 per referral', badge: 'Platinum' },
          ].map((tier) => (
            <div
              key={tier.badge}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{tier.badge}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{tier.referrals} referrals</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#D4AF37' }}>{tier.reward}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
