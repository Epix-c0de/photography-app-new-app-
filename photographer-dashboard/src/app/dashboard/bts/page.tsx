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

  // BTS form
  const [btsTitle, setBtsTitle] = useState('');
  const [btsCategory, setBtsCategory] = useState('Wedding');
  const [btsVisibility, setBtsVisibility] = useState<'global' | 'admin_only'>('global');
  const [btsFile, setBtsFile] = useState<File | null>(null);
  const [btsPreview, setBtsPreview] = useState('');

  // Announcement form
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
      supabase.from('bts_posts').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('announcements').select('*').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(20),
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
    const { error } = await supabase.storage.from('bts-media').upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('bts-media').getPublicUrl(path);
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
        owner_admin_id: user!.id,
        created_by: user!.id,
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">BTS & Announcements</h1>
        <p className="text-gray-400 mt-1">Post behind-the-scenes content and announcements to your clients</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['bts', 'announcement'] as PostType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-yellow-500 text-black' : 'bg-[#111118] border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'bts' ? '🎬 BTS Post' : '📢 Announcement'}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">{success}</div>}

      {/* BTS Form */}
      {tab === 'bts' && (
        <form onSubmit={handlePostBts} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold">Create BTS Post</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Caption / Title *</label>
            <input value={btsTitle} onChange={(e) => setBtsTitle(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="Behind the scenes at Johnson Wedding..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select value={btsCategory} onChange={(e) => setBtsCategory(e.target.value)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Audience</label>
              <select value={btsVisibility} onChange={(e) => setBtsVisibility(e.target.value as any)}
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none">
                <option value="global">🌍 All Clients</option>
                <option value="admin_only">🔒 My Clients Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Media (photo or video) *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-yellow-500/30 transition-colors"
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
              <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          <button type="submit" disabled={posting}
            className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
            {posting ? 'Publishing...' : '🚀 Publish BTS Post'}
          </button>
        </form>
      )}

      {/* Announcement Form */}
      {tab === 'announcement' && (
        <form onSubmit={handlePostAnnouncement} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold">Create Announcement</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="New packages available!" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea value={annDescription} onChange={(e) => setAnnDescription(e.target.value)} rows={3}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 resize-none"
              placeholder="Tell your clients more..." />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tag (optional)</label>
            <input value={annTag} onChange={(e) => setAnnTag(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="e.g. Promotion, Update, Event" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Media (optional)</label>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-yellow-500/30 transition-colors">
              {annPreview
                ? <img src={annPreview} className="max-h-40 mx-auto rounded-lg object-cover" alt="preview" />
                : <p className="text-gray-500 text-sm">📎 Click to attach image or video</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => handleFileChange(e, 'announcement')} />
          </div>

          <button type="submit" disabled={posting}
            className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
            {posting ? 'Publishing...' : '📢 Publish Announcement'}
          </button>
        </form>
      )}

      {/* Existing posts */}
      <div>
        <h2 className="text-xl font-bold mb-4">{tab === 'bts' ? 'Your BTS Posts' : 'Your Announcements'}</h2>
        <div className="space-y-3">
          {(tab === 'bts' ? btsPosts : announcements).map((post) => (
            <div key={post.id} className="bg-[#111118] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {post.media_url && (
                  <img src={post.media_url} className="w-12 h-12 rounded-lg object-cover" alt="" />
                )}
                <div>
                  <p className="font-semibold text-sm">{post.title}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(post.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {tab === 'bts' && post.visibility === 'admin_only' && ' · 🔒 My clients only'}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(post.id, tab)}
                className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors">
                Delete
              </button>
            </div>
          ))}
          {(tab === 'bts' ? btsPosts : announcements).length === 0 && !loading && (
            <p className="text-gray-500 text-sm text-center py-8">No {tab === 'bts' ? 'BTS posts' : 'announcements'} yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
