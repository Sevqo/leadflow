-- An invitation grants initial membership only. It cannot overwrite an
-- existing role, and possession of a link is insufficient without a verified
-- account whose current Auth email matches the invited address.
create or replace function public.accept_invitation(invite_token text)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare selected_invitation public.invitations; verified_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select lower(email) into verified_email from auth.users
    where id=auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'confirm your email before accepting an invitation'; end if;
  select * into selected_invitation from public.invitations
    where token_hash=encode(digest(invite_token,'sha256'),'hex')
      and accepted_at is null and expires_at>now()
    for update;
  if selected_invitation.id is null then raise exception 'invitation is invalid or expired'; end if;
  if lower(selected_invitation.email)<>verified_email then raise exception 'invitation email does not match signed-in user'; end if;
  if exists(select 1 from public.organization_members where organization_id=selected_invitation.organization_id and user_id=auth.uid())
  then raise exception 'already a member of this workspace'; end if;
  insert into public.organization_members(organization_id,user_id,role)
    values(selected_invitation.organization_id,auth.uid(),selected_invitation.role);
  update public.invitations set accepted_at=now() where id=selected_invitation.id;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id)
    values(selected_invitation.organization_id,auth.uid(),'invitation_accepted','invitation',selected_invitation.id);
  return selected_invitation.organization_id;
end $$;
revoke all on function public.accept_invitation(text) from public,anon;
grant execute on function public.accept_invitation(text) to authenticated;

create function public.prevent_last_owner_demotion()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.role='OWNER' and new.role<>'OWNER' then
    perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text,0));
  end if;
  if old.role='OWNER' and new.role<>'OWNER' and not exists(
    select 1 from public.organization_members
    where organization_id=old.organization_id and user_id<>old.user_id and role='OWNER'
  ) then raise exception 'a workspace must keep at least one owner'; end if;
  return new;
end $$;
create trigger prevent_last_owner_demotion_before_update
before update of role on public.organization_members
for each row execute function public.prevent_last_owner_demotion();
