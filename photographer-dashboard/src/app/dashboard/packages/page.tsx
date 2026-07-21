'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Edit, Trash2, Star, X, Eye, EyeOff } from 'lucide-react';

type PackageItem = {
  id: string;
  name: string;
  price: number;
  sms_included: number;
  storage_limit_gb: number;
  features: string[];
  is_active: boolean;
  description: string | null;
  detailed_description: string | null;
  is_popular: boolean;
  cover_image_url: string | null;
  category: string | null;
  created_at: string;
};

const CATEGORIES = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'Custom'];

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageItem | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formSms, setFormSms] = useState(50);
  const [formStorage, setFormStorage] = useState(5);
  const [formFeatures, setFormFeatures] = useState('20 edited photos\nOnline gallery');
  const [formDescription, setFormDescription] = useState('');
  const [formDetailed, setFormDetailed] = useState('');
  const [formPopular, setFormPopular] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [formActive, setFormActive] = useState(true);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadPackages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('owner_admin_id', user.id)
      .order('created_at', { ascending: false });
    setPackages(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPackages(); }, []);

  const openCreate = () => {
    setEditingPkg(null);
    setFormName('');
    setFormPrice(5000);
    setFormSms(50);
    setFormStorage(5);
    setFormFeatures('20 edited photos\nOnline gallery');
    setFormDescription('');
    setFormDetailed('');
    setFormPopular(false);
    setFormCategory('');
    setFormActive(true);
    setShowModal(true);
  };

  const openEdit = (pkg: PackageItem) => {
    setEditingPkg(pkg);
    setFormName(pkg.name);
    setFormPrice(pkg.price);
    setFormSms(pkg.sms_included);
    setFormStorage(pkg.storage_limit_gb);
    setFormFeatures((pkg.features || []).join('\n'));
    setFormDescription(pkg.description || '');
    setFormDetailed(pkg.detailed_description || '');
    setFormPopular(pkg.is_popular || false);
    setFormCategory(pkg.category || '');
    setFormActive(pkg.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { showToast('Name is required'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const features = formFeatures.split('\n').map(f => f.trim()).filter(Boolean);
      const payload = {
        owner_admin_id: user.id,
        name: formName,
        price: formPrice,
        sms_included: formSms,
        storage_limit_gb: formStorage,
        features,
        is_active: formActive,
        description: formDescription || null,
        detailed_description: formDetailed || null,
        is_popular: formPopular,
        category: formCategory || null,
      };

      if (editingPkg) {
        await supabase.from('packages').update(payload).eq('id', editingPkg.id);
        showToast('Package updated!');
      } else {
        await supabase.from('packages').insert(payload);
        showToast('Package created!');

        // Notify clients about new package
        const { data: profiles } = await supabase
          .from('user_profiles').select('id').eq('role', 'client');
        if (profiles?.length) {
          const notifs = profiles.map(p => ({
            user_id: p.id,
            type: 'package',
            title: 'New Package Available!',
            body: `${formName} - KES ${formPrice.toLocaleString()}`,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }

      setShowModal(false);
      loadPackages();
    } catch (e: any) { showToast('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    await supabase.from('packages').delete().eq('id', id);
    showToast('Package deleted!');
    loadPackages();
  };

  const toggleActive = async (pkg: PackageItem) => {
    await supabase.from('packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id);
    loadPackages();
  };

  const activePackages = packages.filter(p => p.is_active);
  const totalRevenue = packages.reduce((s, p) => s + p.price, 0);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 rounded-xl px-5 py-3 text-sm font-bold z-50" style={{ background: '#111118', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37' }}>
          {toast}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">Packages</h1>
          <p className="text-gray-400 mt-1">Manage your photography service packages</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          <Plus size={18} /> New Package
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Packages', value: packages.length.toString(), color: '#D4AF37', icon: '📦' },
          { label: 'Active', value: activePackages.length.toString(), color: '#34C759', icon: '✅' },
          { label: 'Avg Price', value: `KES ${packages.length ? Math.round(totalRevenue / packages.length).toLocaleString() : 0}`, color: '#3B82F6', icon: '💰' },
          { label: 'Categories', value: new Set(packages.map(p => p.category).filter(Boolean)).size.toString(), color: '#8B5CF6', icon: '🏷️' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
            <div className="text-2xl mb-3">{s.icon}</div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Packages Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading packages...</div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-white/5" style={{ background: '#111118' }}>
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-400 text-lg font-bold mb-2">No packages yet</p>
          <p className="text-gray-500 text-sm mb-6">Create your first package to start receiving bookings</p>
          <button onClick={openCreate}
            className="px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            Create Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-2xl border overflow-hidden" style={{ background: '#111118', borderColor: pkg.is_popular ? '#D4AF37' : 'rgba(255,255,255,0.05)' }}>
              {pkg.is_popular && (
                <div className="px-4 py-1.5 text-xs font-bold text-center" style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                  ⭐ Most Popular
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white text-lg">{pkg.name}</h3>
                    {pkg.category && (
                      <span className="text-xs px-2 py-0.5 rounded-lg mt-1 inline-block" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                        {pkg.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleActive(pkg)} className="p-1.5 rounded-lg" style={{ background: pkg.is_active ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)' }}
                      title={pkg.is_active ? 'Active' : 'Inactive'}>
                      {pkg.is_active ? <Eye size={14} color="#34C759" /> : <EyeOff size={14} color="#FF3B30" />}
                    </button>
                    <button onClick={() => openEdit(pkg)} className="p-1.5 rounded-lg" style={{ background: 'rgba(212,175,55,0.1)' }}>
                      <Edit size={14} color="#D4AF37" />
                    </button>
                    <button onClick={() => handleDelete(pkg.id)} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,59,48,0.1)' }}>
                      <Trash2 size={14} color="#FF3B30" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-black" style={{ color: '#D4AF37' }}>KES {pkg.price.toLocaleString()}</span>
                </div>

                {pkg.description && (
                  <p className="text-gray-400 text-sm mb-3">{pkg.description}</p>
                )}

                <div className="space-y-1.5 mb-4">
                  {(pkg.features || []).slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span style={{ color: '#34C759' }}>✓</span> {f}
                    </div>
                  ))}
                  {(pkg.features || []).length > 4 && (
                    <p className="text-xs text-gray-500">+{(pkg.features || []).length - 4} more features</p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{pkg.sms_included} SMS</span>
                  <span>{pkg.storage_limit_gb}GB storage</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 border border-white/10 max-h-[90vh] overflow-y-auto" style={{ background: '#111118' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingPkg ? 'Edit Package' : 'New Package'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Package Name *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50"
                  style={{ background: '#1A1A2E' }} placeholder="e.g., Wedding Gold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price (KES) *</label>
                  <input type="number" value={formPrice || ''} onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }}>
                    <option value="">None</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SMS Credits Included</label>
                  <input type="number" value={formSms || ''} onChange={(e) => setFormSms(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Storage Limit (GB)</label>
                  <input type="number" value={formStorage || ''} onChange={(e) => setFormStorage(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }} />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                  style={{ background: '#1A1A2E' }} placeholder="Short description for clients" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Features (one per line)</label>
                <textarea value={formFeatures} onChange={(e) => setFormFeatures(e.target.value)} rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none resize-none"
                  style={{ background: '#1A1A2E' }} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-sm text-white">Mark as Most Popular</span>
                <button onClick={() => setFormPopular(!formPopular)}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: formPopular ? '#D4AF37' : '#333' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: formPopular ? '26px' : '2px' }} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-sm text-white">Active</span>
                <button onClick={() => setFormActive(!formActive)}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: formActive ? '#34C759' : '#333' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: formActive ? '26px' : '2px' }} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                {saving ? 'Saving...' : editingPkg ? 'Update Package' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
