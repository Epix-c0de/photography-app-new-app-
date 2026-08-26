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

// GET — read current version config (public, no auth needed)
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('id', 'current')
      .single();

    if (error || !data) {
      // Return defaults if no row exists
      return NextResponse.json({
        config: {
          id: 'current',
          latest_version: '1.0.0',
          minimum_version: '1.0.0',
          force_update: false,
          release_notes: 'Welcome to Epix Visuals Studios.co!',
          download_url: 'https://epix-visuals.vercel.app/download',
          file_size: '~25 MB',
          provider: 'apk-direct',
          published_at: new Date().toISOString(),
          version_history: [],
        },
      });
    }

    return NextResponse.json({ config: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// POST — update version config (super admin only)
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

    const body = await req.json();
    const {
      latest_version,
      minimum_version,
      force_update,
      release_notes,
      download_url,
      file_size,
      sha256,
      provider,
      version_history,
    } = body;

    if (!latest_version) {
      return NextResponse.json({ error: 'latest_version is required' }, { status: 400 });
    }

    // Upsert the single "current" row
    const { data, error } = await serviceSupabase
      .from('app_versions')
      .upsert({
        id: 'current',
        latest_version,
        minimum_version: minimum_version || '1.0.0',
        force_update: force_update || false,
        release_notes: release_notes || '',
        download_url: download_url || '',
        file_size: file_size || '',
        sha256: sha256 || '',
        provider: provider || 'apk-direct',
        published_at: new Date().toISOString(),
        version_history: version_history || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
