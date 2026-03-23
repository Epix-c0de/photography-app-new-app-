-- Add photo upload workflow fields to notifications table
-- Migration: 20260217000005_photo_upload_notifications.sql

-- Add new columns for photo upload notifications
alter table public.notifications
add column if not exists client_id uuid references public.clients(id),
add column if not exists gallery_id uuid references public.galleries(id),
add column if not exists access_code text,
add column if not exists sent_status text default 'pending' check (sent_status in ('pending', 'sent', 'delivered', 'failed'));

-- Create index for efficient queries
create index if not exists idx_notifications_client_id on public.notifications(client_id);
create index if not exists idx_notifications_gallery_id on public.notifications(gallery_id);
create index if not exists idx_notifications_access_code on public.notifications(access_code);

-- Update RLS policies to allow admins to manage gallery notifications
create policy "Admins can manage gallery notifications"
  on public.notifications for all
  using (
    exists (
      select 1 from public.clients
      where public.clients.id = public.notifications.client_id
      and public.clients.owner_admin_id = auth.uid()
    )
  );

-- Ensure clients can still view their own notifications (existing policy should work)
-- The existing policy "Users can view own notifications" should work with user_id

-- Function to create gallery notification
create or replace function public.create_gallery_notification(
  p_client_id uuid,
  p_gallery_id uuid,
  p_access_code text,
  p_title text default 'Your Photos Are Ready 📸',
  p_body text default null
)
returns uuid as $$
declare
  v_notification_id uuid;
  v_client_record public.clients;
  v_gallery_record public.galleries;
  v_body_text text;
begin
  -- Get client and gallery details
  select * into v_client_record from public.clients where id = p_client_id;
  select * into v_gallery_record from public.galleries where id = p_gallery_id;

  if v_client_record is null or v_gallery_record is null then
    raise exception 'Client or gallery not found';
  end if;

  -- Generate personalized body if not provided
  if p_body is null then
    v_body_text := format('Hello %s, your %s gallery is ready!', v_client_record.name, v_gallery_record.name);
  else
    v_body_text := p_body;
  end if;

  -- Create notification
  insert into public.notifications (
    user_id,
    client_id,
    gallery_id,
    access_code,
    type,
    title,
    body,
    data,
    sent_status
  ) values (
    v_client_record.user_id,
    p_client_id,
    p_gallery_id,
    p_access_code,
    'gallery_ready',
    p_title,
    v_body_text,
    jsonb_build_object(
      'galleryId', p_gallery_id,
      'accessCode', p_access_code,
      'galleryName', v_gallery_record.name
    ),
    'pending'
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$ language plpgsql security definer;
