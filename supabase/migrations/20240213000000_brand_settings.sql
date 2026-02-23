-- Create brand_settings table
create table if not exists public.brand_settings (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id) on delete cascade not null,
  brand_name text not null default 'Epix Visuals Studios.co',
  tagline text,
  logo_url text,
  app_display_name text default 'Epix Visuals Studios.co',
  
  -- Watermark Settings
  watermark_text text default 'Epix Visuals Studios.co',
  watermark_logo_url text,
  watermark_opacity integer default 30, -- 0 to 100
  watermark_rotation integer default 45, -- degrees
  watermark_size text default 'medium', -- small, medium, large
  watermark_position text default 'center', -- center, grid, randomized
  embed_client_name boolean default true,
  embed_gallery_code boolean default true,
  block_screenshots boolean default true,
  
  -- Build Settings (for reference)
  custom_app_icon_url text,
  custom_package_name text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(admin_id)
);

-- RLS Policies
alter table public.brand_settings enable row level security;

drop policy if exists "Admins can view their own brand settings" on public.brand_settings;
create policy "Admins can view their own brand settings"
  on public.brand_settings for select
  using (auth.uid() = admin_id);

drop policy if exists "Admins can update their own brand settings" on public.brand_settings;
create policy "Admins can update their own brand settings"
  on public.brand_settings for update
  using (auth.uid() = admin_id);

drop policy if exists "Admins can insert their own brand settings" on public.brand_settings;
create policy "Admins can insert their own brand settings"
  on public.brand_settings for insert
  with check (auth.uid() = admin_id);

-- Public access for client side (read-only) - In a real multi-tenant app, this would be scoped by client's associated admin
-- For this template, we'll allow authenticated users to read (assuming they are clients of the admin)
drop policy if exists "Users can view brand settings" on public.brand_settings;
create policy "Users can view brand settings"
  on public.brand_settings for select
  using (true);
