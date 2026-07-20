'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  photo_url: string;
  signed_url?: string;
  category: string;
  is_featured: boolean;
  display_order: number;
  created_at: string;
};

const CATEGORIES = ['All', 'Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'BTS', 'Other'];

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Wedding');
  const [uploadFeatured, setUploadFeatured] = useState(false);

  useEffect(() => { loadPortfolio(); }, []);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: err } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('owner_admin_id', user.id)
        .order('display_order', { ascending: true });

      if (err) throw err;

      // Sign URLs
      const paths = (data || []).filter(i => i.photo_url && !i.photo_url.startsWith('http')).map(i => i.photo_url);
      let signedMap = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from('portfolio').createSignedUrls(paths, 3600);
        (signed || []).forEach(s => { if (s.signedUrl && s.path) signedMap.set(s.path, s.signedUrl); });
      }

      setItems((data || []).map(i => ({
        ...i,
        signed_url: i.photo_url.startsWith('http') ? i.photo_url : (signedMap.get(i.photo_url) || i.photo_url),
      })));
    } catch (e: any) {
      // If table doesn't exist yet, show empty state gracefully
      if (e?.message?.includes('does not exist') || e?.code === '42P01') {
        setItems([]);
      } else {
        setError(e.message);
      }
    } finally { setLoading(false); }
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) { setError('Title and photo are required.'); return; }
    setUploading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${user!.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('portfolio').upload(path, uploadFile, {
        contentType: uploadFile.type, upsert: true,
      });
      if (upErr) throw upErr;

      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order)) + 1 : 0;

      const { error: dbErr } = await supabase.from('portfolio_items').insert({
        owner_admin_id: user!.id,
        created_by: user!.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        photo_url: path,
        category: uploadCategory,
        is_featured: uploadFeatured,
        display_order: maxOrder,
      });
      if (dbErr) throw dbErr;

      setShowUploadModal(false);
      setUploadFile(null); setUploadPreview(''); setUploadTitle('');
      setUploadDesc(''); setUploadCategory('Wedding'); setUploadFeatured(false);
      await loadPortfolio();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true); setError('');
    try {
      const { error: err } = await supabase.from('portfolio_items').update({
        title: editItem.title,
        description: editItem.description,
        category: editItem.category,
        is_featured: editItem.is_featured,
      }).eq('id', editItem.id);
      if (err) throw err;
      setShowEditModal(false); setEditItem(null);
      await loadPortfolio();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this portfolio item?')) return;
    try {
      const item = items.find(i => i.id === id);
      if (item && !item.photo_url.startsWith('http')) {
        await supabase.storage.from('portfolio').remove([item.photo_url]);
      }
      await supabase.from('portfolio_items').delete().eq('id', id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  const toggleFeatured = async (item: PortfolioItem) => {
    try {
      await supabase.from('portfolio_items').update({ is_featured: !item.is_featured }).eq('id', item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_featured: !i.is_featured } : i));
    } catch (e: any) { setError(e.message); }
  };

  const filtered = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);
  const featured = items.filter(i => i.is_featured);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Portfolio</h1>
          <p className="text-gray-400 mt-1">{items.length} photos · {featured.length} featured</p>
        </div>
        <button onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-black font-bold rounded-xl hover:opacity-90 text-sm">
          + Add Photo
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              activeCategory === cat
                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Featured strip */}
      {featured.length > 0 && activeCategory === 'All' && (
        <div>
          <h2 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-wider">⭐ Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featured.map(item => (
              <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={item.signed_url || item.photo_url} alt={item.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <p className="text-white text-xs font-semibold truncate">{item.title}</p>
                  <p className="text-gray-300 text-xs">{item.category}</p>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setEditItem(item); setShowEditModal(true); }}
                    className="w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-xs hover:bg-black/80">✏️</button>
                  <button onClick={() => handleDelete(item.id)}
                    className="w-7 h-7 bg-red-500/60 rounded-lg flex items-center justify-center text-xs hover:bg-red-500/80">🗑</button>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">⭐</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent border-yellow-500/60 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="text-gray-400 font-semibold">No portfolio photos yet</p>
          <p className="text-gray-600 text-sm mt-1">Add your best work to showcase to clients</p>
          <button onClick={() => setShowUploadModal(true)}
            className="mt-4 px-6 py-2.5 bg-yellow-500 text-black font-bold rounded-xl hover:opacity-90 text-sm">
            Add First Photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(item => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={item.signed_url || item.photo_url} alt={item.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-white text-xs font-semibold truncate">{item.title}</p>
                <p className="text-gray-300 text-xs">{item.category}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => toggleFeatured(item)} title={item.is_featured ? 'Unfeature' : 'Feature'}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${item.is_featured ? 'bg-yellow-500/80' : 'bg-black/60 hover:bg-yellow-500/40'}`}>⭐</button>
                <button onClick={() => { setEditItem(item); setShowEditModal(true); }}
                  className="w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-xs hover:bg-black/80">✏️</button>
                <button onClick={() => handleDelete(item.id)}
                  className="w-7 h-7 bg-red-500/60 rounded-lg flex items-center justify-center text-xs hover:bg-red-500/80">🗑</button>
              </div>
              {item.is_featured && (
                <div className="absolute top-2 left-2">
                  <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-bold">⭐</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-md space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Portfolio Photo</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadPreview(''); setError(''); }}
                className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Drop zone */}
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-yellow-500/30 transition-colors">
              {uploadPreview ? (
                <img src={uploadPreview} className="w-full h-40 object-cover rounded-lg" alt="" />
              ) : (
                <>
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-sm text-gray-400">Click to select photo</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
              placeholder="Title *" />
            <textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={2}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-none"
              placeholder="Description (optional)" />
            <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setUploadFeatured(!uploadFeatured)}
                className={`w-11 h-6 rounded-full transition-colors relative ${uploadFeatured ? 'bg-yellow-500' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${uploadFeatured ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">Mark as Featured</span>
            </label>
            <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()}
              className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Add to Portfolio'}
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Portfolio Item</h3>
              <button onClick={() => { setShowEditModal(false); setEditItem(null); setError(''); }}
                className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <img src={editItem.signed_url || editItem.photo_url} className="w-full h-40 object-cover rounded-xl" alt="" />
            <input value={editItem.title} onChange={e => setEditItem({ ...editItem, title: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
              placeholder="Title *" />
            <textarea value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })} rows={2}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none resize-none"
              placeholder="Description" />
            <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })}
              className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setEditItem({ ...editItem, is_featured: !editItem.is_featured })}
                className={`w-11 h-6 rounded-full transition-colors relative ${editItem.is_featured ? 'bg-yellow-500' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editItem.is_featured ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">Featured</span>
            </label>
            <button onClick={handleSaveEdit} disabled={saving}
              className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
