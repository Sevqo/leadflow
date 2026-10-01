-- Private, organization-scoped staff chat. Customer conversations remain separate.
create table public.team_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index team_messages_organization_created_idx
  on public.team_messages(organization_id, created_at desc, id desc);

create table public.team_chat_reads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.team_messages enable row level security;
alter table public.team_chat_reads enable row level security;

revoke all on public.team_messages, public.team_chat_reads from anon, authenticated;
grant select on public.team_messages to authenticated;
grant select, insert, update on public.team_chat_reads to authenticated;

create policy team_messages_read on public.team_messages for select to authenticated
  using (public.is_org_member(organization_id));
create policy team_chat_reads_own on public.team_chat_reads for all to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

create function public.send_team_message(target_org uuid, message_body text)
returns public.team_messages language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  member_name text;
  saved public.team_messages;
begin
  if auth.uid() is null or not public.is_org_member(target_org) then
    raise exception 'workspace membership required';
  end if;
  if message_body is null or char_length(btrim(message_body)) not between 1 and 2000 then
    raise exception 'message must contain 1 to 2000 characters';
  end if;
  if exists (
    select 1 from public.team_messages
    where organization_id = target_org and sender_id = auth.uid()
      and created_at > now() - interval '1 second'
  ) then
    raise exception 'please wait before sending another message';
  end if;
  select coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.full_name), ''),
    split_part(u.email, '@', 1), 'Teammate') into member_name
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
  insert into public.team_messages(organization_id, sender_id, sender_name, body)
    values(target_org, auth.uid(), left(member_name, 120), btrim(message_body))
    returning * into saved;
  return saved;
end $$;

revoke all on function public.send_team_message(uuid, text) from public, anon;
grant execute on function public.send_team_message(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;
