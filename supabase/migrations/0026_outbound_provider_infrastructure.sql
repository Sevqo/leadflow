-- Provider-neutral outbound execution. Credentials and adapter URLs live only in Edge Function secrets.
alter table public.outbound_prospects
  add column research_status text not null default 'NOT_STARTED' check (research_status in ('NOT_STARTED','QUEUED','RUNNING','COMPLETE','FAILED','BLOCKED')),
  add column enrichment_status text not null default 'NOT_STARTED' check (enrichment_status in ('NOT_STARTED','QUEUED','RUNNING','COMPLETE','FAILED','BLOCKED')),
  add column email_validation_status text not null default 'UNKNOWN' check (email_validation_status in ('UNKNOWN','QUEUED','RUNNING','VALID','RISKY','INVALID','FAILED','BLOCKED')),
  add column email_validation_reason text,
  add column enrichment jsonb not null default '{}'::jsonb,
  add column provider_contact_id text;

create table public.outbound_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability text not null check (capability in ('RESEARCH','ENRICHMENT','EMAIL_VALIDATION','MAILBOX','CALENDAR')),
  provider_name text not null check (char_length(btrim(provider_name)) between 2 and 80),
  status text not null default 'SETUP_REQUIRED' check (status in ('SETUP_REQUIRED','VERIFYING','CONNECTED','ERROR','DISABLED')),
  public_config jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,capability)
);

create table public.outbound_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.outbound_campaigns(id) on delete cascade,
  prospect_id uuid references public.outbound_prospects(id) on delete cascade,
  capability text not null check (capability in ('RESEARCH','ENRICHMENT','EMAIL_VALIDATION','MAILBOX','CALENDAR')),
  job_type text not null check (job_type in ('RESEARCH_PROSPECT','ENRICH_PROSPECT','VALIDATE_EMAIL','SEND_SEQUENCE_STEP','SYNC_BOOKING')),
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','SUCCEEDED','FAILED','BLOCKED','CANCELLED')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outbound_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.outbound_campaigns(id) on delete cascade,
  prospect_id uuid not null references public.outbound_prospects(id) on delete cascade,
  sequence_step_id uuid references public.outbound_sequence_steps(id) on delete set null,
  provider_message_id text,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENT','DELIVERED','REPLIED','BOUNCED','FAILED','COMPLAINED','UNSUBSCRIBED')),
  subject text,
  sent_at timestamptz,
  delivered_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,provider_message_id)
);

create table public.outbound_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email)>1),
  reason text not null check (reason in ('UNSUBSCRIBED','BOUNCED','COMPLAINT','MANUAL')),
  source text not null default 'LeadFlow',
  created_at timestamptz not null default now(),
  unique (organization_id,email)
);

create table public.outbound_provider_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability text not null,
  provider_name text not null,
  external_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider_name,external_id,event_type)
);

create index outbound_jobs_queue_idx on public.outbound_jobs(status,available_at,created_at) where status in ('QUEUED','FAILED');
create index outbound_jobs_org_idx on public.outbound_jobs(organization_id,created_at desc);
create index outbound_deliveries_org_idx on public.outbound_message_deliveries(organization_id,campaign_id,created_at desc);

alter table public.outbound_provider_connections enable row level security;
alter table public.outbound_jobs enable row level security;
alter table public.outbound_message_deliveries enable row level security;
alter table public.outbound_suppressions enable row level security;
alter table public.outbound_provider_events enable row level security;

grant select on public.outbound_provider_connections,public.outbound_jobs,public.outbound_message_deliveries,public.outbound_suppressions,public.outbound_provider_events to authenticated;
create policy outbound_connections_read on public.outbound_provider_connections for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_jobs_read on public.outbound_jobs for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_deliveries_read on public.outbound_message_deliveries for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_suppressions_read on public.outbound_suppressions for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_events_read on public.outbound_provider_events for select to authenticated using (public.is_org_member(organization_id));

create trigger set_outbound_provider_connections_updated_at before update on public.outbound_provider_connections for each row execute function public.set_updated_at();
create trigger set_outbound_jobs_updated_at before update on public.outbound_jobs for each row execute function public.set_updated_at();
create trigger set_outbound_message_deliveries_updated_at before update on public.outbound_message_deliveries for each row execute function public.set_updated_at();

create or replace function public.configure_outbound_provider(target_org uuid,target_capability text,target_provider text,config jsonb default '{}'::jsonb)
returns public.outbound_provider_connections language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.outbound_provider_connections;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  if target_capability not in ('RESEARCH','ENRICHMENT','EMAIL_VALIDATION','MAILBOX','CALENDAR') then raise exception 'unsupported capability'; end if;
  if char_length(btrim(target_provider)) not between 2 and 80 then raise exception 'provider name is invalid'; end if;
  insert into public.outbound_provider_connections(organization_id,capability,provider_name,status,public_config,last_error)
  values(target_org,target_capability,btrim(target_provider),'SETUP_REQUIRED',coalesce(config,'{}'::jsonb),null)
  on conflict(organization_id,capability) do update set provider_name=excluded.provider_name,status='SETUP_REQUIRED',public_config=excluded.public_config,last_error=null
  returning * into saved;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(target_org,auth.uid(),'OUTBOUND_PROVIDER_CONFIGURED','outbound_provider',saved.id,jsonb_build_object('capability',target_capability,'provider',target_provider));
  return saved;
end $$;

create or replace function public.enqueue_outbound_job(target_org uuid,target_prospect uuid,target_job_type text,target_step uuid default null)
returns public.outbound_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.outbound_prospects; c public.outbound_provider_connections; capability_name text; saved public.outbound_jobs; step_row public.outbound_sequence_steps;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN','MANAGER']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  capability_name:=case target_job_type when 'RESEARCH_PROSPECT' then 'RESEARCH' when 'ENRICH_PROSPECT' then 'ENRICHMENT' when 'VALIDATE_EMAIL' then 'EMAIL_VALIDATION' when 'SEND_SEQUENCE_STEP' then 'MAILBOX' when 'SYNC_BOOKING' then 'CALENDAR' end;
  if capability_name is null then raise exception 'unsupported job type'; end if;
  select * into p from public.outbound_prospects where organization_id=target_org and id=target_prospect;
  if p.id is null then raise exception 'prospect unavailable'; end if;
  select * into c from public.outbound_provider_connections where organization_id=target_org and capability=capability_name and status='CONNECTED';
  if c.id is null then raise exception '% provider setup is required',replace(initcap(capability_name),'_',' '); end if;
  if target_job_type in ('VALIDATE_EMAIL','SEND_SEQUENCE_STEP') and p.email is null then raise exception 'prospect email is required'; end if;
  if target_job_type='SEND_SEQUENCE_STEP' then
    if p.status<>'APPROVED' then raise exception 'prospect must be approved before sending'; end if;
    if p.email_validation_status<>'VALID' then raise exception 'a valid email is required before sending'; end if;
    if exists(select 1 from public.outbound_suppressions s where s.organization_id=target_org and s.email=lower(p.email)) then raise exception 'recipient is suppressed'; end if;
    select * into step_row from public.outbound_sequence_steps where id=target_step and campaign_id=p.campaign_id;
    if step_row.id is null then raise exception 'sequence step unavailable'; end if;
  end if;
  insert into public.outbound_jobs(organization_id,campaign_id,prospect_id,capability,job_type,input,created_by)
  values(target_org,p.campaign_id,p.id,capability_name,target_job_type,jsonb_build_object('sequence_step_id',target_step),auth.uid()) returning * into saved;
  update public.outbound_prospects set
    research_status=case when target_job_type='RESEARCH_PROSPECT' then 'QUEUED' else research_status end,
    enrichment_status=case when target_job_type='ENRICH_PROSPECT' then 'QUEUED' else enrichment_status end,
    email_validation_status=case when target_job_type='VALIDATE_EMAIL' then 'QUEUED' else email_validation_status end
  where id=p.id;
  return saved;
end $$;

create or replace function public.claim_outbound_jobs(batch_size integer default 20)
returns setof public.outbound_jobs language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return query with claimed as (
    select id from public.outbound_jobs where status in ('QUEUED','FAILED') and available_at<=now() and attempt<max_attempts order by available_at,created_at for update skip locked limit least(greatest(batch_size,1),50)
  ) update public.outbound_jobs j set status='RUNNING',locked_at=now(),attempt=j.attempt+1 from claimed where j.id=claimed.id returning j.*;
end $$;

revoke all on function public.configure_outbound_provider(uuid,text,text,jsonb) from public,anon;
revoke all on function public.enqueue_outbound_job(uuid,uuid,text,uuid) from public,anon;
revoke all on function public.claim_outbound_jobs(integer) from public,anon,authenticated;
grant execute on function public.configure_outbound_provider(uuid,text,text,jsonb),public.enqueue_outbound_job(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.claim_outbound_jobs(integer) to service_role;

create or replace function public.configure_outbound_worker_scheduler(project_url text,cron_secret text)
returns bigint language plpgsql security definer set search_path=public,extensions,vault,cron,pg_catalog as $$
declare normalized_url text:=rtrim(trim(project_url),'/'); project_secret_id uuid; cron_secret_id uuid; existing_job record; scheduled_job_id bigint;
begin
  if normalized_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'project_url must be an https Supabase project URL'; end if;
  if length(cron_secret)<32 then raise exception 'cron_secret must be at least 32 characters'; end if;
  select id into project_secret_id from vault.secrets where name='leadflow_outbound_project_url';
  if project_secret_id is null then perform vault.create_secret(normalized_url,'leadflow_outbound_project_url','Outbound worker project URL'); else perform vault.update_secret(project_secret_id,normalized_url,null,'Outbound worker project URL'); end if;
  select id into cron_secret_id from vault.secrets where name='leadflow_outbound_cron_secret';
  if cron_secret_id is null then perform vault.create_secret(cron_secret,'leadflow_outbound_cron_secret','Outbound worker invocation secret'); else perform vault.update_secret(cron_secret_id,cron_secret,null,'Outbound worker invocation secret'); end if;
  for existing_job in select jobid from cron.job where jobname='leadflow-outbound-worker' loop perform cron.unschedule(existing_job.jobid); end loop;
  select cron.schedule('leadflow-outbound-worker','* * * * *',$schedule$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='leadflow_outbound_project_url') || '/functions/v1/outbound-worker',headers := jsonb_build_object('Content-Type','application/json','x-outbound-secret',(select decrypted_secret from vault.decrypted_secrets where name='leadflow_outbound_cron_secret')),body := jsonb_build_object('scheduledAt',now()),timeout_milliseconds := 30000);$schedule$) into scheduled_job_id;
  return scheduled_job_id;
end $$;
revoke all on function public.configure_outbound_worker_scheduler(text,text) from public,anon,authenticated;
grant execute on function public.configure_outbound_worker_scheduler(text,text) to service_role;
