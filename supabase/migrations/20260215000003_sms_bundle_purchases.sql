create table if not exists public.sms_bundle_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  phone_number text not null,
  sms_amount int not null,
  amount numeric not null,
  currency text not null default 'KES',
  status text not null default 'pending',
  mpesa_receipt_number text,
  mpesa_checkout_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sms_bundle_purchases_status_check'
  ) then
    alter table public.sms_bundle_purchases
      add constraint sms_bundle_purchases_status_check
      check (status in ('pending', 'paid', 'failed', 'cancelled'));
  end if;
end $$;

create index if not exists sms_bundle_purchases_admin_created_at_idx
  on public.sms_bundle_purchases (owner_admin_id, created_at desc);
create index if not exists sms_bundle_purchases_checkout_idx
  on public.sms_bundle_purchases (mpesa_checkout_request_id);

alter table public.sms_bundle_purchases enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sms_bundle_purchases' and policyname = 'Admins can view their sms bundle purchases'
  ) then
    create policy "Admins can view their sms bundle purchases"
      on public.sms_bundle_purchases for select
      using (auth.uid() = owner_admin_id);
  end if;
end $$;
