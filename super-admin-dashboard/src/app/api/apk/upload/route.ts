import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase(token?: string) {
  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const userSupabase = getSupabase(token);
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = getServiceSupabase();
    const { data: profile } = await serviceSupabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const version = formData.get('version') as string;
    const changelog = formData.get('changelog') as string;

    if (!file || !type || !version) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'admin' && type !== 'client') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const filename = `epix-${type}-v${version}.apk`;
    const storagePath = `${type}/${filename}`;

    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await serviceSupabase.storage
      .from('apk-files')
      .upload(storagePath, bytes, {
        contentType: 'application/vnd.android.package-archive',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    await serviceSupabase
      .from('apk_versions')
      .update({ is_latest: false })
      .eq('type', type)
      .eq('is_latest', true);

    const { data: apkVersion, error: dbError } = await serviceSupabase
      .from('apk_versions')
      .insert({
        type,
        version,
        filename,
        storage_path: storagePath,
        file_size: file.size,
        changelog: changelog || null,
        is_latest: true,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, apk: apkVersion });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
