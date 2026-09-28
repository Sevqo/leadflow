-- Keep cryptographic helpers callable from security-definer functions with a hardened search path.
create or replace function public.create_lead_source(target_org uuid,source_name text,source_platform text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare token text; created public.lead_sources;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'forbidden'; end if;
  if length(trim(source_name)) not between 2 and 80 or length(trim(source_platform)) not between 2 and 80 then raise exception 'invalid source'; end if;
  token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.lead_sources(organization_id,name,platform,secret_hash,created_by) values(target_org,trim(source_name),trim(source_platform),encode(extensions.digest(token,'sha256'),'hex'),auth.uid()) returning * into created;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata) values(target_org,auth.uid(),'lead_source_created','lead_source',created.id,jsonb_build_object('platform',created.platform));
  return jsonb_build_object('source',to_jsonb(created)-'secret_hash','token',token);
end $$;
revoke all on function public.create_lead_source(uuid,text,text) from public;
grant execute on function public.create_lead_source(uuid,text,text) to authenticated;

create or replace function public.rotate_lead_source_key(target_org uuid,target_source uuid)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare token text;
begin
  if not public.has_org_role(target_org,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'forbidden'; end if;
  token:=encode(extensions.gen_random_bytes(24),'hex');
  update public.lead_sources set secret_hash=encode(extensions.digest(token,'sha256'),'hex'),updated_at=now() where id=target_source and organization_id=target_org;
  if not found then raise exception 'source not found'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id) values(target_org,auth.uid(),'lead_source_key_rotated','lead_source',target_source);
  return token;
end $$;
revoke all on function public.rotate_lead_source_key(uuid,uuid) from public;
grant execute on function public.rotate_lead_source_key(uuid,uuid) to authenticated;
