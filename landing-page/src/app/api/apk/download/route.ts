import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (!type || (type !== 'admin' && type !== 'client')) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: apk, error } = await supabase
      .from('apk_versions')
      .select('*')
      .eq('type', type)
      .eq('is_latest', true)
      .single();

    if (error || !apk) {
      return NextResponse.json({ error: 'APK not found' }, { status: 404 });
    }

    const { data: urlData } = supabase.storage
      .from('apk-files')
      .getPublicUrl(apk.storage_path);

    return NextResponse.json({
      download_url: urlData.publicUrl,
      version: apk.version,
      filename: apk.filename,
      file_size: apk.file_size,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
