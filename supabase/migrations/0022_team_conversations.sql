-- Room model: channels are visible to org staff; direct messages only to members.
create table public.team_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check(kind in ('CHANNEL','DIRECT')),
  name text not null check(char_length(btrim(name)) between 1 and 100),
  topic text not null default '', created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(organization_id,id)
);
create unique index team_rooms_channel_name_idx on public.team_rooms(organization_id,lower(name)) where kind='CHANNEL';
create table public.team_room_members (
  organization_id uuid not null, room_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz, muted boolean not null default false,
  joined_at timestamptz not null default now(), primary key(room_id,user_id),
  foreign key(organization_id,room_id) references public.team_rooms(organization_id,id) on delete cascade
);
alter table public.team_messages add column room_id uuid;
alter table public.team_messages add column edited_at timestamptz;
alter table public.team_messages add column deleted_at timestamptz;
alter table public.team_messages add column reply_to uuid references public.team_messages(id) on delete set null;
alter table public.team_messages add column pinned_at timestamptz;
alter table public.team_messages add constraint team_messages_room_fk foreign key(organization_id,room_id) references public.team_rooms(organization_id,id);
create index team_messages_room_created_idx on public.team_messages(room_id,created_at desc,id desc);

insert into public.team_rooms(organization_id,kind,name)
select id,'CHANNEL','general' from public.organizations;
create function public.create_general_team_room()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.team_rooms(organization_id,kind,name) values(new.id,'CHANNEL','general');
  return new;
end $$;
create trigger create_general_team_room_after_organization
after insert on public.organizations for each row execute function public.create_general_team_room();
update public.team_messages m set room_id=r.id from public.team_rooms r
where r.organization_id=m.organization_id and r.kind='CHANNEL' and r.name='general';
alter table public.team_messages alter column room_id set not null;

create or replace function public.can_read_team_room(target_room uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.team_rooms r where r.id=target_room
    and public.is_org_member(r.organization_id)
    and (r.kind='CHANNEL' or exists(select 1 from public.team_room_members rm where rm.room_id=r.id and rm.user_id=auth.uid())));
$$;
revoke all on function public.can_read_team_room(uuid) from public,anon;
grant execute on function public.can_read_team_room(uuid) to authenticated;

alter table public.team_rooms enable row level security;
alter table public.team_room_members enable row level security;
grant select,insert on public.team_rooms to authenticated;
grant select,insert on public.team_room_members to authenticated;
grant update(last_read_at,muted) on public.team_room_members to authenticated;
create policy team_rooms_read on public.team_rooms for select to authenticated using(public.can_read_team_room(id));
create policy team_rooms_create on public.team_rooms for insert to authenticated with check(public.is_org_member(organization_id) and created_by=auth.uid() and kind='CHANNEL');
create policy team_room_members_read on public.team_room_members for select to authenticated using(public.can_read_team_room(room_id));
create policy team_room_members_join_channel on public.team_room_members for insert to authenticated with check(
  user_id=auth.uid() and public.is_org_member(organization_id) and
  exists(select 1 from public.team_rooms where id=room_id and organization_id=team_room_members.organization_id and kind='CHANNEL')
);
create policy team_room_members_own_update on public.team_room_members for update to authenticated using(user_id=auth.uid() and public.can_read_team_room(room_id)) with check(user_id=auth.uid() and public.can_read_team_room(room_id));

drop policy team_messages_read on public.team_messages;
create policy team_messages_read on public.team_messages for select to authenticated using(
  public.can_read_team_room(room_id)
);

create or replace function public.send_team_room_message(target_org uuid,target_room uuid,message_body text,target_reply uuid default null)
returns public.team_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare member_name text; saved public.team_messages;
begin
  if not public.is_org_member(target_org) or not public.can_read_team_room(target_room)
    or not exists(select 1 from public.team_rooms where id=target_room and organization_id=target_org)
  then raise exception 'room access denied'; end if;
  if message_body is null or char_length(btrim(message_body)) not between 1 and 2000 then raise exception 'message must contain 1 to 2000 characters'; end if;
  if target_reply is not null and not exists(select 1 from public.team_messages where id=target_reply and room_id=target_room)
  then raise exception 'reply target unavailable'; end if;
  if exists(select 1 from public.team_messages where room_id=target_room and sender_id=auth.uid() and created_at>now()-interval '1 second')
  then raise exception 'please wait before sending another message'; end if;
  select coalesce(nullif(btrim(p.username),''),nullif(btrim(p.full_name),''),split_part(u.email,'@',1),'Teammate') into member_name
  from auth.users u left join public.profiles p on p.id=u.id where u.id=auth.uid();
  insert into public.team_messages(organization_id,room_id,sender_id,sender_name,body,reply_to)
  values(target_org,target_room,auth.uid(),left(member_name,120),btrim(message_body),target_reply) returning * into saved;
  return saved;
end $$;
revoke all on function public.send_team_room_message(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.send_team_room_message(uuid,uuid,text,uuid) to authenticated;

create or replace function public.open_team_direct(target_org uuid,target_user uuid)
returns public.team_rooms language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.team_rooms;
begin
  if target_user=auth.uid() or not public.is_org_member(target_org)
    or not exists(select 1 from public.organization_members where organization_id=target_org and user_id=target_user)
  then raise exception 'direct message recipient unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_org::text || least(auth.uid()::text,target_user::text) || greatest(auth.uid()::text,target_user::text),0));
  select r.* into saved from public.team_rooms r
  join public.team_room_members a on a.room_id=r.id and a.user_id=auth.uid()
  join public.team_room_members b on b.room_id=r.id and b.user_id=target_user
  where r.organization_id=target_org and r.kind='DIRECT' and
    (select count(*) from public.team_room_members where room_id=r.id)=2 limit 1;
  if saved.id is not null then return saved; end if;
  insert into public.team_rooms(organization_id,kind,name,created_by)
    values(target_org,'DIRECT','Direct message',auth.uid()) returning * into saved;
  insert into public.team_room_members(organization_id,room_id,user_id)
    values(target_org,saved.id,auth.uid()),(target_org,saved.id,target_user);
  return saved;
end $$;
revoke all on function public.open_team_direct(uuid,uuid) from public,anon;
grant execute on function public.open_team_direct(uuid,uuid) to authenticated;

create or replace function public.edit_team_message(target_org uuid,target_message uuid,next_body text)
returns public.team_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.team_messages;
begin
  if next_body is null or char_length(btrim(next_body)) not between 1 and 2000 then raise exception 'invalid message'; end if;
  update public.team_messages set body=btrim(next_body),edited_at=now()
  where id=target_message and organization_id=target_org and sender_id=auth.uid() and deleted_at is null
    and (room_id is null or public.can_read_team_room(room_id)) returning * into saved;
  if saved.id is null then raise exception 'message unavailable'; end if;
  return saved;
end $$;
create or replace function public.delete_team_message(target_org uuid,target_message uuid)
returns public.team_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.team_messages;
begin
  -- The base team_messages table requires a non-empty body. Keep a tombstone
  -- rather than hard-deleting so replies retain a stable reference.
  update public.team_messages set body='[deleted]',deleted_at=now()
  where id=target_message and organization_id=target_org and sender_id=auth.uid() and deleted_at is null
    and (room_id is null or public.can_read_team_room(room_id)) returning * into saved;
  if saved.id is null then raise exception 'message unavailable'; end if;
  return saved;
end $$;
revoke all on function public.edit_team_message(uuid,uuid,text),public.delete_team_message(uuid,uuid) from public,anon;
grant execute on function public.edit_team_message(uuid,uuid,text),public.delete_team_message(uuid,uuid) to authenticated;

-- Preserve compatibility for existing clients using the original General RPC.
create or replace function public.send_team_message(target_org uuid,message_body text)
returns public.team_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare general_room uuid;
begin
  select id into general_room from public.team_rooms where organization_id=target_org and kind='CHANNEL' and name='general';
  if general_room is null then raise exception 'general channel unavailable'; end if;
  return public.send_team_room_message(target_org,general_room,message_body,null);
end $$;

-- Keep the existing publication. Supabase Realtime evaluates row SELECT RLS for
-- every subscriber; the app additionally filters subscriptions by room_id.

create function public.list_organization_roster(target_org uuid)
returns table(member_user_id uuid,member_role public.member_role,display_name text,member_email text,joined_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_org_member(target_org) then raise exception 'workspace membership required'; end if;
  return query select m.user_id,m.role,
    coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),split_part(u.email,'@',1),'Teammate'),
    u.email::text,m.created_at
  from public.organization_members m
  join auth.users u on u.id=m.user_id
  left join public.profiles p on p.id=m.user_id
  where m.organization_id=target_org order by m.created_at;
end $$;
revoke all on function public.list_organization_roster(uuid) from public,anon;
grant execute on function public.list_organization_roster(uuid) to authenticated;

create function public.team_room_unread_counts(target_org uuid)
returns table(room_id uuid,unread_count bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_org_member(target_org) then raise exception 'workspace membership required'; end if;
  return query select r.id,count(m.id) from public.team_rooms r
    left join public.team_room_members receipt on receipt.room_id=r.id and receipt.user_id=auth.uid()
    left join public.team_messages m on m.room_id=r.id and m.sender_id is distinct from auth.uid()
      and (receipt.last_read_at is null or m.created_at>receipt.last_read_at)
    where r.organization_id=target_org and public.can_read_team_room(r.id)
    group by r.id;
end $$;
revoke all on function public.team_room_unread_counts(uuid) from public,anon;
grant execute on function public.team_room_unread_counts(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='team_rooms') then
    alter publication supabase_realtime add table public.team_rooms;
  end if;
end $$;
