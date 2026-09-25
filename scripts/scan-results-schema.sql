-- Scan cache schema for the server-side /api/scan flow (api/scan.ts).
-- Run in Supabase Dashboard → SQL Editor. Idempotent.

-- 1) Cache of scan results, one row per `${strategy_id}:${cap_category}`.
--    Written only by the service role (api/scan.ts); publicly readable.
create table if not exists scan_results (
  id text primary key,
  strategy_id text not null,
  cap_category text not null,
  picks jsonb not null,
  data_source text not null,
  updated_at timestamptz not null default now()
);

alter table scan_results enable row level security;

drop policy if exists "public read" on scan_results;
create policy "public read" on scan_results for select using (true);
-- No insert/update/delete policy: writes go through the service role only.

-- 2) Upstox instrument key per universe stock (e.g. NSE_EQ|INE848E01016).
alter table stock_universe add column if not exists instrument_key text;

-- Speeds up the staleness check + universe load in api/scan.ts.
create index if not exists scan_results_updated_at_idx
  on scan_results (updated_at desc);
