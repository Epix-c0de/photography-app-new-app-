do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sms_templates'
  ) then
    create table public.sms_templates (
      id uuid primary key default gen_random_uuid(),
      owner_admin_id uuid not null references public.user_profiles(id),
      name text not null,
      body text not null,
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sms_drafts'
  ) then
    create table public.sms_drafts (
      id uuid primary key default gen_random_uuid(),
      owner_admin_id uuid not null references public.user_profiles(id),
      client_id uuid references public.clients(id),
      phone_number text not null,
      message text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sms_logs'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sms_logs' and column_name = 'error_message'
    ) then
      alter table public.sms_logs add column error_message text;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sms_logs' and column_name = 'cost'
    ) then
      alter table public.sms_logs add column cost numeric;
    end if;
  end if;
end $$;

alter table public.sms_templates enable row level security;
alter table public.sms_drafts enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sms_logs'
  ) then
    alter table public.sms_logs enable row level security;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sms_templates' and policyname = 'Admins can manage sms templates'
  ) then
    create policy "Admins can manage sms templates"
      on public.sms_templates for all
      using (auth.uid() = owner_admin_id)
      with check (auth.uid() = owner_admin_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sms_drafts' and policyname = 'Admins can manage sms drafts'
  ) then
    create policy "Admins can manage sms drafts"
      on public.sms_drafts for all
      using (auth.uid() = owner_admin_id)
      with check (auth.uid() = owner_admin_id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sms_logs'
  ) and not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sms_logs' and policyname = 'Admins can manage sms logs'
  ) then
    create policy "Admins can manage sms logs"
      on public.sms_logs for all
      using (auth.uid() = owner_admin_id)
      with check (auth.uid() = owner_admin_id);
  end if;
end $$;

create index if not exists idx_sms_logs_admin_created_at on public.sms_logs(owner_admin_id, created_at desc);
create index if not exists idx_sms_logs_admin_status on public.sms_logs(owner_admin_id, status);
create index if not exists idx_sms_templates_admin_name on public.sms_templates(owner_admin_id, name);
