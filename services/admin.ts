import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

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
      
      if (error && error.code === 'PGRST116') {
        // Create default settings if not exist
        const { data: newData, error: newError } = await (supabase as any)
          .from('admin_settings')
          .insert({ admin_id: user.id })
          .select()
          .single();
        if (newError) throw newError;
        return newData;
      }
      
      if (error) throw error;
      return data;
    },

    update: async (updates: AdminSettingsUpdate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('admin_settings')
        .update(updates)
        .eq('admin_id', user.id);
        
      if (error) throw error;
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
    list: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },

    create: async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_admin_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, owner_admin_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: ClientUpdate) => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      return true;
    }
  },

  /**
   * 3. GALLERY MANAGEMENT
   */
  gallery: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('galleries')
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

    create: async (data: { 
      clientId: string, 
      name: string, 
      price: number,
      shootType: string,
      scheduledRelease?: string,
      accessCode?: string,
      watermarkEnabled?: boolean,
      isPaid?: boolean,
      status?: 'locked' | 'unlocked' | 'archived'
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const accessCode = data.accessCode ?? Math.floor(100000 + Math.random() * 900000).toString();
      const isPaid = !!data.isPaid;
      const isLocked = data.status ? data.status !== 'unlocked' : true;
      const watermarkEnabled = data.watermarkEnabled ?? !isPaid;

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

      if (error) throw error;
      return gallery;
    },

    /**
     * Upload Photo (Clean + server-side pipeline)
     * 1. Ensures required buckets exist (via edge function)
     * 2. Uploads original to 'photos-clean'
     * 3. Invokes 'image_pipeline' to generate watermarked + thumbnail
     * 4. Inserts DB rows for both variants
     */
    uploadPhoto: async (galleryId: string, file: any) => {
      // Ensure buckets exist
      await supabase.functions.invoke('ensure_buckets', {
        body: { buckets: ['photos-clean', 'photos-watermarked', 'thumbnails'] }
      });
      
      const ext = (file.uri.split('.').pop() || 'jpg').toLowerCase();
      const cleanPath = `${galleryId}/${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: `original.${ext}`,
        type: `image/${ext}`,
      } as any);
 
      const { error: uploadError } = await supabase.storage
        .from('photos-clean')
        .upload(cleanPath, formData);
 
      if (uploadError) {
        const message = (uploadError as any)?.message || String(uploadError);
        if (message.includes('Bucket') && message.includes('not found')) {
          throw new Error('Storage bucket "photos-clean" not found. Please create required buckets in Supabase Storage.');
        }
        throw uploadError;
      }
 
      // Call pipeline
      const { data: pipeRes, error: pipeError } = await supabase.functions.invoke('image_pipeline', {
        body: {
          sourceBucket: 'photos-clean',
          sourcePath: cleanPath,
          galleryId
        }
      });
      if (pipeError) throw pipeError;
 
      const { watermarkedPath } = pipeRes || {};
      
      // Insert DB rows
      const { error: dbError } = await supabase
        .from('photos')
        .insert([
          {
            gallery_id: galleryId,
            storage_path: cleanPath,
            variant: 'clean',
            size_bytes: file.size || null
          },
          {
            gallery_id: galleryId,
            storage_path: watermarkedPath,
            variant: 'watermarked',
            size_bytes: null
          }
        ]);
      if (dbError) throw dbError;
      return true;
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
    purchaseCredits: async (amountOfSms: number) => {
      // Custom logic: Calculate price -> Call Edge Function
      const { data, error } = await supabase.functions.invoke('buy_sms', {
        body: { amount: amountOfSms }
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
      const { data } = await (supabase as any)
        .from('admin_resources')
        .select('sms_balance')
        .eq('admin_id', user!.id)
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
  }
};
