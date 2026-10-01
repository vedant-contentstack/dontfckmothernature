-- Replace per-file usage rows with a bounded design.
--
-- usage_daily   one row per (device, log file, model, day) for the last 35 days. Re-sending a file replaces
--               its rows, so the same tokens are never added twice.
-- usage_totals  one row per (source, model) holding everything older than the window.
-- devices       per-device date before which days are frozen. Rows for frozen days are ignored, so an old
--               session that is reopened only adds its new messages.
--
-- Everything on the server so far was imported today from logs that are still on disk, so the old table is
-- dropped and the updated CLI rebuilds it with a full rescan.

drop table if exists public.usage_sessions;

create table public.devices (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  device_id      text not null,
  frozen_before  date,
  primary key (user_id, device_id)
);

create table public.usage_daily (
  user_id             uuid not null references public.profiles(id) on delete cascade,
  device_id           text not null,
  source              text not null check (source in ('claude', 'codex')),
  session_key         text not null,
  model               text not null,
  day                 date not null,
  input_tokens        bigint not null default 0 check (input_tokens >= 0),
  output_tokens       bigint not null default 0 check (output_tokens >= 0),
  cache_write_tokens  bigint not null default 0 check (cache_write_tokens >= 0),
  cache_read_tokens   bigint not null default 0 check (cache_read_tokens >= 0),
  first_at            timestamptz not null,
  last_at             timestamptz not null,
  primary key (user_id, device_id, source, session_key, model, day)
);

create table public.usage_totals (
  user_id             uuid not null references public.profiles(id) on delete cascade,
  source              text not null check (source in ('claude', 'codex')),
  model               text not null,
  input_tokens        bigint not null default 0,
  output_tokens       bigint not null default 0,
  cache_write_tokens  bigint not null default 0,
  cache_read_tokens   bigint not null default 0,
  first_at            timestamptz not null,
  last_at             timestamptz not null,
  primary key (user_id, source, model)
);

alter table public.devices      enable row level security;
alter table public.usage_daily  enable row level security;
alter table public.usage_totals enable row level security;

-- Applies one batch in a single transaction: drop frozen days and replace the rest. On the last batch of a
-- sync, also roll up days older than p_cutoff into usage_totals and freeze them for this device.
create or replace function public.ingest_usage(p_user uuid, p_device text, p_rows jsonb, p_cutoff date, p_final boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_frozen date;
  v_count  integer;
begin
  insert into devices (user_id, device_id) values (p_user, p_device) on conflict do nothing;
  select frozen_before into v_frozen from devices where user_id = p_user and device_id = p_device for update;

  insert into usage_daily as d (user_id, device_id, source, session_key, model, day,
    input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, first_at, last_at)
  select p_user, p_device, r.source, r.session_key, r.model, r.day,
    r.input_tokens, r.output_tokens, r.cache_write_tokens, r.cache_read_tokens, r.first_at, r.last_at
  from jsonb_to_recordset(p_rows) as r(source text, session_key text, model text, day date,
    input_tokens bigint, output_tokens bigint, cache_write_tokens bigint, cache_read_tokens bigint,
    first_at timestamptz, last_at timestamptz)
  where v_frozen is null or r.day >= v_frozen
  on conflict (user_id, device_id, source, session_key, model, day) do update set
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    cache_write_tokens = excluded.cache_write_tokens,
    cache_read_tokens = excluded.cache_read_tokens,
    first_at = excluded.first_at,
    last_at = excluded.last_at;
  get diagnostics v_count = row_count;

  -- A large sync arrives in several batches; roll up and freeze only after the last one.
  if not p_final then
    return v_count;
  end if;

  with old as (
    delete from usage_daily
    where user_id = p_user and device_id = p_device and day < p_cutoff
    returning source, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, first_at, last_at
  )
  insert into usage_totals as t (user_id, source, model, input_tokens, output_tokens, cache_write_tokens,
    cache_read_tokens, first_at, last_at)
  select p_user, source, model, sum(input_tokens), sum(output_tokens), sum(cache_write_tokens),
    sum(cache_read_tokens), min(first_at), max(last_at)
  from old group by source, model
  on conflict (user_id, source, model) do update set
    input_tokens = t.input_tokens + excluded.input_tokens,
    output_tokens = t.output_tokens + excluded.output_tokens,
    cache_write_tokens = t.cache_write_tokens + excluded.cache_write_tokens,
    cache_read_tokens = t.cache_read_tokens + excluded.cache_read_tokens,
    first_at = least(t.first_at, excluded.first_at),
    last_at = greatest(t.last_at, excluded.last_at);

  update devices set frozen_before = greatest(coalesce(frozen_before, p_cutoff), p_cutoff)
  where user_id = p_user and device_id = p_device;

  return v_count;
end;
$$;

revoke all on function public.ingest_usage(uuid, text, jsonb, date, boolean) from public, anon, authenticated;
