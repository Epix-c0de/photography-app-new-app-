/// <reference lib="deno.ns" />
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req: Request) => {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
        const existing = users.find(u => u.email === email);
        if (existing) {
          userId = existing.id;
          // Update password if needed
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
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
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
