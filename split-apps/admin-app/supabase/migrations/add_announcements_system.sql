-- Announcements system migration
-- Adds tables for announcements, comments, reactions, and portfolio uploads

-- 1. ANNOUNCEMENTS TABLE
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  content text not null,
  media_urls text[], -- Array of storage URLs (images/videos)
  media_types text[], -- Array of media types: 'image', 'video'
  visibility text not null check (visibility in ('all', 'selected')) default 'all',
  is_active boolean not null default true,
  is_pinned boolean not null default false,
  comment_count int default 0,
  reaction_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.announcements enable row level security;

-- Admin can create, read, update their own announcements
create policy "Admins can manage their announcements"
  on public.announcements for all
  using (auth.uid() = owner_admin_id);

-- Clients can only read active announcements
create policy "Clients can view active announcements"
  on public.announcements for select
  using (is_active = true and (expires_at is null or expires_at > now()));

-- 2. ANNOUNCEMENT COMMENTS TABLE
create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcement_comments enable row level security;

-- Users can view comments on active announcements
create policy "Users can view announcement comments"
  on public.announcement_comments for select
  using (
    exists (
      select 1 from public.announcements
      where announcements.id = announcement_comments.announcement_id
      and announcements.is_active = true
    )
  );

-- Users can insert their own comments
create policy "Users can create comments"
  on public.announcement_comments for insert
  with check (auth.uid() = user_id);

-- Users can update their own comments
create policy "Users can update own comments"
  on public.announcement_comments for update
  using (auth.uid() = user_id);

-- Users can delete their own comments
create policy "Users can delete own comments"
  on public.announcement_comments for delete
  using (auth.uid() = user_id);

-- Admins can delete any comments on their announcements
create policy "Admins can delete comments on their announcements"
  on public.announcement_comments for delete
  using (
    exists (
      select 1 from public.announcements
      where announcements.id = announcement_comments.announcement_id
      and announcements.owner_admin_id = auth.uid()
    )
  );

-- 3. ANNOUNCEMENT REACTIONS TABLE
-- Supports emoji reactions: 👍, ❤️, 😂, 😮, 😢, 🔥, etc.
create table if not exists public.announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  reaction_emoji text not null, -- e.g., '👍', '❤️', '😂'
  created_at timestamptz not null default now(),
  unique(announcement_id, user_id, reaction_emoji) -- User can only have one of each emoji per announcement
);

alter table public.announcement_reactions enable row level security;

-- Users can view reactions
create policy "Users can view reactions"
  on public.announcement_reactions for select
  using (
    exists (
      select 1 from public.announcements
      where announcements.id = announcement_reactions.announcement_id
      and announcements.is_active = true
    )
  );

-- Users can add reactions
create policy "Users can add reactions"
  on public.announcement_reactions for insert
  with check (auth.uid() = user_id);

-- Users can remove their own reactions
create policy "Users can remove own reactions"
  on public.announcement_reactions for delete
  using (auth.uid() = user_id);

-- 4. PORTFOLIO UPLOADS TABLE
-- For BTS/Portfolio content that admin uploads
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  content_type text not null check (content_type in ('bts', 'portfolio')), -- Behind-the-scenes or portfolio
  category text,
  media_urls text[] not null, -- Array of storage URLs
  media_types text[] not null, -- Array of 'image' or 'video'
  is_featured boolean default false,
  is_public boolean default true,
  view_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_items enable row level security;

-- Admins can manage their portfolio items
create policy "Admins can manage their portfolio items"
  on public.portfolio_items for all
  using (auth.uid() = owner_admin_id);

-- Clients can view public portfolio items
create policy "Clients can view public portfolio items"
  on public.portfolio_items for select
  using (is_public = true);

-- 5. ADMIN RESPONSE TO COMMENTS (Optional - for admin replies to comments)
create table if not exists public.admin_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.announcement_comments(id) on delete cascade,
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  response_text text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_replies enable row level security;

-- Anyone can view admin replies to comments
create policy "Users can view admin replies"
  on public.admin_replies for select
  using (
    exists (
      select 1 from public.announcement_comments ac
      join public.announcements a on ac.announcement_id = a.id
      where ac.id = admin_replies.comment_id
      and a.is_active = true
    )
  );

-- Admin can create replies
create policy "Admins can create replies on their announcements"
  on public.admin_replies for insert
  with check (
    auth.uid() = admin_id and
    exists (
      select 1 from public.announcement_comments ac
      join public.announcements a on ac.announcement_id = a.id
      where ac.id = comment_id
      and a.owner_admin_id = auth.uid()
    )
  );

-- Create indexes for performance
create index if not exists announcements_owner_idx on public.announcements(owner_admin_id);
create index if not exists announcements_active_idx on public.announcements(is_active);
create index if not exists announcements_created_idx on public.announcements(created_at desc);
create index if not exists comments_announcement_idx on public.announcement_comments(announcement_id);
create index if not exists comments_user_idx on public.announcement_comments(user_id);
create index if not exists reactions_announcement_idx on public.announcement_reactions(announcement_id);
create index if not exists reactions_user_idx on public.announcement_reactions(user_id);
create index if not exists portfolio_owner_idx on public.portfolio_items(owner_admin_id);
create index if not exists portfolio_type_idx on public.portfolio_items(content_type);
create index if not exists replies_comment_idx on public.admin_replies(comment_id);

-- Trigger to auto-update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_announcements_updated_at before update on public.announcements
  for each row execute function public.update_updated_at_column();

create trigger update_portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.update_updated_at_column();

create trigger update_comments_updated_at before update on public.announcement_comments
  for each row execute function public.update_updated_at_column();
