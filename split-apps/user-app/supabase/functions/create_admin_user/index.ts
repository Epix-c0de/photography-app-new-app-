// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DenoRef = (globalThis as any).Deno;

DenoRef?.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      DenoRef?.env?.get('SUPABASE_URL') ?? '',
      DenoRef?.env?.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Create or Get User
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' },
      app_metadata: { role: 'admin' }
    });

    let userId = user?.id;

    if (createError) {
      // If user already exists, try to get their ID
      if (createError.message.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users.find((u: any) => u.email === email);
        if (existing) {
          userId = existing.id;
          // Update password if needed and ensure email is confirmed
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: { role: 'admin' },
            app_metadata: { role: 'admin' }
          });
        }
      } else {
        throw createError;
      }
    }

    if (!userId) throw new Error("Failed to resolve user ID");

    // 2. Ensure Profile is Admin
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        role: 'admin',
        email: email,
        profile_complete: true
      });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ message: `Admin user ${email} created/updated successfully`, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
