import { createClient } from '@supabase/supabase-js';

jest.setTimeout(30000);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeOrSkip = supabaseUrl && anonKey && serviceKey ? describe : describe.skip;

describeOrSkip('RLS upload policies', () => {
  const unique = Date.now();
  const adminEmail = `rls.admin.${unique}@example.com`;
  const clientEmail = `rls.client.${unique}@example.com`;
  const adminPassword = 'Admin#12345';
  const clientPassword = 'Client#12345';

  let serviceClient: ReturnType<typeof createClient>;
  let adminClient: ReturnType<typeof createClient>;
  let clientClient: ReturnType<typeof createClient>;
  let adminUserId: string;
  let clientUserId: string;

  beforeAll(async () => {
    serviceClient = createClient(supabaseUrl as string, serviceKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: adminData, error: adminError } = await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'admin' },
    });
    if (adminError || !adminData.user) {
      throw adminError || new Error('Failed to create admin user');
    }
    adminUserId = adminData.user.id;

    const { data: clientData, error: clientError } = await serviceClient.auth.admin.createUser({
      email: clientEmail,
      password: clientPassword,
      email_confirm: true,
      app_metadata: { role: 'client' },
      user_metadata: { role: 'client' },
    });
    if (clientError || !clientData.user) {
      throw clientError || new Error('Failed to create client user');
    }
    clientUserId = clientData.user.id;

    await serviceClient.from('user_profiles').upsert([
      { id: adminUserId, role: 'admin', email: adminEmail, profile_complete: true },
      { id: clientUserId, role: 'client', email: clientEmail, profile_complete: true },
    ]);

    adminClient = createClient(supabaseUrl as string, anonKey as string);
    clientClient = createClient(supabaseUrl as string, anonKey as string);

    const { error: adminSignInError } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (adminSignInError) throw adminSignInError;

    const { error: clientSignInError } = await clientClient.auth.signInWithPassword({
      email: clientEmail,
      password: clientPassword,
    });
    if (clientSignInError) throw clientSignInError;
  });

  afterAll(async () => {
    if (serviceClient && adminUserId) {
      await serviceClient.auth.admin.deleteUser(adminUserId);
    }
    if (serviceClient && clientUserId) {
      await serviceClient.auth.admin.deleteUser(clientUserId);
    }
  });

  it('allows client to upload own avatar and update profile', async () => {
    const fileName = `${clientUserId}/${Date.now()}.jpg`;
    const { error: uploadError } = await clientClient.storage
      .from('avatars')
      .upload(fileName, new Uint8Array([1, 2, 3]).buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(uploadError).toBeNull();

    const { error: updateError } = await clientClient
      .from('user_profiles')
      .update({ avatar_url: `avatars/${fileName}` })
      .eq('id', clientUserId);
    expect(updateError).toBeNull();
  });

  it('blocks client from uploading avatar for another user', async () => {
    const fileName = `${adminUserId}/${Date.now()}.jpg`;
    const { error } = await clientClient.storage
      .from('avatars')
      .upload(fileName, new Uint8Array([4, 5, 6]).buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it('allows admin to upload BTS and announcement media', async () => {
    const btsName = `bts/${Date.now()}.jpg`;
    const annName = `announcements/${Date.now()}.jpg`;

    const { error: btsUploadError } = await adminClient.storage
      .from('media')
      .upload(btsName, new Uint8Array([7, 8, 9]).buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(btsUploadError).toBeNull();

    const { error: annUploadError } = await adminClient.storage
      .from('media')
      .upload(annName, new Uint8Array([10, 11, 12]).buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(annUploadError).toBeNull();
  });

  it('blocks client from uploading BTS media', async () => {
    const fileName = `bts/${Date.now()}.jpg`;
    const { error } = await clientClient.storage
      .from('media')
      .upload(fileName, new Uint8Array([13, 14, 15]).buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it('allows admin inserts and blocks client inserts for BTS and announcements', async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: btsInsertError } = await adminClient
      .from('bts_posts')
      .insert({
        title: 'Test BTS',
        media_url: 'https://example.com/bts.jpg',
        media_type: 'image',
        expires_at: expiresAt,
        created_by: adminUserId,
      });
    expect(btsInsertError).toBeNull();

    const { error: annInsertError } = await adminClient
      .from('announcements')
      .insert({
        title: 'Test Announcement',
        media_url: 'https://example.com/ann.jpg',
        media_type: 'image',
        expires_at: expiresAt,
        created_by: adminUserId,
      });
    expect(annInsertError).toBeNull();

    const { error: btsClientError } = await clientClient
      .from('bts_posts')
      .insert({
        title: 'Client BTS',
        media_url: 'https://example.com/client-bts.jpg',
        media_type: 'image',
        expires_at: expiresAt,
        created_by: clientUserId,
      });
    expect(btsClientError).not.toBeNull();

    const { error: annClientError } = await clientClient
      .from('announcements')
      .insert({
        title: 'Client Announcement',
        media_url: 'https://example.com/client-ann.jpg',
        media_type: 'image',
        expires_at: expiresAt,
        created_by: clientUserId,
      });
    expect(annClientError).not.toBeNull();
  });
});
