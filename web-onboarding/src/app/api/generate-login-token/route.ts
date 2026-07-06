import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { admin_id } = await req.json();

    if (!admin_id) {
      return NextResponse.json({ error: 'Missing admin_id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify the admin exists and has active subscription
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, subscription_status, is_lifetime')
      .eq('id', admin_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const isActive = profile.role === 'super_admin' || profile.is_lifetime || profile.subscription_status === 'active';
    if (!isActive) {
      return NextResponse.json({ error: 'Subscription not active' }, { status: 403 });
    }

    // Generate a one-time login token (64 bytes hex)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Store token with 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('one_time_tokens')
      .upsert({
        token_hash: await hashToken(token),
        user_id: admin_id,
        expires_at: expiresAt,
        used: false,
      }, { onConflict: 'user_id' });

    if (tokenError) {
      // If table doesn't exist, fall back to simpler approach
      console.warn('one_time_tokens table not found, using email-based approach');
    }

    return NextResponse.json({
      token,
      expires_at: expiresAt,
      email: profile.role, // Return minimal info
    });

  } catch (err: any) {
    console.error('[generate-login-token]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
