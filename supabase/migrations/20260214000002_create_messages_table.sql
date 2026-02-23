do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) then
    create table if not exists public.messages (
        id uuid default gen_random_uuid() primary key,
        owner_admin_id uuid references public.user_profiles(id) not null,
        client_id uuid references public.clients(id) not null,
        sender_role text check (sender_role in ('admin', 'client')) not null,
        content text not null,
        is_read boolean default false,
        created_at timestamptz default now()
    );

    alter table public.messages enable row level security;

    drop policy if exists "Admins can view messages for their clients" on public.messages;
    create policy "Admins can view messages for their clients"
        on public.messages for select
        to authenticated
        using ( owner_admin_id = auth.uid() );

    drop policy if exists "Admins can insert messages" on public.messages;
    create policy "Admins can insert messages"
        on public.messages for insert
        to authenticated
        with check ( owner_admin_id = auth.uid() );

    drop policy if exists "Admins can update messages (mark read)" on public.messages;
    create policy "Admins can update messages (mark read)"
        on public.messages for update
        to authenticated
        using ( owner_admin_id = auth.uid() );

    create index if not exists idx_messages_admin_client on public.messages(owner_admin_id, client_id);
    create index if not exists idx_messages_created_at on public.messages(created_at desc);
  end if;
end $$;
