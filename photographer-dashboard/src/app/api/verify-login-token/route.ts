import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Hash the token to compare
    const tokenHash = await hashToken(token);

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('one_time_tokens')
      .select('user_id, expires_at, used')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // Check if already used
    if (tokenData.used) {
      return NextResponse.json({ error: 'Token already used' }, { status: 401 });
    }

    // Mark token as used
    await supabase
      .from('one_time_tokens')
      .update({ used: true })
      .eq('token_hash', tokenHash);

    // Create a session for the user via admin API
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: tokenData.user_id, // We'll need to fetch the email
    });

    // Alternative: Use signInWithOtp or create a session directly
    // For now, return the user_id so the client can create a session
    return NextResponse.json({
      user_id: tokenData.user_id,
      success: true,
    });

  } catch (err: any) {
    console.error('[verify-login-token]', err);
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
