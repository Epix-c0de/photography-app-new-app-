import { Database } from '@/types/supabase';

export type Gallery = Database['public']['Tables']['galleries']['Row'] & {
  cover_photo?: string; // Signed URL
  photo_count?: number;
};

export type Photo = Database['public']['Tables']['photos']['Row'] & {
  url: string; // Signed URL
};

export type Notification = Database['public']['Tables']['notifications']['Row'];

export type PaymentStatus = Database['public']['Tables']['payments']['Row']['status'];

/**
 * Client-Side Backend Logic Interface
 * This mirrors the "PART 2" requirements from the architecture blueprint.
 * In a real implementation, these would call Supabase SDK methods.
 */
export const BackendService = {
  /**
   * 2.1 Client Access Flow
   * Verifies role and loads initial dashboard data
   */
  getClientDashboard: async (userId: string) => {
    // Mock implementation
    // 1. Verify role = client (RLS would handle this naturally)
    // 2. Load active galleries
    // 3. Load notifications
    // 4. Load payment status
    return {
      galleries: [] as Gallery[],
      notifications: [] as Notification[],
      pendingPayments: 0,
    };
  },

  /**
   * 2.2 Client Galleries
   * Fetches galleries visible to the client
   */
  getGalleries: async (): Promise<Gallery[]> => {
    // Supabase: supabase.from('galleries').select('*')
    // RLS ensures client only sees their own
    return []; 
  },

  /**
   * 2.3 Client Gallery Actions - View Photos
   * Returns signed URLs based on lock status
   */
  getGalleryPhotos: async (galleryId: string): Promise<Photo[]> => {
    // Supabase: 
    // 1. Check if gallery is paid/unlocked
    // 2. Select photos (variant 'clean' or 'watermarked' based on status)
    // 3. Generate signed URLs for each
    return [];
  },

  /**
   * 2.5 Client Payments - Initiate M-Pesa
   * Triggers Edge Function 'stk_push'
   */
  initiatePayment: async (galleryId: string, amount: number, phoneNumber: string) => {
    // Supabase: supabase.functions.invoke('stk_push', { body: { galleryId, amount, phoneNumber } })
    return {
      checkoutRequestId: 'ws_CO_...',
      status: 'pending' as PaymentStatus,
    };
  },

  /**
   * 2.6 Client Profile - Update
   */
  updateProfile: async (updates: { name?: string; phone?: string }) => {
    // Supabase: supabase.from('user_profiles').update(updates).eq('id', auth.uid())
    return true;
  },

  /**
   * 2.6 Client Profile - Logout
   */
  logout: async () => {
    // Supabase: supabase.auth.signOut()
    // Optional: Call Edge Function to invalidate other sessions if 'global' logout requested
    return true;
  }
};
