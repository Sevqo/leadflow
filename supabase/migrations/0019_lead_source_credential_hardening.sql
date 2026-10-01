-- Source credentials are never readable by browser clients. Public ingest resolves
-- the owning source from the high-entropy token hash, so source UUIDs need not be
-- disclosed in external payloads.
create unique index if not exists lead_sources_secret_hash_idx on public.lead_sources(secret_hash);

revoke select on public.lead_sources from authenticated;
grant select(id,organization_id,name,platform,status,created_by,last_received_at,created_at,updated_at)
  on public.lead_sources to authenticated;
