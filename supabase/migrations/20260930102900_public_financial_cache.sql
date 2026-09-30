-- Generated with Supabase CLI 2.118.0. Not applied to any database.
-- Private ingestion tables are intentionally outside the default Data API schema.
create schema if not exists stocklab_private;
revoke all on schema stocklab_private from public, anon, authenticated;
grant usage on schema stocklab_private to service_role;

create table stocklab_private.companies (
  corp_code text primary key check (corp_code ~ '^[0-9]{8}$'),
  name text not null check (length(name) between 1 and 500),
  fiscal_month smallint not null check (fiscal_month between 1 and 12),
  fetched_at timestamptz not null
);
create table stocklab_private.instruments (
  symbol text primary key check (symbol in ('005930','000660','035420','005380','066570')),
  corp_code text not null references stocklab_private.companies(corp_code),
  is_supported boolean not null default false
);
create index instruments_corp_code_idx on stocklab_private.instruments(corp_code);
create table stocklab_private.filings (
  receipt_no text primary key check (receipt_no ~ '^[0-9]{14}$'),
  corp_code text not null references stocklab_private.companies(corp_code),
  title text not null, filed_date date not null, fetched_at timestamptz not null
);
create index filings_company_date_idx on stocklab_private.filings(corp_code, filed_date desc);
create table stocklab_private.financial_reports (
  id uuid primary key default gen_random_uuid(),
  corp_code text not null references stocklab_private.companies(corp_code),
  year integer not null check (year between 2015 and 2100),
  report_code text not null check (report_code in ('11013','11012','11014','11011')),
  basis text not null check (basis in ('CFS','OFS')),
  receipt_no text not null references stocklab_private.filings(receipt_no),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  mapper_version text not null, fetched_at timestamptz not null,
  unique (corp_code, year, report_code, basis, receipt_no, payload_hash)
);
create index financial_reports_receipt_idx on stocklab_private.financial_reports(receipt_no);
create table stocklab_private.financial_facts (
  report_id uuid not null references stocklab_private.financial_reports(id),
  row_key text not null, raw_amounts jsonb not null,
  primary key (report_id, row_key)
);
create table stocklab_private.sync_runs (
  id uuid primary key default gen_random_uuid(), started_at timestamptz not null,
  ended_at timestamptz, status text not null check (status in ('running','complete','failed','cancelled')),
  request_count integer not null default 0 check (request_count >= 0),
  error_code text check (length(error_code) <= 40)
);
alter table stocklab_private.companies enable row level security;
alter table stocklab_private.instruments enable row level security;
alter table stocklab_private.filings enable row level security;
alter table stocklab_private.financial_reports enable row level security;
alter table stocklab_private.financial_facts enable row level security;
alter table stocklab_private.sync_runs enable row level security;
revoke all on all tables in schema stocklab_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema stocklab_private to service_role;
alter default privileges in schema stocklab_private revoke all on tables from public, anon, authenticated;
alter default privileges in schema stocklab_private revoke execute on functions from public, anon, authenticated;

-- Only an explicitly reviewed DTO belongs here; no private table/view joins.
create table public.published_datasets (
  id text primary key check (id ~ '^dart-[a-f0-9]{64}$'),
  symbol text not null check (symbol in ('005930','000660','035420','005380','066570')),
  corp_code text not null check (corp_code ~ '^[0-9]{8}$'),
  year integer not null check (year between 2015 and 2100),
  basis text not null check (basis in ('CFS','OFS')),
  revision integer not null check (revision between 1 and 1000000),
  source text not null check (source = 'opendart'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  fetched_at timestamptz not null, reviewed_at timestamptz not null, published_at timestamptz not null,
  is_published boolean not null default false,
  unique (symbol, year, basis, revision),
  check (fetched_at <= reviewed_at and reviewed_at <= published_at),
  check (payload ?& array['schemaVersion','id','source','publicationStatus','revision','company','year','basis','currency','fetchedAt','reviewedAt','publishedAt','mapperVersion','provenance','reports']),
  check (payload - array['schemaVersion','id','source','publicationStatus','revision','company','year','basis','currency','fetchedAt','reviewedAt','publishedAt','mapperVersion','provenance','reports'] = '{}'::jsonb),
  check (coalesce(payload->>'schemaVersion' = '1' and payload->>'id' = id and
    payload->>'source' = source and payload->>'publicationStatus' = 'published' and
    payload->>'revision' = revision::text and payload->>'year' = year::text and payload->>'basis' = basis and payload->>'currency' = 'KRW' and
    payload#>>'{company,symbol}' = symbol and payload#>>'{company,corpCode}' = corp_code and
    payload#>>'{company,fiscalMonth}' = '12' and payload->>'mapperVersion' = 'dart-reviewed-rows-1.0.0' and
    jsonb_typeof(payload->'reports') = 'array' and jsonb_typeof(payload->'provenance') = 'object', false)),
  check (coalesce((payload->>'fetchedAt')::timestamptz = fetched_at and
    (payload->>'reviewedAt')::timestamptz = reviewed_at and (payload->>'publishedAt')::timestamptz = published_at, false))
);
create index published_company_lookup_idx on public.published_datasets(corp_code, year desc, basis, revision desc) where is_published;
alter table public.published_datasets enable row level security;
revoke all on table public.published_datasets from public, anon, authenticated;
grant select on table public.published_datasets to anon, authenticated;
grant select, insert, update, delete on table public.published_datasets to service_role;
create policy published_datasets_read_reviewed on public.published_datasets
  for select to anon, authenticated using (is_published and source = 'opendart' and reviewed_at <= published_at and published_at <= now());
-- No INSERT/UPDATE/DELETE policies or grants for visitors. No SECURITY DEFINER functions.
