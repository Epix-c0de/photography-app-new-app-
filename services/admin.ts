import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { galleries as mockGalleries } from '../mocks/data';
 
const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK_DATA === '1') || (process.env.EXPO_OFFLINE === '1');

const ACCESS_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function buildAccessCode(): string {
  const length = 6 + Math.floor(Math.random() * 3);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueAccessCode(maxAttempts = 10): Promise<string> {
  if (USE_MOCK) {
    return '123456';
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = buildAccessCode();
    
    // Check if this code already exists
    const { data, error } = await supabase
      .from('galleries')
      .select('access_code')
      .eq('access_code', code)
      .maybeSingle();
    
    if (error) {
      console.warn('Error checking access code uniqueness:', error);
      continue;
    }
    
    if (!data) {
      return code;
    }
  }
  
  throw new Error('Failed to generate unique access code after multiple attempts');
}

async function ensureAdminProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const metadata = user.user_metadata as any;
  const appMetadata = user.app_metadata as any;
  const role = metadata?.role || appMetadata?.role || 'admin';
  const name = metadata?.name || metadata?.display_name || user.email || 'Admin';

  const profileUpdates = {
    id: user.id,
    role,
    name,
    email: user.email || null,
    phone: user.phone || null
  };

  const { data: updatedProfile, error: updateError } = await supabase
    .from('user_profiles')
    .update(profileUpdates)
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (updateError) throw updateError;

  if (!updatedProfile) {
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert(profileUpdates)
      .select('id')
      .single();

    if (insertError) {
      const message = (insertError as any)?.message || 'Failed to create admin profile.';
      throw new Error(`${message} Ensure the user_profiles insert policy exists and rerun migrations.`);
    }
  }

  return user;
}

export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];
export type Package = any;
export type AdminResource = any;
export type AdminSettings = any;
export type AdminSettingsUpdate = Partial<AdminSettings>;

/**
 * Admin-Side API Contract
 * Implements the "Admin" portion of the Master API Contract.
 */
export const AdminService = {
  
  /**
   * 1. ADMIN AUTH & SETTINGS
   */
  settings: {
    get: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('admin_settings')
        .select('*')
        .eq('admin_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Create default settings if not exist
          const { data: newData, error: newError } = await (supabase as any)
            .from('admin_settings')
            .insert({ admin_id: user.id })
            .select()
            .single();
          if (newError) {
             console.error('AdminService.settings.get (create default):', newError);
             throw newError;
          }
          return newData;
        }
        console.error('AdminService.settings.get:', error);
        throw error;
      }
      return data;
    },

    update: async (updates: AdminSettingsUpdate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('admin_settings')
        .update(updates)
        .eq('admin_id', user.id);
        
      if (error) {
        console.error('AdminService.settings.update:', error);
        throw error;
      }
      return true;
    },

    updatePaymentNumber: async (paybill: string, accountRef: string) => {
      return AdminService.settings.update({ 
        mpesa_paybill: paybill, 
        mpesa_account_reference: accountRef 
      });
    }
  },

  /**
   * 2. CLIENT MANAGEMENT
   */
  clients: {
    list: async (): Promise<any[]> => {
      if (USE_MOCK) {
        const now = new Date().toISOString();
        // Derive a handful of mock clients from gallery titles
        const derived = mockGalleries.slice(0, 5).map((g, idx) => ({
          id: `mock-client-${idx + 1}`,
          owner_admin_id: 'mock-admin',
          user_id: null,
          name: g.title.replace(/(Wedding|Session|Portraits|Tech|Family|Pre-Wedding)/gi, '').trim() || g.title,
          phone: null,
          email: null,
          notes: null,
          total_paid: g.price ?? 0,
          last_shoot_date: g.date,
          preferred_package: null,
          created_at: now,
          updated_at: now,
        })) as Client[];
        return derived;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // 1. Fetch clients (removed join on user_profiles due to missing FK constraint)
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('AdminService.clients.list:', error);
        throw error;
      }
      if (!clients || clients.length === 0) return [];

      // 2. Fetch profiles manually
      const userIds = clients
        .map(c => c.user_id)
        .filter((id): id is string => !!id);

      let profileMap = new Map();
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          console.warn('AdminService: Failed to fetch user profiles, continuing without avatars', profilesError);
        } else if (profiles) {
          profileMap = new Map(profiles.map(p => [p.id, p]));
        }
      }

      // 3. Merge profiles into clients
      return clients.map(client => ({
        ...client,
        user_profiles: client.user_id ? profileMap.get(client.user_id) : null
      }));
    },

    create: async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_admin_id'>) => {
      const user = await ensureAdminProfile();

      const timeoutMs = 15000;
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), timeoutMs);
      });

      const createPromise = (async () => {
        const { data, error } = await supabase
          .from('clients')
          .insert({ ...client, owner_admin_id: user.id })
          .select()
          .single();

        if (error) throw error;
        return data;
      })();

      return await Promise.race([createPromise, timeout]);
    },

    update: async (id: string, updates: ClientUpdate) => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      return true;
    },

    subscribe: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:clients')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  /**
   * 3. GALLERY MANAGEMENT
   */
  gallery: {
    list: async () => {
      if (USE_MOCK) {
        const now = new Date().toISOString();
        const mock = mockGalleries.map((g, idx) => ({
          id: `mock-gallery-${idx + 1}`,
          owner_admin_id: 'mock-admin',
          client_id: `mock-client-${(idx % 5) + 1}`,
          name: g.title,
          cover_photo_url: g.coverImage,
          access_code: '123456',
          is_paid: !(g.isLocked),
          is_locked: g.isLocked,
          price: g.price ?? 0,
          shoot_type: g.type,
          scheduled_release: null,
          created_at: now,
          // The rest of fields will be ignored by existing screen selects
        }));
        return mock as any;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Robust fetch: try join first, fallback to simple fetch + manual map if needed
      // Or just do manual fetch to be safe against schema drift
      const { data: galleries, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('AdminService.gallery.list:', error);
        throw error;
      }
      if (!galleries || galleries.length === 0) return [];

      // Fetch client names manually to avoid join failures
      const clientIds = [...new Set(galleries.map(g => g.client_id).filter(Boolean))];
      
      let clientMap = new Map();
      if (clientIds.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds);
          
        if (clientsError) {
           console.warn('AdminService: Failed to fetch client names for galleries', clientsError);
        } else if (clients) {
          clientMap = new Map(clients.map(c => [c.id, c.name]));
        }
      }

      return galleries.map(g => ({
        ...g,
        clients: {
          name: clientMap.get(g.client_id)
        }
      }));
    },

    create: async (data: { 
      clientId: string, 
      name: string, 
      price: number,
      shootType: string,
      scheduledRelease?: string,
      watermarkEnabled?: boolean,
      isPaid?: boolean,
      status?: 'locked' | 'unlocked' | 'archived'
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isPaid = !!data.isPaid;
      const isLocked = data.status ? data.status !== 'unlocked' : true;
      const watermarkEnabled = data.watermarkEnabled ?? !isPaid;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const accessCode = buildAccessCode();
        const { data: gallery, error } = await supabase
          .from('galleries')
          .insert({
            owner_admin_id: user.id,
            client_id: data.clientId,
            name: data.name,
            price: data.price,
            shoot_type: data.shootType,
            event_type: data.shootType,
            scheduled_release: data.scheduledRelease,
            access_code: accessCode,
            is_locked: isLocked,
            is_paid: isPaid,
            watermark_enabled: watermarkEnabled,
            status: isLocked ? 'locked' : 'unlocked'
          })
          .select()
          .single();

        if (!error) {
          return gallery;
        }

        const errorCode = (error as any)?.code;
        const errorMessage = (error as any)?.message || '';
        const isDuplicate = errorCode === '23505' || errorMessage.includes('galleries_access_code_key') || errorMessage.includes('duplicate key value');
        if (!isDuplicate) {
          throw error;
        }
      }

      throw new Error('Failed to generate unique access code after multiple attempts');
    },

    update: async (id: string, updates: any) => {
      return await supabase
        .from('galleries')
        .update(updates)
        .eq('id', id);
    },

    uploadPhoto: async (galleryId: string, clientId: string, file: any, uploadOrder = 0) => {
      if (USE_MOCK) {
        console.log('Using mock data for photo upload');
        return true;
      }

      await ensureAdminProfile();
      
      const ext = (file.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = file.fileName || file.name || `photo-${Date.now()}.${ext}`;
      const safeFileName = fileName.replace(/[^\w.-]/g, '_');
      const storagePath = `clients/${clientId}/${galleryId}/images/${Date.now()}-${safeFileName}`;
      const contentType = file.mimeType || file.type || `image/${ext}`;
      
      if (!file?.uri) {
        throw new Error('Selected photo is missing a file URI.');
      }
      const arrayBuffer = await fetch(file.uri).then(res => res.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('client-photos')
        .upload(storagePath, arrayBuffer, {
          contentType,
          upsert: false
        });
 
      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.includes('Bucket') && message.includes('not found')) {
          throw new Error('Storage bucket "client-photos" not found. Please create required buckets in Supabase Storage.');
        }
        throw uploadError;
      }
      
      const { error: dbError } = await supabase
        .from('gallery_photos')
        .insert({
          gallery_id: galleryId,
          photo_url: storagePath,
          file_name: safeFileName,
          file_size: file.fileSize || file.size || 0,
          mime_type: contentType,
          width: file.width ?? null,
          height: file.height ?? null,
          is_watermarked: false,
          upload_order: uploadOrder
        });
      if (dbError) throw dbError;
      return storagePath;
    },

    generateUniqueAccessCode: async (maxAttempts = 10): Promise<string> => {
      return generateUniqueAccessCode(maxAttempts);
    },

    getPhotos: async (galleryIdOrIds: string | string[], page = 0, limit = 50) => {
      if (USE_MOCK) return { data: [], count: 0 };
      
      const from = page * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('gallery_photos')
        .select('*', { count: 'exact' });

      if (Array.isArray(galleryIdOrIds)) {
        query = query.in('gallery_id', galleryIdOrIds);
      } else {
        query = query.eq('gallery_id', galleryIdOrIds);
      }

      const { data, error, count } = await query
        .range(from, to)
        .order('upload_order', { ascending: true })
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('AdminService.gallery.getPhotos:', error);
        throw error;
      }
      return { data, count };
    },

    getByClient: async (clientId: string) => {
      if (USE_MOCK) return [];
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data;
    },

    subscribe: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:galleries')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'galleries' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToPhotos: (callback: (payload: any) => void) => {
      const channel = supabase
        .channel('public:gallery_photos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  },

  tempUploads: {
    uploadPhoto: async (payload: {
      temporaryName: string;
      temporaryIdentifier?: string | null;
      accessCode: string;
      file: any;
      uploadOrder?: number;
    }) => {
      await ensureAdminProfile();
      if (!payload.file?.uri) {
        throw new Error('Selected photo is missing a file URI.');
      }

      const normalizedCode = payload.accessCode.trim().toUpperCase();
      const ext = (payload.file.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = payload.file.fileName || payload.file.name || `photo-${Date.now()}.${ext}`;
      const safeFileName = fileName.replace(/[^\w.-]/g, '_');
      const storagePath = `temp/${normalizedCode}/${Date.now()}-${safeFileName}`;
      const contentType = payload.file.mimeType || payload.file.type || `image/${ext}`;

      const arrayBuffer = await fetch(payload.file.uri).then(res => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('client-photos')
        .upload(storagePath, arrayBuffer, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.includes('Bucket') && message.includes('not found')) {
          throw new Error('Storage bucket "client-photos" not found. Please create required buckets in Supabase Storage.');
        }
        throw uploadError;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const adminId = session?.user?.id ?? null;
      const uploadOrder = payload.uploadOrder ?? 0;

      const { data: tempRow, error: insertError } = await supabase
        .from('temporary_client_uploads')
        .insert({
          admin_id: adminId,
          temporary_name: payload.temporaryName.trim(),
          temporary_identifier: payload.temporaryIdentifier ?? null,
          access_code: normalizedCode,
          photo_path: storagePath,
          file_name: safeFileName,
          file_size: payload.file.fileSize || payload.file.size || 0,
          mime_type: contentType,
          width: payload.file.width ?? null,
          height: payload.file.height ?? null,
          upload_order: uploadOrder
        })
        .select('id')
        .single();

      if (insertError) {
        const errorCode = (insertError as any)?.code;
        const errorMessage = (insertError as any)?.message || '';
        const isDuplicate = errorCode === '23505' || errorMessage.includes('duplicate key value');
        if (!isDuplicate) {
          throw insertError;
        }
      } else if (tempRow?.id) {
        await supabase
          .from('audit_logs')
          .insert({
            actor_id: adminId,
            action: 'temporary_upload_created',
            entity_type: 'temporary_client_upload',
            entity_id: tempRow.id,
            metadata: {
              access_code: normalizedCode,
              temporary_name: payload.temporaryName
            }
          });
      }

      return storagePath;
    }
  },

  /**
   * 4. BTS MEDIA
   */
  bts: {
    upload: async (file: any, caption: string, visibility: 'global' | 'restricted', allowedClients: string[] = []) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Upload
      const path = `bts/${Date.now()}.mp4`; // or .jpg
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: 'bts_media',
        type: 'video/mp4' // dynamic
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('bts-media') // New bucket needed
        .upload(path, formData);
        
      if (uploadError) throw uploadError;

      // 2. Create Record
      const { error } = await (supabase as any)
        .from('bts_media')
        .insert({
          owner_admin_id: user.id,
          media_url: path,
          media_type: 'video', // detect
          caption,
          visibility,
          allowed_clients: allowedClients
        });

      if (error) throw error;
      return true;
    }
  },

  /**
   * 5. SMS & PACKAGES
   */
  sms: {
    purchaseCredits: async (amountOfSms: number, phoneNumber: string) => {
      // Custom logic: Calculate price -> Call Edge Function
      const { data, error } = await supabase.functions.invoke('buy_sms', {
        body: { amount: amountOfSms, phone_number: phoneNumber }
      });
      if (error) throw error;
      return data;
    },

    getLogs: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('sms_logs')
        .select(`
          *,
          clients (
            name
          )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    getBalance: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data } = await (supabase as any)
        .from('admin_resources')
        .select('sms_balance')
        .eq('admin_id', user.id)
        .single();
      return data?.sms_balance || 0;
    }
  },

  /**
   * 6. DASHBOARD ANALYTICS
   */
  dashboard: {
    getAnalytics: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [
        { count: clientCount },
        { count: galleryCount },
        { count: paidGalleryCount },
        { data: payments },
        { data: smsBalance },
        { data: btsStats }
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id).eq('is_paid', true),
        supabase.from('payments').select('amount, created_at').eq('owner_admin_id', user.id).eq('status', 'paid'),
        (supabase as any).from('admin_resources').select('sms_balance').eq('admin_id', user.id).single(),
        supabase.from('bts_posts').select('views_count, clicks_count, likes_count, comments_count').eq('is_active', true)
      ]);

      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      
      // Calculate BTS aggregate stats
      const totalViews = btsStats?.reduce((sum, p) => sum + (p.views_count || 0), 0) || 0;
      const totalLikes = btsStats?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
      const totalComments = btsStats?.reduce((sum, p) => sum + (p.comments_count || 0), 0) || 0;
      const totalBtsClicks = btsStats?.reduce((sum, p) => sum + (p.clicks_count || 0), 0) || 0;
      
      // Calculate basic time-based revenue (mock logic for now using JS filter)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const revenueToday = payments
        ?.filter(p => p.created_at >= startOfDay)
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      const revenueThisMonth = payments
        ?.filter(p => p.created_at >= startOfMonth)
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      return {
        totalClients: clientCount || 0,
        totalGalleries: galleryCount || 0,
        paidGalleries: paidGalleryCount || 0,
        totalRevenue,
        revenueToday,
        revenueThisMonth,
        revenueThisWeek: 0, // Todo: implement week logic
        smsBalance: smsBalance?.sms_balance || 0,
        conversionRate: galleryCount ? Math.round(((paidGalleryCount || 0) / galleryCount) * 100) : 0,
        repeatClientRate: 0, // Todo: implement
        engagement: {
            views: totalViews,
            likes: totalLikes,
            comments: totalComments,
            clicks: totalBtsClicks
        }
      };
    }
  }
  ,
  /**
   * 7. Notifications
   */
  notifications: {
    create: async (userId: string, payload: { type: string; title: string; body: string; data?: any }) => {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? null
        });
      if (error) throw error;
      return true;
    }
  },

  /**
   * 8. CHAT
   */
  chat: {
    listThreads: async () => {
      if (USE_MOCK) return [];
      const user = await ensureAdminProfile();

      // Get distinct clients from messages where I am the owner
      const { data, error } = await supabase
        .from('messages')
        .select(`
          client_id,
          created_at,
          content,
          sender_role,
          clients (
            id,
            name,
            phone
          )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by client_id and take the latest message
      const threads = new Map();
      data.forEach((msg: any) => {
        if (!threads.has(msg.client_id)) {
          threads.set(msg.client_id, {
            id: msg.client_id, // Use client_id as thread id
            clientId: msg.client_id,
            clientName: msg.clients?.name || 'Unknown',
            clientAvatar: 'https://via.placeholder.com/150', // Placeholder
            lastMessage: msg.content,
            unread: 0, // TODO: Implement unread count
            timestamp: msg.created_at,
            isOnline: false,
            clientPhone: msg.clients?.phone
          });
        }
      });

      return Array.from(threads.values());
    },

    getMessages: async (clientId: string) => {
      if (USE_MOCK) return [];
      const user = await ensureAdminProfile();

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('owner_admin_id', user.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },

    sendMessage: async (clientId: string, content: string) => {
      const user = await ensureAdminProfile();

      const { error } = await supabase
        .from('messages')
        .insert({
          owner_admin_id: user.id,
          client_id: clientId,
          sender_role: 'admin',
          content
        });

      if (error) throw error;
      return true;
    },

    subscribeToMessages: (clientId: string, callback: (payload: any) => void) => {
      const channel = supabase
        .channel(`public:messages:${clientId}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `client_id=eq.${clientId}`
          },
          callback
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    },

    subscribeToThreads: (callback: (payload: any) => void) => {
       const channel = supabase
        .channel('public:messages_threads')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' }, 
          callback
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }
};

export { generateUniqueAccessCode };
