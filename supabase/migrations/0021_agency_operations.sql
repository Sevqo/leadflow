-- Agency delivery records are workspace-owned. Clients never inherit staff access.
create table public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  status text not null default 'ACTIVE' check (status in ('PROSPECT','ONBOARDING','ACTIVE','PAUSED','ARCHIVED')),
  industry text, contact_name text, contact_email text, website text,
  internal_notes text, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index agency_clients_org_name_idx on public.agency_clients(organization_id,name);

create table public.agency_projects (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  client_id uuid not null, name text not null check (char_length(btrim(name)) between 2 and 160),
  description text, status text not null default 'PLANNED' check (status in ('PLANNED','ACTIVE','BLOCKED','COMPLETE','ARCHIVED')),
  owner_id uuid references auth.users(id) on delete set null,
  due_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade,
  unique (organization_id,id),
  unique (organization_id,client_id,id)
);
create index agency_projects_client_idx on public.agency_projects(organization_id,client_id,status);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  project_id uuid not null, title text not null check (char_length(btrim(title)) between 2 and 160),
  due_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.agency_projects(organization_id,id) on delete cascade
);
create index project_milestones_project_idx on public.project_milestones(organization_id,project_id);

create table public.client_systems (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  client_id uuid not null, project_id uuid, name text not null check (char_length(btrim(name)) between 2 and 160),
  kind text not null default 'OTHER',
  status text not null default 'SETUP_REQUIRED' check (status in ('SETUP_REQUIRED','ACTIVE','PAUSED','ERROR','RETIRED')),
  environment text not null default 'production', version text, description text,
  last_checked_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade,
  foreign key (organization_id,client_id,project_id) references public.agency_projects(organization_id,client_id,id) on delete set null (project_id)
);
create index client_systems_client_idx on public.client_systems(organization_id,client_id);

create table public.agency_ai_agents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid, name text not null check (char_length(btrim(name)) between 2 and 120),
  purpose text not null, status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED')),
  instructions text not null default '', guardrails text not null default '',
  human_approval_required boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade
);

create table public.agency_approval_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid, action_type text not null, summary text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz, created_at timestamptz not null default now(),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade
);

create table public.agency_cost_entries (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid, category text not null, description text not null,
  amount numeric(14,2) not null check (amount >= 0), currency text not null check (char_length(currency)=3),
  occurred_on date not null, source text not null default 'MANUAL' check (source in ('MANUAL','METERED')),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade
);
create index agency_cost_entries_org_date_idx on public.agency_cost_entries(organization_id,occurred_on desc);

-- Client identity is deliberately separate from staff membership. No existing CRM
-- table grants access through this relation. Portal-visible records require explicit
-- publication into client_portal_updates.
create table public.client_portal_members (
  organization_id uuid not null, client_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (client_id,user_id),
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade
);
create table public.client_portal_updates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, client_id uuid not null,
  title text not null, body text not null, published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (organization_id,client_id) references public.agency_clients(organization_id,id) on delete cascade
);
create index client_portal_updates_client_idx on public.client_portal_updates(client_id,published_at desc);

create or replace function public.is_client_portal_member(target_client uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.client_portal_members where client_id=target_client and user_id=auth.uid());
$$;
revoke all on function public.is_client_portal_member(uuid) from public,anon;
grant execute on function public.is_client_portal_member(uuid) to authenticated;

alter table public.agency_clients enable row level security;
alter table public.agency_projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.client_systems enable row level security;
alter table public.agency_ai_agents enable row level security;
alter table public.agency_approval_requests enable row level security;
alter table public.agency_cost_entries enable row level security;
alter table public.client_portal_members enable row level security;
alter table public.client_portal_updates enable row level security;

grant select,insert,update on public.agency_clients,public.agency_projects,public.project_milestones,public.client_systems,public.agency_ai_agents,public.client_portal_members,public.client_portal_updates to authenticated;
grant select,insert on public.agency_approval_requests,public.agency_cost_entries to authenticated;
-- Agency delivery records are archived/retired, not hard-deleted by app roles.

create policy agency_clients_read on public.agency_clients for select to authenticated using (public.is_org_member(organization_id));
create policy agency_clients_write on public.agency_clients for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy agency_projects_read on public.agency_projects for select to authenticated using (public.is_org_member(organization_id));
create policy agency_projects_write on public.agency_projects for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy project_milestones_read on public.project_milestones for select to authenticated using (public.is_org_member(organization_id));
create policy project_milestones_write on public.project_milestones for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy client_systems_read on public.client_systems for select to authenticated using (public.is_org_member(organization_id));
create policy client_systems_write on public.client_systems for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]));
create policy agency_ai_agents_read on public.agency_ai_agents for select to authenticated using (public.is_org_member(organization_id));
create policy agency_ai_agents_write on public.agency_ai_agents for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[]));
create policy agency_approval_requests_read on public.agency_approval_requests for select to authenticated using (public.is_org_member(organization_id));
create policy agency_approval_requests_insert on public.agency_approval_requests for insert to authenticated with check (public.is_org_member(organization_id) and requested_by=auth.uid() and status='PENDING');
create policy agency_cost_entries_read on public.agency_cost_entries for select to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[]));
create policy agency_cost_entries_insert on public.agency_cost_entries for insert to authenticated with check (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[]) and created_by=auth.uid());
create policy client_portal_members_staff on public.client_portal_members for all to authenticated using (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[])) with check (public.has_org_role(organization_id,array['OWNER','ADMIN']::public.member_role[]));
create policy client_portal_members_own on public.client_portal_members for select to authenticated using (user_id=auth.uid());
create policy client_portal_updates_read on public.client_portal_updates for select to authenticated using (public.is_org_member(organization_id));
create policy client_portal_updates_write on public.client_portal_updates for insert to authenticated with check (public.has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.member_role[]) and created_by=auth.uid());

-- Portal RPCs expose only client-safe presentation fields. They do not return
-- staff identity, organization metadata, or any internal agency-client fields.
create function public.list_my_client_portal_accounts()
returns table(client_id uuid,client_name text)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.id,c.name from public.client_portal_members m
  join public.agency_clients c on c.id=m.client_id and c.organization_id=m.organization_id
  where m.user_id=auth.uid() order by c.name;
$$;
create function public.list_my_client_portal_updates(target_client uuid)
returns table(update_id uuid,client_id uuid,title text,body text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select u.id,u.client_id,u.title,u.body,u.published_at
  from public.client_portal_updates u
  where u.client_id=target_client and public.is_client_portal_member(target_client)
  order by u.published_at desc;
$$;
revoke all on function public.list_my_client_portal_accounts(),public.list_my_client_portal_updates(uuid) from public,anon;
grant execute on function public.list_my_client_portal_accounts(),public.list_my_client_portal_updates(uuid) to authenticated;

-- Decision writes are atomic, one-way, and attributed to the authenticated actor.
create function public.decide_agency_approval(target_org uuid,target_request uuid,next_status text)
returns public.agency_approval_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.agency_approval_requests;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  if next_status not in ('APPROVED','REJECTED') then raise exception 'invalid decision'; end if;
  update public.agency_approval_requests set status=next_status,decided_by=auth.uid(),decided_at=now()
  where id=target_request and organization_id=target_org and status='PENDING' returning * into saved;
  if saved.id is null then raise exception 'request unavailable or already decided'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(target_org,auth.uid(),'APPROVAL_DECIDED','agency_approval_request',target_request,jsonb_build_object('decision',next_status));
  return saved;
end $$;
revoke all on function public.decide_agency_approval(uuid,uuid,text) from public,anon;
grant execute on function public.decide_agency_approval(uuid,uuid,text) to authenticated;

create function public.grant_client_portal_access(target_org uuid,target_client uuid,target_email text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient uuid;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  if not exists(select 1 from public.agency_clients where organization_id=target_org and id=target_client) then raise exception 'client unavailable'; end if;
  select id into recipient from auth.users where lower(email)=lower(btrim(target_email)) limit 1;
  if recipient is null then raise exception 'user must create an account before portal access can be granted'; end if;
  insert into public.client_portal_members(organization_id,client_id,user_id) values(target_org,target_client,recipient)
    on conflict(client_id,user_id) do nothing;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(target_org,auth.uid(),'PORTAL_ACCESS_GRANTED','agency_client',target_client,jsonb_build_object('recipient_id',recipient));
  return recipient;
end $$;
revoke all on function public.grant_client_portal_access(uuid,uuid,text) from public,anon;
grant execute on function public.grant_client_portal_access(uuid,uuid,text) to authenticated;

create function public.list_client_portal_access(target_org uuid,target_client uuid)
returns table(member_user_id uuid,member_email text,granted_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  return query select m.user_id,u.email::text,m.created_at from public.client_portal_members m
    join auth.users u on u.id=m.user_id
    where m.organization_id=target_org and m.client_id=target_client order by m.created_at;
end $$;
create function public.revoke_client_portal_access(target_org uuid,target_client uuid,target_user uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'insufficient permission'; end if;
  delete from public.client_portal_members where organization_id=target_org and client_id=target_client and user_id=target_user;
  if not found then raise exception 'portal member unavailable'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
    values(target_org,auth.uid(),'PORTAL_ACCESS_REVOKED','agency_client',target_client,jsonb_build_object('recipient_id',target_user));
end $$;
revoke all on function public.list_client_portal_access(uuid,uuid),public.revoke_client_portal_access(uuid,uuid,uuid) from public,anon;
grant execute on function public.list_client_portal_access(uuid,uuid),public.revoke_client_portal_access(uuid,uuid,uuid) to authenticated;

alter table public.conversations add column handling_mode text not null default 'HUMAN'
  check(handling_mode in ('AI','HUMAN','PAUSED'));

create function public.set_conversation_handling(target_org uuid,target_conversation uuid,next_mode text)
returns public.conversations language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.conversations; assigned uuid;
begin
  if not public.is_org_member(target_org) then raise exception 'workspace membership required'; end if;
  if next_mode not in ('AI','HUMAN','PAUSED') then raise exception 'invalid handling mode'; end if;
  select assigned_to into assigned from public.conversations where id=target_conversation and organization_id=target_org for update;
  if not found then raise exception 'conversation unavailable'; end if;
  if assigned is not null and assigned<>auth.uid() and
     not public.has_org_role(target_org,array['OWNER','ADMIN','MANAGER']::public.member_role[])
  then raise exception 'conversation is assigned to another teammate'; end if;
  update public.conversations set handling_mode=next_mode,updated_at=now()
    where id=target_conversation and organization_id=target_org returning * into saved;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
    values(target_org,auth.uid(),'CONVERSATION_HANDLING_CHANGED','conversation',target_conversation,jsonb_build_object('mode',next_mode));
  return saved;
end $$;
revoke all on function public.set_conversation_handling(uuid,uuid,text) from public,anon;
grant execute on function public.set_conversation_handling(uuid,uuid,text) to authenticated;

alter table public.messages add column is_internal_note boolean not null default false;
create function public.add_conversation_note(target_org uuid,target_conversation uuid,note_body text)
returns public.messages language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.messages;
begin
  if not public.can_access_conversation(target_conversation,target_org) then raise exception 'conversation access denied'; end if;
  if note_body is null or char_length(btrim(note_body)) not between 1 and 5000 then raise exception 'note must contain 1 to 5000 characters'; end if;
  insert into public.messages(organization_id,conversation_id,sender_type,sender_id,body,is_internal_note)
    values(target_org,target_conversation,'HUMAN',auth.uid(),btrim(note_body),true) returning * into saved;
  update public.conversations set last_message_at=saved.created_at,updated_at=now() where id=target_conversation and organization_id=target_org;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
    values(target_org,auth.uid(),'CONVERSATION_NOTE_ADDED','conversation',target_conversation,jsonb_build_object('message_id',saved.id));
  return saved;
end $$;
revoke all on function public.add_conversation_note(uuid,uuid,text) from public,anon;
grant execute on function public.add_conversation_note(uuid,uuid,text) to authenticated;
