-- Enable pgcrypto for hashing
create extension if not exists "pgcrypto";

-- Delivery Gateways (SMS/WhatsApp Providers)
create type gateway_type as enum ('http', 'smpp', 'whatsapp_cloud', 'local_modem');

create table if not exists delivery_gateways (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    type gateway_type not null,
    config jsonb default '{}'::jsonb, -- URL, API keys, headers
    priority int default 0, -- Higher number = higher priority
    active boolean default true,
    cost_per_msg decimal(10, 4) default 0.05, -- Default cost
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Delivery Credits
create table if not exists delivery_credits (
    id uuid default gen_random_uuid() primary key,
    balance decimal(10, 2) default 0.00,
    warning_threshold decimal(10, 2) default 10.00,
    critical_threshold decimal(10, 2) default 5.00,
    auto_refill_enabled boolean default false,
    auto_refill_amount decimal(10, 2) default 20.00,
    updated_at timestamptz default now()
);

-- Initialize default credit record (singleton)
insert into delivery_credits (balance) values (100.00) on conflict do nothing;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clients'
  ) then
    create table if not exists access_codes (
        id uuid default gen_random_uuid() primary key,
        client_id uuid references clients(id) on delete cascade,
        code_hash text not null,
        expires_at timestamptz not null,
        status text default 'active' check (status in ('active', 'used', 'expired')),
        created_at timestamptz default now()
    );
  end if;
end $$;

-- Delivery Logs (Audit Trail)
create type delivery_status as enum ('pending', 'sent', 'delivered', 'failed', 'blocked');

create table if not exists delivery_logs (
    id uuid default gen_random_uuid() primary key,
    recipient text not null,
    message_type text default 'sms', -- 'sms' or 'whatsapp'
    gateway_id uuid references delivery_gateways(id),
    status delivery_status default 'pending',
    attempts int default 0,
    error_code text,
    error_message text,
    cost decimal(10, 4) default 0.00,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Function to deduce credits on send
create or replace function deduct_delivery_credit()
returns trigger as $$
begin
    if new.status = 'sent' and old.status != 'sent' then
        update delivery_credits
        set balance = balance - new.cost
        where id = (select id from delivery_credits limit 1);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger on_delivery_sent
    after update on delivery_logs
    for each row
    execute function deduct_delivery_credit();

-- RLS Policies
alter table delivery_gateways enable row level security;
alter table delivery_credits enable row level security;
alter table delivery_logs enable row level security;

drop policy if exists "Admins can manage delivery gateways" on delivery_gateways;
create policy "Admins can manage delivery gateways"
    on delivery_gateways for all
    using (auth.role() = 'authenticated'); -- Simplified for demo

drop policy if exists "Admins can view credits" on delivery_credits;
create policy "Admins can view credits"
    on delivery_credits for all
    using (auth.role() = 'authenticated');

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'access_codes'
  ) then
    alter table access_codes enable row level security;
    drop policy if exists "Admins can manage access codes" on access_codes;
    create policy "Admins can manage access codes"
        on access_codes for all
        using (auth.role() = 'authenticated');
  end if;
end $$;

drop policy if exists "Admins can view logs" on delivery_logs;
create policy "Admins can view logs"
    on delivery_logs for all
    using (auth.role() = 'authenticated');
