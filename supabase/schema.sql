-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).

create table if not exists public.posts (
  id text primary key,
  author_id text not null,
  author_handle text not null,
  project_name text not null,
  lead text not null default '',
  post_html text not null default '',
  social_link text not null default '',
  cover_image text,
  parts jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  schematics jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_updated_at_idx on public.posts (updated_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);

-- Public read; writes go through Next.js API with the service role key.
alter table public.posts enable row level security;

drop policy if exists "posts are publicly readable" on public.posts;
create policy "posts are publicly readable"
  on public.posts
  for select
  to anon, authenticated
  using (true);
