-- Per-request cache cost. A cached token costs energy in two ways during a request: the request's new
-- tokens attend to it, and every output token reads its KV entry. So the CLI sends, summed over requests:
--   cache_x_new = Σ cache_read × (input + cache_write)
--   cache_x_out = Σ cache_read × output
-- Clients older than 0.3 don't send these; ingest fills them with a typical request (1,400 new and 350
-- output tokens per request), which matches the old fixed cache weight.

alter table public.usage_daily
  add column cache_x_new numeric not null default 0,
  add column cache_x_out numeric not null default 0;

alter table public.usage_totals
  add column cache_x_new numeric not null default 0,
  add column cache_x_out numeric not null default 0;

update public.usage_daily set cache_x_new = cache_read_tokens * 1400, cache_x_out = cache_read_tokens * 350;
update public.usage_totals set cache_x_new = cache_read_tokens * 1400, cache_x_out = cache_read_tokens * 350;

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
    input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cache_x_new, cache_x_out, first_at, last_at)
  select p_user, p_device, r.source, r.session_key, r.model, r.day,
    r.input_tokens, r.output_tokens, r.cache_write_tokens, r.cache_read_tokens,
    coalesce(r.cache_x_new, r.cache_read_tokens * 1400), coalesce(r.cache_x_out, r.cache_read_tokens * 350),
    r.first_at, r.last_at
  from jsonb_to_recordset(p_rows) as r(source text, session_key text, model text, day date,
    input_tokens bigint, output_tokens bigint, cache_write_tokens bigint, cache_read_tokens bigint,
    cache_x_new numeric, cache_x_out numeric, first_at timestamptz, last_at timestamptz)
  where v_frozen is null or r.day >= v_frozen
  on conflict (user_id, device_id, source, session_key, model, day) do update set
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    cache_write_tokens = excluded.cache_write_tokens,
    cache_read_tokens = excluded.cache_read_tokens,
    cache_x_new = excluded.cache_x_new,
    cache_x_out = excluded.cache_x_out,
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
    returning source, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
      cache_x_new, cache_x_out, first_at, last_at
  )
  insert into usage_totals as t (user_id, source, model, input_tokens, output_tokens, cache_write_tokens,
    cache_read_tokens, cache_x_new, cache_x_out, first_at, last_at)
  select p_user, source, model, sum(input_tokens), sum(output_tokens), sum(cache_write_tokens),
    sum(cache_read_tokens), sum(cache_x_new), sum(cache_x_out), min(first_at), max(last_at)
  from old group by source, model
  on conflict (user_id, source, model) do update set
    input_tokens = t.input_tokens + excluded.input_tokens,
    output_tokens = t.output_tokens + excluded.output_tokens,
    cache_write_tokens = t.cache_write_tokens + excluded.cache_write_tokens,
    cache_read_tokens = t.cache_read_tokens + excluded.cache_read_tokens,
    cache_x_new = t.cache_x_new + excluded.cache_x_new,
    cache_x_out = t.cache_x_out + excluded.cache_x_out,
    first_at = least(t.first_at, excluded.first_at),
    last_at = greatest(t.last_at, excluded.last_at);

  update devices set frozen_before = greatest(coalesce(frozen_before, p_cutoff), p_cutoff)
  where user_id = p_user and device_id = p_device;

  return v_count;
end;
$$;

revoke all on function public.ingest_usage(uuid, text, jsonb, date, boolean) from public, anon, authenticated;
