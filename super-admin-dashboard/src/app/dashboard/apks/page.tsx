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

export default function ApksPage() {
  const [apks, setApks] = useState<ApkVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'admin' | 'client'>('client');
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { fetchApks(); }, []);

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

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);
      formData.append('version', version);
      formData.append('changelog', changelog);

      const res = await fetch('/api/apk/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(`${uploadType === 'admin' ? 'Admin' : 'Client'} APK v${version} uploaded successfully`);
      setShowUpload(false);
      setFile(null);
      setVersion('');
      setChangelog('');
      fetchApks();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
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
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Upload and manage app downloads for photographers and clients</p>
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

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowUpload(false)}
              style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading || !file || !version}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: uploading ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', fontWeight: 800, fontSize: 13, cursor: uploading ? 'wait' : 'pointer', opacity: !file || !version ? 0.5 : 1 }}>
              {uploading ? 'Uploading...' : 'Upload APK'}
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
