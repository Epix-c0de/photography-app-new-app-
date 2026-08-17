import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const [adminResult, clientResult] = await Promise.all([
      supabase.from('apk_versions').select('*').eq('type', 'admin').eq('is_latest', true).single(),
      supabase.from('apk_versions').select('*').eq('type', 'client').eq('is_latest', true).single(),
    ]);

    return NextResponse.json({
      admin: adminResult.data || null,
      client: clientResult.data || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
