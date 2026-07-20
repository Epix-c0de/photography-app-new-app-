'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ExternalLink,
  CheckCircle,
  Unlink,
  Loader2,
  Share2,
  AlertCircle,
  Globe,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Zap,
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

function TikTokIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34A6.34 6.34 0 0015.81 15.94V9.41a8.16 8.16 0 004.77 1.52V7.49a4.85 4.85 0 01-1-.8z" />
    </svg>
  );
}

type Platform = 'instagram' | 'facebook' | 'tiktok';

interface PlatformConfig {
  key: Platform;
  label: string;
  color: string;
  icon: typeof InstagramIcon;
  description: string;
  gradient: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    color: '#E4405F',
    icon: InstagramIcon,
    description: 'Share photos directly to your feed',
    gradient: 'linear-gradient(135deg, #833AB4, #E4405F, #FCAF45)',
  },
  {
    key: 'facebook',
    label: 'Facebook Page',
    color: '#1877F2',
    icon: FacebookIcon,
    description: 'Share to your business page',
    gradient: 'linear-gradient(135deg, #1877F2, #42A5F5)',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#00F2EA',
    icon: TikTokIcon,
    description: 'Post videos and content to your profile',
    gradient: 'linear-gradient(135deg, #00F2EA, #FF0050)',
  },
];

interface SocialConnection {
  id: string;
  platform: string;
  profile_name: string;
  profile_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface SocialShare {
  id: string;
  platform: string;
  caption: string | null;
  status: string;
  post_url: string | null;
  created_at: string;
}

export default function SocialPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [shares, setShares] = useState<SocialShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [connectionsRes, sharesRes] = await Promise.all([
      supabase
        .from('social_connections')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('social_shares')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setConnections(connectionsRes.data || []);
    setShares(sharesRes.data || []);
    setLoading(false);
  };

  const isConnected = (platform: Platform) => {
    return connections.some(c => c.platform === platform && c.is_active);
  };

  const getConnection = (platform: Platform) => {
    return connections.find(c => c.platform === platform && c.is_active);
  };

  const handleConnect = async (platform: Platform) => {
    setConnecting(platform);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/social-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ platform }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || `Failed to connect ${platform}`);
        setConnecting(null);
        return;
      }

      // Redirect to OAuth URL
      window.location.href = data.url;
    } catch (error: any) {
      showToast(error.message || `Failed to connect ${platform}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string, platform: string) => {
    if (!confirm(`Disconnect ${platform}? You can reconnect later.`)) return;

    try {
      await supabase
        .from('social_connections')
        .update({ is_active: false })
        .eq('id', connectionId);

      loadData();
      showToast(`${platform} disconnected`);
    } catch (error) {
      showToast('Failed to disconnect');
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <Loader2 size={24} className="animate-spin" /> <span className="ml-3">Loading social accounts...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
          Connect your social accounts to share content across platforms
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['accounts', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === tab ? 'linear-gradient(135deg, #D4AF37, #F0D060)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab ? '#12121e' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'accounts' ? 'Connected Accounts' : 'Share History'}
            {tab === 'history' && shares.length > 0 && (
              <span style={{
                marginLeft: 8,
                padding: '2px 6px',
                borderRadius: 6,
                background: activeTab === tab ? 'rgba(18,18,30,0.2)' : 'rgba(212,175,55,0.2)',
                fontSize: 11,
              }}>
                {shares.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Platform Cards */}
          {PLATFORMS.map((platform) => {
            const connected = isConnected(platform.key);
            const connection = getConnection(platform.key);
            const Icon = platform.icon;

            return (
              <div
                key={platform.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 20,
                  borderRadius: 16,
                  background: connected
                    ? `linear-gradient(135deg, ${platform.color}10, ${platform.color}05)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${connected ? `${platform.color}30` : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: connected ? platform.gradient : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: connected ? `0 4px 12px ${platform.color}30` : 'none',
                  }}>
                    <Icon size={24} color={connected ? 'white' : 'rgba(255,255,255,0.3)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 2 }}>
                      {platform.label}
                    </div>
                    {connected ? (
                      <div style={{ fontSize: 13, color: platform.color }}>
                        Connected as {connection?.profile_name}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                        {platform.description}
                      </div>
                    )}
                  </div>
                </div>

                {connected ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => connection && handleDisconnect(connection.id, platform.label)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        border: '1px solid rgba(244,63,94,0.3)',
                        background: 'rgba(244,63,94,0.1)',
                        color: '#F43F5E',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Unlink size={14} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.key)}
                    disabled={connecting === platform.key}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      border: 'none',
                      background: connecting === platform.key ? `${platform.color}80` : platform.gradient,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: connecting === platform.key ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: `0 4px 12px ${platform.color}30`,
                      transition: 'all 0.2s',
                    }}
                  >
                    {connecting === platform.key ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ExternalLink size={14} />
                    )}
                    {connecting === platform.key ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}

          {/* Info Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(139,92,246,0.04))',
            border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 16,
            padding: 20,
            marginTop: 24,
          }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} style={{ color: '#D4AF37' }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D4AF37' }}>About Social Sharing</h3>
            </div>
            <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Share BTS content and galleries directly to your social platforms</li>
              <li>Photos are posted with your watermark and branding</li>
              <li>Auto-post when galleries are published (coming soon)</li>
              <li>Posts include your studio name and contact info</li>
            </ul>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {shares.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 60,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Share2 size={40} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No shares yet</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4 }}>
                Connect a platform and share your first gallery
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => {
                const platformConfig = PLATFORMS.find(p => p.key === share.platform);
                return (
                  <div
                    key={share.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 16,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: platformConfig?.gradient || 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {platformConfig && <platformConfig.icon size={18} color="white" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>
                        {share.caption?.substring(0, 60)}{share.caption && share.caption.length > 60 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        {formatTimeAgo(share.created_at)}
                        {share.platform && (
                          <span style={{ color: platformConfig?.color || 'rgba(255,255,255,0.3)' }}>
                            • {platformConfig?.label || share.platform}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {share.post_url && (
                        <button
                          onClick={() => copyLink(share.post_url!)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: copiedLink === share.post_url ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                            color: copiedLink === share.post_url ? '#10B981' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          {copiedLink === share.post_url ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: share.status === 'posted' ? 'rgba(16,185,129,0.15)' : share.status === 'failed' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                        color: share.status === 'posted' ? '#10B981' : share.status === 'failed' ? '#F43F5E' : '#F59E0B',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {share.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
