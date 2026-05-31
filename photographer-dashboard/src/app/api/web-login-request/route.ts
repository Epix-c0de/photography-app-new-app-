import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const { email, device_info } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const supabase = createServiceClient();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Find admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, role, subscription_status, subscription_expires_at, is_lifetime')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle() as any;

    // Always return same message to prevent email enumeration
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ message: 'If this email exists, an OTP has been sent.' });
    }

    // Check subscription (skip for super_admin and lifetime)
    if (profile.role === 'admin' && !profile.is_lifetime) {
      const isActive = profile.subscription_status === 'active' &&
        profile.subscription_expires_at &&
        new Date(profile.subscription_expires_at) > new Date();
      if (!isActive) {
        return NextResponse.json({ error: 'Your subscription has expired. Please renew to access the web dashboard.' }, { status: 403 });
      }
    }

    // Send OTP via Supabase Auth
    await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim(),
    });

    // Create web login request
    const token = generateToken();
    await supabase.from('web_login_requests').insert({
      admin_id: profile.id,
      token,
      device_info: device_info || null,
      ip_address: ip,
      status: 'pending',
    });

    // Notify admin via in-app notification (mobile app will show this)
    await supabase.from('notifications').insert({
      user_id: profile.id,
      type: 'web_login_request',
      title: '🔐 Web Login Request',
      body: `Web dashboard login attempt${device_info ? ` from ${device_info.substring(0, 50)}` : ''}. Tap to approve or reject.`,
      data: { token, action: 'web_login_approval' },
      read: false,
    });

    return NextResponse.json({ token, message: 'OTP sent. Check your email and approve in the mobile app.' });
  } catch (err: any) {
    console.error('[web-login-request]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
