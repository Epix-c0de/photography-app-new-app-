'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type ApkVersion = {
  id: string;
  type: string;
  version: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  changelog: string | null;
  is_latest: boolean;
  uploaded_by: string | null;
  created_at: string;
};

type AppVersionConfig = {
  id: string;
  latest_version: string;
  minimum_version: string;
  force_update: boolean;
  release_notes: string;
  download_url: string;
  file_size: string;
  provider: string;
  published_at: string;
  version_history: Array<{ version: string; releaseNotes: string; publishedAt: string; fileSize?: string }>;
};

export default function ApksPage() {
  const [apks, setApks] = useState<ApkVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadType, setUploadType] = useState<'admin' | 'client'>('client');
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Version config state
  const [versionConfig, setVersionConfig] = useState<AppVersionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [minimumVersion, setMinimumVersion] = useState('1.0.0');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('https://epix-visuals.vercel.app/download');
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');

  // GitHub settings
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const fetchApks = async () => {
    try {
      const res = await fetch('/api/apk/list');
      const data = await res.json();
      setApks(data.apks || []);
    } catch (err) {
      console.error('Failed to fetch APKs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionConfig = async () => {
    try {
      const res = await fetch('/api/apk/version-config');
      const data = await res.json();
      if (data.config) {
        setVersionConfig(data.config);
        setMinimumVersion(data.config.minimum_version || '1.0.0');
        setForceUpdate(data.config.force_update || false);
        setReleaseNotes(data.config.release_notes || '');
        setDownloadUrl(data.config.download_url || 'https://epix-visuals.vercel.app/download');
      }
    } catch (err) {
      console.error('Failed to fetch version config', err);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => { fetchApks(); fetchVersionConfig(); }, []);

  const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB per chunk (under 50MB Supabase limit)

  const handleUpload = async () => {
    if (!file || !version) {
      setError('Select a file and enter a version number');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Not authenticated'); return; }

      const filename = `epix-${uploadType}-v${version}.apk`;
      const basePath = `${uploadType}/${version}`;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      const arrayBuffer = await file.arrayBuffer();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = arrayBuffer.slice(start, end);
        const chunkPath = `${basePath}/chunk-${String(i).padStart(4, '0')}`;

        setUploadStatus(`Uploading chunk ${i + 1}/${totalChunks}...`);

        const { error: uploadError } = await supabase.storage
          .from('apk-files')
          .upload(chunkPath, chunk, {
            contentType: 'application/octet-stream',
            upsert: true,
          });

        if (uploadError) throw new Error(`Chunk ${i + 1} failed: ${uploadError.message}`);
      }

      setUploadStatus('Recording version...');

      const res = await fetch('/api/apk/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: uploadType,
          version,
          changelog,
          storage_path: basePath,
          file_size: file.size,
          chunk_count: totalChunks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Auto-update version config when uploading a client APK
      if (uploadType === 'client') {
        const fileSizeMB = file.size ? `~${(file.size / (1024 * 1024)).toFixed(0)} MB` : '';
        const historyEntry = {
          version,
          releaseNotes: changelog || `Version ${version}`,
          publishedAt: new Date().toISOString(),
          fileSize: fileSizeMB,
        };

        const configRes = await fetch('/api/apk/version-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            latest_version: version,
            minimum_version: minimumVersion,
            force_update: forceUpdate,
            release_notes: changelog || releaseNotes,
            download_url: downloadUrl,
            file_size: fileSizeMB,
            version_history: [
              historyEntry,
              ...(versionConfig?.version_history || []).slice(0, 9),
            ],
          }),
        });

        if (!configRes.ok) {
          console.error('Failed to update version config');
        } else {
          fetchVersionConfig();
        }
      }

      setSuccess(`${uploadType === 'admin' ? 'Admin' : 'Client'} APK v${version} uploaded successfully`);
      setShowUpload(false);
      setFile(null);
      setVersion('');
      setChangelog('');
      setUploadStatus('');
      fetchApks();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setUploadStatus('');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this APK version?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/apk/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Delete failed');
      fetchApks();
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDownload = async (apk: ApkVersion) => {
    try {
      const res = await fetch(`/api/apk/download?id=${apk.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const a = document.createElement('a');
      a.href = data.download_url;
      a.download = apk.filename;
      a.click();
    } catch (err) {
      console.error('Download error', err);
    }
  };

  const handleFetchGitHubCommits = async () => {
    if (!githubRepo) {
      setConfigError('Enter a GitHub repo (e.g. user/repo)');
      return;
    }

    setFetchingCommits(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (githubToken) {
        headers.Authorization = `token ${githubToken}`;
      }

      const res = await fetch(
        `https://api.github.com/repos/${githubRepo}/commits?per_page=10`,
        { headers }
      );

      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      const commits = await res.json();
      const notes = commits
        .map((c: any) => {
          const msg = c.commit?.message || '';
          const short = msg.split('\n')[0];
          const date = c.commit?.author?.date
            ? new Date(c.commit.author.date).toLocaleDateString('en-KE')
            : '';
          return `- ${short}${date ? ` (${date})` : ''}`;
        })
        .join('\n');

      setReleaseNotes(notes);
      setConfigSuccess(`Fetched ${commits.length} commits from ${githubRepo}`);
    } catch (err: any) {
      setConfigError(err.message || 'Failed to fetch commits');
    } finally {
      setFetchingCommits(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setConfigError('Not authenticated'); return; }

      const res = await fetch('/api/apk/version-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          latest_version: versionConfig?.latest_version || '1.0.0',
          minimum_version: minimumVersion,
          force_update: forceUpdate,
          release_notes: releaseNotes,
          download_url: downloadUrl,
          file_size: versionConfig?.file_size || '',
          version_history: versionConfig?.version_history || [],
        }),
      });

      if (!res.ok) throw new Error('Save failed');

      setConfigSuccess('Version config saved successfully');
      fetchVersionConfig();
    } catch (err: any) {
      setConfigError(err.message || 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const adminApks = apks.filter(a => a.type === 'admin');
  const clientApks = apks.filter(a => a.type === 'client');
  const latestAdmin = apks.find(a => a.type === 'admin' && a.is_latest);
  const latestClient = apks.find(a => a.type === 'client' && a.is_latest);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(212,175,55,0.3)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: -0.5 }}>APK Management</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Upload APKs and manage in-app update settings</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', padding: '10px 24px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          + Upload APK
        </button>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#111111', borderRadius: 20, padding: 24, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📱</div>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Admin App</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#D4AF37' }}>{latestAdmin ? `v${latestAdmin.version}` : 'Not uploaded'}</p>
            </div>
          </div>
          {latestAdmin && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              <p>{formatSize(latestAdmin.file_size)} • {new Date(latestAdmin.created_at).toLocaleDateString('en-KE')}</p>
            </div>
          )}
        </div>

        <div style={{ background: '#111111', borderRadius: 20, padding: 24, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📲</div>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Client App</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#34C759' }}>{latestClient ? `v${latestClient.version}` : 'Not uploaded'}</p>
            </div>
          </div>
          {latestClient && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              <p>{formatSize(latestClient.file_size)} • {new Date(latestClient.created_at).toLocaleDateString('en-KE')}</p>
            </div>
          )}
        </div>
      </div>

      {/* In-App Update Config */}
      <div style={{ background: '#161616', borderRadius: 20, padding: 28, border: '1px solid rgba(212,175,55,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>🔄</span>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>In-App Update Settings</h3>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>
          These settings control what users see when they check for updates. Uploading a client APK auto-updates the version number.
        </p>

        {configError && (
          <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, color: '#FF3B30', fontSize: 13 }}>{configError}</div>
        )}
        {configSuccess && (
          <div style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, color: '#34C759', fontSize: 13 }}>{configSuccess}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Latest Version</label>
            <input type="text" value={versionConfig?.latest_version || ''} readOnly
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d0d', color: 'rgba(255,255,255,0.4)', fontSize: 13, outline: 'none' }} />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Auto-set when client APK is uploaded</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Minimum Version</label>
            <input type="text" value={minimumVersion} onChange={e => setMinimumVersion(e.target.value)} placeholder="1.0.0"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Download URL</label>
            <input type="url" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 13, outline: 'none' }} />
          </div>
        </div>

        {/* Force Update Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: forceUpdate ? 'rgba(255,59,48,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 12, border: `1px solid ${forceUpdate ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
          <button onClick={() => setForceUpdate(!forceUpdate)}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: forceUpdate ? '#FF3B30' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: 'white', position: 'absolute', top: 2, left: forceUpdate ? 22 : 2, transition: 'left 0.2s' }} />
          </button>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: forceUpdate ? '#FF3B30' : 'white' }}>Force Update</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Block app access until user updates</p>
          </div>
        </div>

        {/* GitHub Release Notes Fetch */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Fetch Release Notes from GitHub</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="owner/repo (e.g. epix-visuals/app)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 12, outline: 'none' }} />
            <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="GitHub token (optional)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 12, outline: 'none' }} />
            <button onClick={handleFetchGitHubCommits} disabled={fetchingCommits || !githubRepo}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: fetchingCommits ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.15)', color: '#D4AF37', fontSize: 12, fontWeight: 700, cursor: fetchingCommits ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {fetchingCommits ? 'Fetching...' : 'Fetch Commits'}
            </button>
          </div>
        </div>

        {/* Release Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Release Notes</label>
          <textarea value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} placeholder="What's new in this version..."
            rows={5}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        {/* Version History */}
        {versionConfig?.version_history && versionConfig.version_history.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Version History</label>
            <div style={{ maxHeight: 150, overflowY: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              {versionConfig.version_history.map((h, i) => (
                <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(212,175,55,0.04)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#D4AF37' : 'white', fontFamily: 'monospace' }}>v{h.version}</span>
                    {i === 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontWeight: 700 }}>LATEST</span>}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                      {new Date(h.publishedAt).toLocaleDateString('en-KE')}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{h.releaseNotes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleSaveConfig} disabled={savingConfig}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: savingConfig ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', fontWeight: 800, fontSize: 13, cursor: savingConfig ? 'wait' : 'pointer' }}>
            {savingConfig ? 'Saving...' : 'Save Config'}
          </button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            Last updated: {versionConfig?.published_at ? new Date(versionConfig.published_at).toLocaleString('en-KE') : 'Never'}
          </span>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div style={{ background: '#161616', borderRadius: 20, padding: 28, border: '1px solid rgba(212,175,55,0.15)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 20 }}>Upload New APK</h3>

          {error && (
            <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, color: '#FF3B30', fontSize: 13 }}>{error}</div>
          )}
          {success && (
            <div style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, color: '#34C759', fontSize: 13 }}>{success}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>App Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['admin', 'client'] as const).map(t => (
                  <button key={t} onClick={() => setUploadType(t)}
                    style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: uploadType === t ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)', background: uploadType === t ? 'rgba(212,175,55,0.1)' : 'transparent', color: uploadType === t ? '#D4AF37' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {t} App
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Version</label>
              <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Changelog (optional)</label>
            <textarea value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="What's new in this version..."
              rows={3}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: 'white', fontSize: 13, outline: 'none', resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>APK File</label>
            <input ref={fileRef} type="file" accept=".apk" onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', padding: '16px', borderRadius: 12, border: '2px dashed rgba(255,255,255,0.15)', background: 'transparent', color: file ? '#34C759' : 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {file ? `✓ ${file.name} (${formatSize(file.size)})` : 'Click to select .apk file'}
            </button>
          </div>

          {uploadType === 'client' && (
            <div style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#34C759' }}>
              ✨ Uploading a client APK will automatically update the in-app version config above.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowUpload(false)}
              style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading || !file || !version}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: uploading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', fontWeight: 800, fontSize: 13, cursor: uploading ? 'wait' : 'pointer', opacity: !file || !version ? 0.5 : 1 }}>
              {uploading ? (uploadStatus || 'Uploading...') : 'Upload APK'}
            </button>
          </div>
        </div>
      )}

      {/* APK Table */}
      <div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>All Versions</p>
        <div style={{ background: '#111111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          {apks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No APKs uploaded yet. Click &quot;Upload APK&quot; to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Type', 'Version', 'Size', 'Changelog', 'Status', 'Uploaded', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apks.map(apk => (
                  <tr key={apk.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: apk.type === 'admin' ? 'rgba(212,175,55,0.15)' : 'rgba(52,199,89,0.15)', color: apk.type === 'admin' ? '#D4AF37' : '#34C759', textTransform: 'capitalize' }}>
                        {apk.type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 13, color: 'white', fontFamily: 'monospace' }}>v{apk.version}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{formatSize(apk.file_size)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'rgba(255,255,255,0.4)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apk.changelog || '—'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: apk.is_latest ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.08)', color: apk.is_latest ? '#34C759' : 'rgba(255,255,255,0.3)' }}>
                        {apk.is_latest ? 'Latest' : 'Archived'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(apk.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleDownload(apk)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(52,199,89,0.3)', background: 'rgba(52,199,89,0.1)', color: '#34C759', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Download
                        </button>
                        <button onClick={() => handleDelete(apk.id)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
