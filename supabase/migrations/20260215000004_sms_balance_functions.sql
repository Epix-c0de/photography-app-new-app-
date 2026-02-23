create or replace function public.increment_sms_balance(p_admin_id uuid, p_amount int)
returns int
language plpgsql
security definer
as $$
declare new_balance int;
begin
  insert into public.admin_resources (admin_id, sms_balance)
  values (p_admin_id, 0)
  on conflict (admin_id) do nothing;

  update public.admin_resources
    set sms_balance = sms_balance + greatest(0, p_amount),
        updated_at = now()
    where admin_id = p_admin_id
    returning sms_balance into new_balance;

  return new_balance;
end
$$;

create or replace function public.decrement_sms_balance(p_admin_id uuid, p_amount int)
returns int
language plpgsql
security definer
as $$
declare new_balance int;
begin
  insert into public.admin_resources (admin_id, sms_balance)
  values (p_admin_id, 0)
  on conflict (admin_id) do nothing;

  update public.admin_resources
    set sms_balance = greatest(0, sms_balance - greatest(0, p_amount)),
        updated_at = now()
    where admin_id = p_admin_id
    returning sms_balance into new_balance;

  return new_balance;
end
$$;
