-- Run only against a disposable migrated Supabase database: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users(id,email,aud,role,encrypted_password,email_confirmed_at) values
('31000000-0000-0000-0000-000000000001','agency-a-owner@example.test','authenticated','authenticated','',now()),
('31000000-0000-0000-0000-000000000002','agency-a-agent@example.test','authenticated','authenticated','',now()),
('31000000-0000-0000-0000-000000000003','agency-a-other@example.test','authenticated','authenticated','',now()),
('32000000-0000-0000-0000-000000000001','agency-b-owner@example.test','authenticated','authenticated','',now()),
('33000000-0000-0000-0000-000000000001','client-a@example.test','authenticated','authenticated','',now());
insert into public.organizations(id,name) values
('a1000000-0000-0000-0000-000000000001','Agency A'),
('b1000000-0000-0000-0000-000000000001','Agency B');
insert into public.organization_members(organization_id,user_id,role) values
('a1000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','OWNER'),
('a1000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002','AGENT'),
('a1000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000003','AGENT'),
('b1000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','OWNER');
insert into public.agency_clients(id,organization_id,name) values
('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Client A'),
('b2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Client B');
insert into public.client_portal_members(organization_id,client_id,user_id) values
('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001');
insert into public.client_portal_updates(organization_id,client_id,title,body) values
('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Published A','Visible to A'),
('b1000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','Published B','Visible to B');
insert into public.agency_cost_entries(organization_id,client_id,category,description,amount,currency,occurred_on) values
('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Hosting','Private cost',100,'KES',current_date);
insert into public.team_rooms(id,organization_id,kind,name) values
('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','DIRECT','Private discussion');
insert into public.team_room_members(organization_id,room_id,user_id) values
('a1000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001'),
('a1000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002');
insert into public.team_messages(id,organization_id,room_id,sender_id,sender_name,body) values
('a4000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Owner','Private message');
insert into public.invitations(organization_id,email,role,token_hash,invited_by,expires_at) values
('a1000000-0000-0000-0000-000000000001','agency-a-agent@example.test','ADMIN',encode(digest('role-overwrite-fixture','sha256'),'hex'),'31000000-0000-0000-0000-000000000001',now()+interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.agency_clients),1::bigint,'staff agent sees only own organization clients');
select is((select count(*) from public.agency_cost_entries),0::bigint,'staff agent cannot see private costs');
select isnt(public.has_org_role('a1000000-0000-0000-0000-000000000001',array['OWNER','ADMIN']::public.member_role[]),true,'agent cannot approve privileged actions');
select throws_ok($$select public.accept_invitation('role-overwrite-fixture')$$,'P0001','already a member of this workspace','an invitation cannot replace an existing member role');
select is((select role::text from public.organization_members where organization_id='a1000000-0000-0000-0000-000000000001' and user_id='31000000-0000-0000-0000-000000000002'),'AGENT','existing agent role remains unchanged');

select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.agency_cost_entries),1::bigint,'owner sees private costs');
select is((select count(*) from public.client_portal_updates),1::bigint,'owner sees own published updates');
select is((select count(*) from public.team_rooms where kind='DIRECT'),1::bigint,'direct participant sees the room');
select is((select count(*) from public.list_client_portal_access('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001')),1::bigint,'owner can inspect explicitly granted portal access');
select is((select count(*) from public.list_organization_roster('a1000000-0000-0000-0000-000000000001')),3::bigint,'roster RPC returns workspace staff');
select throws_ok($$update public.organization_members set role='AGENT' where organization_id='a1000000-0000-0000-0000-000000000001' and user_id='31000000-0000-0000-0000-000000000001'$$,'P0001','a workspace must keep at least one owner','the last workspace owner cannot be demoted');
select is((select body from public.delete_team_message('a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001')),'[deleted]','message deletion preserves a constraint-safe tombstone');
select ok((select deleted_at is not null from public.team_messages where id='a4000000-0000-0000-0000-000000000001'),'deleted message receives a timestamp');
insert into public.agency_projects(id,organization_id,client_id,name) values
('a5000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','Delivery project');
insert into public.tasks(organization_id,project_id,created_by,title) values
('a1000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Project task');
select is((select count(*) from public.tasks where project_id='a5000000-0000-0000-0000-000000000001'),1::bigint,'existing Tasks system can attach delivery work to projects');

select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.team_rooms where kind='DIRECT'),0::bigint,'same-workspace nonparticipant cannot see private room');
select is((select count(*) from public.team_messages where room_id='a3000000-0000-0000-0000-000000000001'),0::bigint,'same-workspace nonparticipant cannot read direct-message history');

select set_config('request.jwt.claim.sub','33000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.agency_clients),0::bigint,'portal user cannot read internal client record');
select is((select count(*) from public.agency_cost_entries),0::bigint,'portal user cannot read costs');
select is((select count(*) from public.client_portal_updates),0::bigint,'portal user cannot read update rows with staff metadata directly');
select is((select count(*) from public.list_my_client_portal_updates('a2000000-0000-0000-0000-000000000001')),1::bigint,'portal user sees only their client-safe published updates through RPC');

select * from finish();
rollback;
