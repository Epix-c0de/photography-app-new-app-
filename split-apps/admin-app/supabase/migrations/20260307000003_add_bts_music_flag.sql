alter table public.bts_posts
  add column if not exists has_music boolean not null default false,
  add column if not exists music_url text;
