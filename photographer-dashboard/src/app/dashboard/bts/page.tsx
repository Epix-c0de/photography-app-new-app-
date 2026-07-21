'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type PostType = 'bts' | 'announcement';

export default function BtsAndAnnouncementsPage() {
  const [tab, setTab] = useState<PostType>('bts');
  const [btsPosts, setBtsPosts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [btsTitle, setBtsTitle] = useState('');
  const [btsCategory, setBtsCategory] = useState('Wedding');
  const [btsVisibility, setBtsVisibility] = useState<'global' | 'admin_only'>('global');
  const [btsFile, setBtsFile] = useState<File | null>(null);
  const [btsPreview, setBtsPreview] = useState('');

  const [annTitle, setAnnTitle] = useState('');
  const [annDescription, setAnnDescription] = useState('');
  const [annTag, setAnnTag] = useState('');
  const [annFile, setAnnFile] = useState<File | null>(null);
  const [annPreview, setAnnPreview] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: bts }, { data: ann }] = await Promise.all([
      supabase.from('bts_posts').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('announcements').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
    ]);

    setBtsPosts(bts || []);
    setAnnouncements(ann || []);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: PostType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'bts') { setBtsFile(file); setBtsPreview(url); }
    else { setAnnFile(file); setAnnPreview(url); }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
    return publicUrl;
  };

  const handlePostBts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!btsTitle.trim() || !btsFile) { setError('Title and media are required.'); return; }
    setError(''); setPosting(true); setUploadProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUploadProgress(40);
      const mediaUrl = await uploadFile(btsFile, 'bts');
      setUploadProgress(80);

      const { error } = await supabase.from('bts_posts').insert({
        title: btsTitle,
        caption: btsTitle,
        media_url: mediaUrl,
        media_type: btsFile.type.startsWith('video') ? 'video' : 'image',
        category: btsCategory,
        visibility: btsVisibility,
        is_active: true,
        created_by: user!.id,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      if (error) throw error;
      setUploadProgress(100);
      setSuccess('BTS post published!');
      setBtsTitle(''); setBtsFile(null); setBtsPreview('');
      await loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
      setTimeout(() => { setSuccess(''); setUploadProgress(0); }, 3000);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim()) { setError('Title is required.'); return; }
    setError(''); setPosting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let mediaUrl = null;
      if (annFile) {
        setUploadProgress(40);
        mediaUrl = await uploadFile(annFile, 'announcements');
      }
      setUploadProgress(80);

      const { error } = await supabase.from('announcements').insert({
        title: annTitle,
        description: annDescription,
        tag: annTag || null,
        media_url: mediaUrl,
        media_type: annFile?.type.startsWith('video') ? 'video' : 'image',
        is_active: true,
        created_by: user!.id,
        owner_admin_id: user!.id,
        content: annDescription || annTitle,
      });

      if (error) throw error;
      setUploadProgress(100);
      setSuccess('Announcement published!');
      setAnnTitle(''); setAnnDescription(''); setAnnTag(''); setAnnFile(null); setAnnPreview('');
      await loadPosts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
      setTimeout(() => { setSuccess(''); setUploadProgress(0); }, 3000);
    }
  };

  const handleDelete = async (id: string, type: PostType) => {
    if (!confirm('Delete this post?')) return;
    const table = type === 'bts' ? 'bts_posts' : 'announcements';
    await supabase.from(table).delete().eq('id', id);
    await loadPosts();
  };

  const categories = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Portfolio', 'Other'];

  const totalViews = [...btsPosts, ...announcements].reduce((s, p) => s + (p.views_count || 0), 0);
  const totalLikes = btsPosts.reduce((s, p) => s + (p.likes_count || 0), 0);
  const totalComments = [...btsPosts, ...announcements].reduce((s, p) => s + (p.comments_count || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">BTS & Announcements</h1>
        <p className="text-gray-400 mt-1">Post behind-the-scenes content and announcements to your clients</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: (btsPosts.length + announcements.length).toString(), color: '#D4AF37', icon: '📝' },
          { label: 'Total Views', value: totalViews.toLocaleString(), color: '#3B82F6', icon: '👁️' },
          { label: 'Total Likes', value: totalLikes.toLocaleString(), color: '#F43F5E', icon: '❤️' },
          { label: 'Comments', value: totalComments.toString(), color: '#10B981', icon: '💬' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
            <div className="text-2xl mb-3">{s.icon}</div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['bts', 'announcement'] as PostType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: tab === t ? 'linear-gradient(135deg, #D4AF37, #F0D060)' : 'rgba(255,255,255,0.05)',
              color: tab === t ? '#080810' : '#9CA3AF',
            }}
          >
            {t === 'bts' ? '🎬 BTS Post' : '📢 Announcement'}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm border" style={{ background: 'rgba(255,59,48,0.1)', borderColor: 'rgba(255,59,48,0.2)', color: '#FF3B30' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl p-3 text-sm border" style={{ background: 'rgba(52,199,89,0.1)', borderColor: 'rgba(52,199,89,0.2)', color: '#34C759' }}>
          {success}
        </div>
      )}

      {/* BTS Form */}
      {tab === 'bts' && (
        <form onSubmit={handlePostBts} className="rounded-2xl p-6 border border-white/5 space-y-5" style={{ background: '#111118' }}>
          <h2 className="text-lg font-bold">Create BTS Post</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Caption / Title *</label>
            <input value={btsTitle} onChange={(e) => setBtsTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50"
              style={{ background: '#1A1A2E' }}
              placeholder="Behind the scenes at Johnson Wedding..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select value={btsCategory} onChange={(e) => setBtsCategory(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                style={{ background: '#1A1A2E' }}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Audience</label>
              <select value={btsVisibility} onChange={(e) => setBtsVisibility(e.target.value as any)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                style={{ background: '#1A1A2E' }}>
                <option value="global">All Clients</option>
                <option value="admin_only">My Clients Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Media (photo or video) *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-[#D4AF37]/30 transition-colors"
            >
              {btsPreview ? (
                btsFile?.type.startsWith('video')
                  ? <video src={btsPreview} className="max-h-48 mx-auto rounded-lg" controls />
                  : <img src={btsPreview} className="max-h-48 mx-auto rounded-lg object-cover" alt="preview" />
              ) : (
                <div className="text-gray-500">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-sm">Click to select photo or video</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => handleFileChange(e, 'bts')} />
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(135deg, #D4AF37, #F0D060)' }} />
            </div>
          )}

          <button type="submit" disabled={posting}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {posting ? 'Publishing...' : 'Publish BTS Post'}
          </button>
        </form>
      )}

      {/* Announcement Form */}
      {tab === 'announcement' && (
        <form onSubmit={handlePostAnnouncement} className="rounded-2xl p-6 border border-white/5 space-y-5" style={{ background: '#111118' }}>
          <h2 className="text-lg font-bold">Create Announcement</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50"
              style={{ background: '#1A1A2E' }}
              placeholder="New packages available!" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea value={annDescription} onChange={(e) => setAnnDescription(e.target.value)} rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50 resize-none"
              style={{ background: '#1A1A2E' }}
              placeholder="Tell your clients more..." />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tag (optional)</label>
            <input value={annTag} onChange={(e) => setAnnTag(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50"
              style={{ background: '#1A1A2E' }}
              placeholder="e.g. Promotion, Update, Event" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Media (optional)</label>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-[#D4AF37]/30 transition-colors">
              {annPreview
                ? <img src={annPreview} className="max-h-40 mx-auto rounded-lg object-cover" alt="preview" />
                : <div className="text-gray-500"><div className="text-3xl mb-2">📎</div><p className="text-sm">Click to attach image or video</p></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => handleFileChange(e, 'announcement')} />
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(135deg, #D4AF37, #F0D060)' }} />
            </div>
          )}

          <button type="submit" disabled={posting}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            {posting ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </form>
      )}

      {/* Existing Posts */}
      <div>
        <h2 className="text-xl font-bold mb-4">{tab === 'bts' ? 'Your BTS Posts' : 'Your Announcements'}</h2>
        <div className="space-y-3">
          {(tab === 'bts' ? btsPosts : announcements).map((post) => (
            <div key={post.id} className="rounded-xl p-4 border border-white/5 flex items-center justify-between gap-4" style={{ background: '#111118' }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {post.media_url && (
                  <img src={post.media_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{post.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-gray-500 text-xs">
                      {new Date(post.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {tab === 'bts' && post.visibility === 'admin_only' && (
                      <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,159,10,0.1)', color: '#FF9F0A' }}>Private</span>
                    )}
                    {post.views_count > 0 && (
                      <span className="text-xs text-gray-500">{post.views_count} views</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(post.id, tab)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0"
                style={{ background: 'rgba(255,59,48,0.1)', borderColor: 'rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                Delete
              </button>
            </div>
          ))}
          {(tab === 'bts' ? btsPosts : announcements).length === 0 && !loading && (
            <div className="text-center py-12 rounded-2xl border border-white/5" style={{ background: '#111118' }}>
              <div className="text-4xl mb-3">{tab === 'bts' ? '🎬' : '📢'}</div>
              <p className="text-gray-500 text-sm">No {tab === 'bts' ? 'BTS posts' : 'announcements'} yet.</p>
              <p className="text-gray-600 text-xs mt-1">Create your first post above!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
