import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function DELETE(req: NextRequest) {
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

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { data: apk } = await serviceSupabase
      .from('apk_versions')
      .select('storage_path, type, is_latest')
      .eq('id', id)
      .single();

    if (!apk) {
      return NextResponse.json({ error: 'APK not found' }, { status: 404 });
    }

    await serviceSupabase.storage.from('apk-files').remove([apk.storage_path]);
    await serviceSupabase.from('apk_versions').delete().eq('id', id);

    if ((apk as any).is_latest) {
      const { data: prevApk } = await serviceSupabase
        .from('apk_versions')
        .select('id')
        .eq('type', (apk as any).type)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (prevApk) {
        await serviceSupabase
          .from('apk_versions')
          .update({ is_latest: true })
          .eq('id', prevApk.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
