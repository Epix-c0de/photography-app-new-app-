do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) then
    create table if not exists public.payment_config (
      id uuid primary key default gen_random_uuid(),
      admin_id uuid references public.user_profiles(id) not null,
      mpesa_shortcode text not null,
      receiving_phone_number text not null,
      payment_recipient_name text not null,
      reference_format text default 'gallery_code',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    if not exists (
      select 1
      from pg_constraint
      where conname = 'payment_config_reference_format_check'
    ) then
      alter table public.payment_config
        add constraint payment_config_reference_format_check
        check (reference_format in ('gallery_code', 'client_name', 'custom_text'));
    end if;

    create unique index if not exists payment_config_admin_id_key
      on public.payment_config (admin_id);

    alter table public.payment_config enable row level security;

    drop policy if exists "Admins can view their own payment config" on public.payment_config;
    create policy "Admins can view their own payment config"
      on public.payment_config for select
      using (auth.uid() = admin_id);

    drop policy if exists "Admins can insert their own payment config" on public.payment_config;
    create policy "Admins can insert their own payment config"
      on public.payment_config for insert
      with check (auth.uid() = admin_id);

    drop policy if exists "Admins can update their own payment config" on public.payment_config;
    create policy "Admins can update their own payment config"
      on public.payment_config for update
      using (auth.uid() = admin_id)
      with check (auth.uid() = admin_id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clients'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'galleries'
  ) then
    create table if not exists public.payments (
      id uuid primary key default gen_random_uuid(),
      owner_admin_id uuid references public.user_profiles(id) not null,
      client_id uuid references public.clients(id) not null,
      gallery_id uuid references public.galleries(id),
      amount numeric not null,
      currency text not null default 'KES',
      status text not null default 'pending',
      mpesa_receipt_number text,
      mpesa_checkout_request_id text,
      phone_number text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    if not exists (
      select 1
      from pg_constraint
      where conname = 'payments_status_check'
    ) then
      alter table public.payments
        add constraint payments_status_check
        check (status in ('pending', 'paid', 'failed', 'cancelled'));
    end if;

    create index if not exists payments_owner_admin_id_idx on public.payments (owner_admin_id);
    create index if not exists payments_client_id_idx on public.payments (client_id);
    create index if not exists payments_gallery_id_idx on public.payments (gallery_id);
    create index if not exists payments_checkout_request_id_idx on public.payments (mpesa_checkout_request_id);
    create unique index if not exists payments_receipt_number_key
      on public.payments (mpesa_receipt_number)
      where mpesa_receipt_number is not null;

    alter table public.payments enable row level security;

    drop policy if exists "Admins can view their payments" on public.payments;
    create policy "Admins can view their payments"
      on public.payments for select
      using (auth.uid() = owner_admin_id);

    drop policy if exists "Clients can view their payments" on public.payments;
    create policy "Clients can view their payments"
      on public.payments for select
      using (
        exists (
          select 1
          from public.clients c
          where c.id = payments.client_id
            and c.user_id = auth.uid()
        )
      );
  end if;
end $$;
