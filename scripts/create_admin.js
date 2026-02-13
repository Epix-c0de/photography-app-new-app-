const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function cleanEnvValue(value) {
  if (typeof value !== 'string') return value;
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  try {
    const envCandidates = ['../.env', '../.env.local', '../.env.development', '../.env.production'].map(p =>
      path.resolve(__dirname, p)
    );

    for (const envPath of envCandidates) {
      if (!fs.existsSync(envPath)) continue;

      const envConfig = fs.readFileSync(envPath, 'utf8');
      envConfig.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
        if (key && value) {
          if (!supabaseUrl && key.trim() === 'EXPO_PUBLIC_SUPABASE_URL') supabaseUrl = cleanEnvValue(value);
          if (!serviceRoleKey && key.trim() === 'SUPABASE_SERVICE_ROLE_KEY') serviceRoleKey = cleanEnvValue(value);
        }
      });

      if (supabaseUrl && serviceRoleKey) break;
    }
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

const args = process.argv.slice(2);
let argIndex = 0;
const looksLikeEmail = value => typeof value === 'string' && /.+@.+\..+/.test(value.trim());

if (args[argIndex] && /^https?:\/\//i.test(args[argIndex])) {
  supabaseUrl = cleanEnvValue(args[argIndex]);
  argIndex += 1;
}

if (args[argIndex] && !looksLikeEmail(args[argIndex])) {
  serviceRoleKey = cleanEnvValue(args[argIndex]);
  argIndex += 1;
}

const adminEmail = args[argIndex] || 'admin@lexnart.com';
const adminPassword = args[argIndex + 1] || 'admin1234';

supabaseUrl = cleanEnvValue(supabaseUrl);
serviceRoleKey = cleanEnvValue(serviceRoleKey);

if (typeof serviceRoleKey === 'string' && /<\s*service_role_key\s*>/i.test(serviceRoleKey)) {
  console.error('Error: You passed the placeholder "<SERVICE_ROLE_KEY>" instead of a real key.');
  console.error('Fix: Supabase Dashboard -> Project Settings -> API -> service_role (keep it private).');
  process.exit(1);
}

if (!supabaseUrl) {
  console.error('Error: EXPO_PUBLIC_SUPABASE_URL is missing. Please provide it in .env or as the first argument.');
  console.error('Usage: node scripts/create_admin.js "<SUPABASE_URL>" "<SERVICE_ROLE_KEY>" "[adminEmail]" "[adminPassword]"');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing. Please provide it in .env or as the second argument.');
  console.error('You can find this key in your Supabase Dashboard -> Project Settings -> API -> service_role');
  console.error('Usage: node scripts/create_admin.js "<SUPABASE_URL>" "<SERVICE_ROLE_KEY>" "[adminEmail]" "[adminPassword]"');
  console.error('   or: node scripts/create_admin.js "<SERVICE_ROLE_KEY>" "[adminEmail]" "[adminPassword]" (if EXPO_PUBLIC_SUPABASE_URL is already in .env)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  
  console.log(`Creating/Updating admin user: ${adminEmail}`);
  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'admin' },
    app_metadata: { role: 'admin' }
  });

  let userId = user?.id;

  if (createError) {
    if (createError.message.includes('already been registered')) {
      console.log('User already exists, fetching ID...');
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find(u => u.email === adminEmail);
      if (existing) {
        userId = existing.id;
        console.log(`Found existing user ID: ${userId}`);
        await supabase.auth.admin.updateUserById(userId, { 
          password: adminPassword,
          user_metadata: { role: 'admin' },
          app_metadata: { role: 'admin' }
        });
        console.log('Updated existing user password and metadata.');
      } else {
        console.error('Could not find existing user despite error.');
        process.exit(1);
      }
    } else {
      console.error('Failed to create user:', createError.message);
      process.exit(1);
    }
  } else {
    console.log(`User created with ID: ${userId}`);
  }

  console.log('Upserting admin profile...');
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      role: 'admin',
      email: adminEmail,
      profile_complete: true
    });

  if (profileError) {
    console.error('Failed to upsert profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Admin user and profile configured successfully!');
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
}

createAdmin().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
