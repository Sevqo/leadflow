-- Outbound campaign operations. External research, enrichment and sending remain
-- provider-backed; these tables own the reviewable workspace state and outcomes.
create table public.outbound_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  website_url text,
  offer_summary text not null default '',
  value_proposition text not null default '',
  target_industries text[] not null default '{}',
  target_regions text[] not null default '{}',
  target_company_sizes text[] not null default '{}',
  target_titles text[] not null default '{}',
  tone text not null default 'PROFESSIONAL' check (tone in ('PROFESSIONAL','FRIENDLY','CONCISE','CUSTOM')),
  booking_url text,
  daily_send_limit integer not null default 25 check (daily_send_limit between 1 and 500),
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','ACTIVE','PAUSED','COMPLETE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);

create table public.outbound_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campaign_id uuid not null,
  position integer not null check (position between 1 and 20),
  delay_days integer not null default 0 check (delay_days between 0 and 90),
  subject_template text not null default '',
  body_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,campaign_id) references public.outbound_campaigns(organization_id,id) on delete cascade,
  unique (campaign_id,position)
);

create table public.outbound_prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campaign_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  email text,
  title text,
  company text not null check (char_length(btrim(company)) between 2 and 200),
  website text,
  country text,
  industry text,
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  research_notes text,
  personalized_subject text,
  personalized_body text,
  status text not null default 'SOURCED' check (status in ('SOURCED','REVIEW','APPROVED','CONTACTED','REPLIED','INTERESTED','MEETING','DISQUALIFIED','BOUNCED','OPTED_OUT')),
  lead_id uuid references public.leads(id) on delete set null,
  last_contacted_at timestamptz,
  replied_at timestamptz,
  meeting_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,campaign_id) references public.outbound_campaigns(organization_id,id) on delete cascade,
  unique (campaign_id,email)
);

create index outbound_campaigns_org_status_idx on public.outbound_campaigns(organization_id,status);
create index outbound_prospects_campaign_status_idx on public.outbound_prospects(organization_id,campaign_id,status);

alter table public.outbound_campaigns enable row level security;
alter table public.outbound_sequence_steps enable row level security;
alter table public.outbound_prospects enable row level security;

grant select,insert,update,delete on public.outbound_campaigns,public.outbound_sequence_steps,public.outbound_prospects to authenticated;

create policy outbound_campaigns_read on public.outbound_campaigns for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_campaigns_write on public.outbound_campaigns for all to authenticated
  using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy outbound_sequence_steps_read on public.outbound_sequence_steps for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_sequence_steps_write on public.outbound_sequence_steps for all to authenticated
  using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy outbound_prospects_read on public.outbound_prospects for select to authenticated using (public.is_org_member(organization_id));
create policy outbound_prospects_write on public.outbound_prospects for all to authenticated
  using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));

create trigger set_outbound_campaigns_updated_at before update on public.outbound_campaigns for each row execute function public.set_updated_at();
create trigger set_outbound_sequence_steps_updated_at before update on public.outbound_sequence_steps for each row execute function public.set_updated_at();
create trigger set_outbound_prospects_updated_at before update on public.outbound_prospects for each row execute function public.set_updated_at();

create or replace function public.promote_outbound_prospect(target_org uuid,target_prospect uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.outbound_prospects; saved_lead public.leads; actor uuid:=auth.uid();
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN','MANAGER']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  select * into p from public.outbound_prospects where id=target_prospect and organization_id=target_org for update;
  if p.id is null then raise exception 'prospect unavailable'; end if;
  if p.lead_id is not null then return p.lead_id; end if;
  saved_lead:=public.create_lead_with_contact(target_org,p.name,p.email,null,p.company,'Outbound prospect','Outbound',
    case when p.status in ('REPLIED','INTERESTED','MEETING') then 'QUALIFIED'::public.lead_stage else 'NEW'::public.lead_stage end,
    p.fit_score,null,null,'Review outbound conversation',array['outbound',lower(replace(p.campaign_id::text,'-',''))],
    jsonb_build_object('campaign_id',p.campaign_id,'prospect_id',p.id,'research_notes',coalesce(p.research_notes,'')));
  update public.outbound_prospects set lead_id=saved_lead.id where id=p.id;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(target_org,actor,'OUTBOUND_PROSPECT_PROMOTED','outbound_prospect',p.id,jsonb_build_object('lead_id',saved_lead.id,'campaign_id',p.campaign_id));
  return saved_lead.id;
end $$;
revoke all on function public.promote_outbound_prospect(uuid,uuid) from public,anon;
grant execute on function public.promote_outbound_prospect(uuid,uuid) to authenticated;
