import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();
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
