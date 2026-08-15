import { getSupabase } from '../../services/supabase';
import { logger } from '../../utils/logger';

export async function getBookings(photographerId: string, date?: string): Promise<string> {
  const supabase = getSupabase();

  try {
    let query = supabase
      .from('bookings')
      .select('*, client:clients(temporary_name, phone_number)')
      .eq('photographer_id', photographerId)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });

    if (date) {
      query = query.eq('booking_date', date);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return date ? `No bookings found for ${date}.` : 'No bookings found.';
    }

    const lines = data.map((b, i) => {
      const clientName = (b.client as any)?.temporary_name || 'Unknown';
      const status = b.status.charAt(0).toUpperCase() + b.status.slice(1);
      return `${i + 1}. *${clientName}*
   📅 ${b.booking_date} at ${b.booking_time || 'TBD'}
   📍 ${b.location || 'TBD'}
   📷 ${b.event_type || 'Shoot'}
   Status: ${status}`;
    });

    return `📅 *Bookings${date ? ` for ${date}` : ''}* (${data.length})

${lines.join('\n\n')}`;
  } catch (error: any) {
    logger.error('Failed to fetch bookings', { error: error.message });
    return 'Failed to fetch bookings. Please try again.';
  }
}

export async function getClientCount(photographerId: string): Promise<string> {
  const supabase = getSupabase();

  try {
    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('photographer_id', photographerId);

    if (error) throw error;

    return `👥 *Total Clients:* ${count || 0}`;
  } catch (error: any) {
    logger.error('Failed to fetch client count', { error: error.message });
    return 'Failed to fetch client count. Please try again.';
  }
}

export async function getClients(photographerId: string): Promise<string> {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, temporary_name, phone_number, registration_status, created_at')
      .eq('photographer_id', photographerId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      return 'No clients found. Use "Register Client" to add one.';
    }

    const lines = data.map((c, i) => {
      const status = c.registration_status.charAt(0).toUpperCase() + c.registration_status.slice(1);
      return `${i + 1}. *${c.temporary_name || 'Unknown'}*
   📱 ${c.phone_number}
   Status: ${status}`;
    });

    return `👥 *My Clients* (${data.length})

${lines.join('\n\n')}`;
  } catch (error: any) {
    logger.error('Failed to fetch clients', { error: error.message });
    return 'Failed to fetch clients. Please try again.';
  }
}

export async function getGalleries(photographerId: string): Promise<string> {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from('galleries')
      .select('*, client:clients(temporary_name)')
      .eq('photographer_id', photographerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return 'No galleries found.';
    }

    const lines = data.map((g, i) => {
      const clientName = (g.client as any)?.temporary_name || 'Unknown';
      const status = g.status.charAt(0).toUpperCase() + g.status.slice(1);
      return `${i + 1}. *${g.title}*
   👤 ${clientName}
   🖼️ ${g.total_images || 0} images
   Status: ${status}`;
    });

    return `🖼️ *Recent Galleries* (${data.length})

${lines.join('\n\n')}`;
  } catch (error: any) {
    logger.error('Failed to fetch galleries', { error: error.message });
    return 'Failed to fetch galleries. Please try again.';
  }
}

export async function getRecentActivity(photographerId: string): Promise<string> {
  const supabase = getSupabase();

  try {
    const [bookingsRes, clientsRes, galleriesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, event_type, status, created_at')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('clients')
        .select('id, temporary_name, registration_status, created_at')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('galleries')
        .select('id, title, status, total_images, created_at')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const activities: string[] = [];

    if (bookingsRes.data && bookingsRes.data.length > 0) {
      activities.push(...bookingsRes.data.map((b) =>
        `📅 New ${b.event_type || 'booking'} on ${b.booking_date} (${b.status})`
      ));
    }

    if (clientsRes.data && clientsRes.data.length > 0) {
      activities.push(...clientsRes.data.map((c) =>
        `👤 ${c.temporary_name || 'New client'} - ${c.registration_status}`
      ));
    }

    if (galleriesRes.data && galleriesRes.data.length > 0) {
      activities.push(...galleriesRes.data.map((g) =>
        `🖼️ "${g.title}" - ${g.total_images || 0} images (${g.status})`
      ));
    }

    if (activities.length === 0) {
      return 'No recent activity.';
    }

    return `📊 *Recent Activity*

${activities.join('\n')}`;
  } catch (error: any) {
    logger.error('Failed to fetch activity', { error: error.message });
    return 'Failed to fetch recent activity. Please try again.';
  }
}
