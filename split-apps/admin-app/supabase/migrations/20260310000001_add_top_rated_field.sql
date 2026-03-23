-- Add is_top_rated column to portfolio_items for top-rated showcase
alter table public.portfolio_items
  add column if not exists is_top_rated boolean not null default false;

-- Create index for quick top-rated queries
create index if not exists portfolio_top_rated_idx on public.portfolio_items(is_top_rated) where is_top_rated = true;
