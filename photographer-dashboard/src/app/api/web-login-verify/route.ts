import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from('web_login_requests')
    .select('status, otp_verified, admin_id, expires_at')
    .eq('token', token)
    .maybeSingle() as any;

  if (!request) return NextResponse.json({ status: 'not_found' });

  if (new Date(request.expires_at) < new Date() && request.status === 'pending') {
    await supabase.from('web_login_requests').update({ status: 'expired' }).eq('token', token);
    return NextResponse.json({ status: 'expired' });
  }

  return NextResponse.json({
    status: request.status,
    otp_verified: request.otp_verified,
    admin_id: request.admin_id,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { token, otp, email } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: request } = await supabase
      .from('web_login_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle() as any;

    if (!request) return NextResponse.json({ status: 'not_found', error: 'Invalid token' });

    if (new Date(request.expires_at) < new Date()) {
      return NextResponse.json({ status: 'expired', error: 'Request expired. Please start again.' });
    }

    if (request.status === 'rejected') {
      return NextResponse.json({ status: 'rejected', error: 'Login was rejected from the mobile app.' });
    }

    // Verify OTP if provided
    if (otp && email && !request.otp_verified) {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (otpError) {
        return NextResponse.json({ status: 'otp_failed', error: 'Invalid or expired OTP.' });
      }

      await supabase.from('web_login_requests').update({ otp_verified: true }).eq('id', request.id);
    }

    return NextResponse.json({
      status: request.status,
      otp_verified: request.otp_verified || (otp ? true : false),
      admin_id: request.admin_id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
