import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, studioName, email, phone, password } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can log in immediately
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
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: adminId,
      role: 'admin',
      name,
      email,
      phone,
      subscription_status: 'inactive',
    });

    if (profileError && !profileError.message.includes('duplicate')) {
      throw profileError;
    }

    // 3. Initiate M-Pesa STK push via the admin_subscribe Edge Function
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
