-- dontfckmothernature schema.
-- All access goes through the Next.js API with the service role key.
-- RLS is on with no policies, so the anon and authenticated roles cannot read or write anything.

create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  secret_hash  text not null unique,          -- sha256 of the private token held by the CLI and the dashboard link
  country      text not null default 'IN',    -- ISO 3166-1 alpha-2, used for grid factor and daily limits
  share_slug   text unique,                   -- null means sharing is off
  created_at   timestamptz not null default now()
);

-- One row per (log file, model). The CLI re-sends full totals for a file, so upserts are idempotent.
create table public.usage_sessions (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  source              text not null check (source in ('claude', 'codex')),
  session_key         text not null,           -- sha1 of the log file path, never the path itself
  model               text not null,
  input_tokens        bigint not null default 0 check (input_tokens >= 0),        -- excludes cache reads and writes
  output_tokens       bigint not null default 0 check (output_tokens >= 0),       -- includes reasoning tokens
  cache_write_tokens  bigint not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens   bigint not null default 0 check (cache_read_tokens >= 0),
  first_at            timestamptz not null,
  last_at             timestamptz not null,
  updated_at          timestamptz not null default now(),
  unique (user_id, source, session_key, model)
);
create index usage_sessions_user_idx on public.usage_sessions (user_id);

create table public.offset_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('daily', 'onetime', 'custom')),
  action_id   text,                            -- catalogue id for daily and onetime, null for custom
  quantity    numeric not null default 1 check (quantity > 0),
  factor      text check (factor in ('water', 'energy', 'co2')),  -- custom only
  amount      numeric check (amount > 0),                          -- custom only, in L / kWh / kg
  note        text check (char_length(note) <= 140),
  logged_on   date not null,                   -- the user's local date
  created_at  timestamptz not null default now(),
  check (
    (kind = 'custom' and factor is not null and amount is not null and action_id is null)
    or (kind <> 'custom' and action_id is not null and factor is null and amount is null)
  )
);
create index offset_logs_user_idx on public.offset_logs (user_id, logged_on);

alter table public.profiles       enable row level security;
alter table public.usage_sessions enable row level security;
alter table public.offset_logs    enable row level security;
