'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ExternalLink, CheckCircle, Unlink, Loader2, Share2, Image as ImageIcon, AlertTriangle 
} from 'lucide-react';

function InstagramIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

function FacebookIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

type SocialConnection = {
  id: string;
  platform: string;
  profile_name: string;
  profile_url: string | null;
  is_active: boolean;
  created_at: string;
};

export default function SocialPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [recentShares, setRecentShares] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    loadConnections();
    loadRecentShares();
  }, []);

  const loadConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('social_connections')
      .select('*')
      .eq('photographer_id', user.id)
      .order('created_at', { ascending: false });

    setConnections(data || []);
    setLoading(false);
  };

  const loadRecentShares = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('social_shares')
      .select('*')
      .eq('photographer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentShares(data || []);
  };

  const connectInstagram = async () => {
    setConnecting('instagram');
    try {
      // Redirect to Instagram OAuth
      const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID || '';
      const redirectUri = `${window.location.origin}/auth/instagram/callback`;
      const scope = 'instagram_basic,instagram_content_publish';
      
      const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
      
      window.location.href = authUrl;
    } catch (error) {
      showToast('Failed to connect Instagram');
      setConnecting(null);
    }
  };

  const connectFacebook = async () => {
    setConnecting('facebook');
    try {
      // Redirect to Facebook OAuth
      const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';
      const redirectUri = `${window.location.origin}/auth/facebook/callback`;
      const scope = 'pages_manage_posts,pages_read_engagement';
      
      const authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
      
      window.location.href = authUrl;
    } catch (error) {
      showToast('Failed to connect Facebook');
      setConnecting(null);
    }
  };

  const disconnectAccount = async (connectionId: string, platform: string) => {
    if (!confirm(`Disconnect ${platform}? You can reconnect later.`)) return;

    try {
      await supabase
        .from('social_connections')
        .update({ is_active: false })
        .eq('id', connectionId);

      loadConnections();
      showToast(`${platform} disconnected`);
    } catch (error) {
      showToast('Failed to disconnect');
    }
  };

  const isConnected = (platform: string) => {
    return connections.some(c => c.platform === platform && c.is_active);
  };

  const getConnection = (platform: string) => {
    return connections.find(c => c.platform === platform && c.is_active);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: 'rgba(255,255,255,0.5)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading social accounts...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: 'rgba(26,26,46,0.95)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px',
          color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>Social Media</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Connect your social accounts to share BTS content
        </p>
      </div>

      {/* Connected Accounts */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 20 }}>
          Connected Accounts
        </h3>

        {/* Instagram */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderRadius: 12,
          background: isConnected('instagram') ? 'rgba(131,58,180,0.1)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isConnected('instagram') ? 'rgba(131,58,180,0.3)' : 'rgba(255,255,255,0.1)'}`,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <InstagramIcon size={24} color={isConnected('instagram') ? '#E4405F' : 'rgba(255,255,255,0.3)'} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Instagram</div>
              {isConnected('instagram') ? (
                <div style={{ fontSize: 12, color: '#E4405F' }}>
                  Connected as {getConnection('instagram')?.profile_name}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  Share photos directly to your feed
                </div>
              )}
            </div>
          </div>
          {isConnected('instagram') ? (
            <button
              onClick={() => {
                const conn = getConnection('instagram');
                if (conn) disconnectAccount(conn.id, 'instagram');
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255,59,48,0.3)',
                background: 'rgba(255,59,48,0.1)',
                color: '#FF3B30',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Unlink size={14} /> Disconnect
            </button>
          ) : (
            <button
              onClick={connectInstagram}
              disabled={connecting === 'instagram'}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: connecting === 'instagram' ? 'rgba(228,64,95,0.5)' : 'linear-gradient(135deg, #833AB4, #E4405F)',
                color: 'white',
                fontWeight: 600,
                fontSize: 13,
                cursor: connecting === 'instagram' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {connecting === 'instagram' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={14} />}
              {connecting === 'instagram' ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>

        {/* Facebook */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderRadius: 12,
          background: isConnected('facebook') ? 'rgba(24,119,242,0.1)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isConnected('facebook') ? 'rgba(24,119,242,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FacebookIcon size={24} color={isConnected('facebook') ? '#1877F2' : 'rgba(255,255,255,0.3)'} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Facebook Page</div>
              {isConnected('facebook') ? (
                <div style={{ fontSize: 12, color: '#1877F2' }}>
                  Connected as {getConnection('facebook')?.profile_name}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  Share to your business page
                </div>
              )}
            </div>
          </div>
          {isConnected('facebook') ? (
            <button
              onClick={() => {
                const conn = getConnection('facebook');
                if (conn) disconnectAccount(conn.id, 'facebook');
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255,59,48,0.3)',
                background: 'rgba(255,59,48,0.1)',
                color: '#FF3B30',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Unlink size={14} /> Disconnect
            </button>
          ) : (
            <button
              onClick={connectFacebook}
              disabled={connecting === 'facebook'}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: connecting === 'facebook' ? 'rgba(24,119,242,0.5)' : 'linear-gradient(135deg, #1877F2, #42A5F5)',
                color: 'white',
                fontWeight: 600,
                fontSize: 13,
                cursor: connecting === 'facebook' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {connecting === 'facebook' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={14} />}
              {connecting === 'facebook' ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Recent Shares */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>
          Recent Shares
        </h3>

        {recentShares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Share2 size={40} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No shares yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentShares.map((share) => (
              <div
                key={share.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {share.platform === 'instagram' ? (
                  <InstagramIcon size={18} color="#E4405F" />
                ) : (
                  <FacebookIcon size={18} color="#1877F2" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'white' }}>
                    {share.caption?.substring(0, 50)}{share.caption?.length > 50 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {new Date(share.created_at).toLocaleDateString('en-KE')}
                  </div>
                </div>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: share.status === 'posted' ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
                  color: share.status === 'posted' ? '#34C759' : '#FF3B30',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {share.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: 20,
        marginTop: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D4AF37', marginBottom: 12 }}>About Social Sharing</h3>
        <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Share BTS content directly to Instagram and Facebook</li>
          <li>Photos are posted with your watermark and branding</li>
          <li>You can share from the BTS & Announcements section</li>
          <li>Posts include your studio name and contact info</li>
        </ul>
      </div>
    </div>
  );
}
