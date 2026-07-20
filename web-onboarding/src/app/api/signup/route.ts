import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, studioName, email, phone, password, start_trial } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch trial days from platform_settings
    let trialDays = 7;
    const { data: trialSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_admin_trial_days')
      .single();
    if (trialSetting?.value) trialDays = parseInt(trialSetting.value) || 7;

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        studio_name: studioName || name,
        phone,
        role: 'admin',
      },
      app_metadata: {
        role: 'admin',
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      throw authError;
    }

    const adminId = authData.user.id;

    // 2. Create user_profiles row
    const profileData: any = {
      id: adminId,
      role: 'admin',
      name,
      email,
      phone,
      subscription_status: start_trial ? 'active' : 'inactive',
    };

    if (start_trial) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + trialDays);
      profileData.subscription_expires_at = expiresAt.toISOString();
    }

    const { error: profileError } = await supabase.from('user_profiles').insert(profileData);

    if (profileError && !profileError.message.includes('duplicate')) {
      throw profileError;
    }

    // 3. If trial, generate token and return immediately
    if (start_trial) {
      // Generate one-time login token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const encoder = new TextEncoder();
      const tokenData = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);
      const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase.from('one_time_tokens').insert({
        token_hash: tokenHash,
        user_id: adminId,
        expires_at: expiresAt,
      });

      return NextResponse.json({
        admin_id: adminId,
        token,
        trial_days: trialDays,
        message: `Trial activated for ${trialDays} days.`,
      });
    }

    // 4. Initiate M-Pesa STK push via the admin_subscribe Edge Function
    const { data: stkData, error: stkError } = await supabase.functions.invoke('admin_subscribe', {
      body: { phone_number: phone, admin_id: adminId },
    });

    if (stkError) throw stkError;

    return NextResponse.json({
      admin_id: adminId,
      checkout_request_id: stkData.checkout_request_id,
      message: 'Account created. Complete M-Pesa payment to activate.',
    });

  } catch (err: any) {
    console.error('[signup API]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
