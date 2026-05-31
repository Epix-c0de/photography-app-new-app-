import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkoutRequestId = searchParams.get('checkout_request_id');
  const adminId = searchParams.get('admin_id');

  if (!checkoutRequestId || !adminId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('admin_subscriptions')
      .select('status')
      .eq('checkout_request_id', checkoutRequestId)
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ status: data?.status ?? 'pending' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
