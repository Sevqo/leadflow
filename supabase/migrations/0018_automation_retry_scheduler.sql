-- Secure, reproducible automation retry scheduling via Supabase Cron, pg_net, and Vault.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.configure_automation_retry_scheduler(project_url text,cron_secret text)
returns bigint
language plpgsql
security definer
set search_path=public,extensions,vault,cron,pg_catalog
as $$
declare
  normalized_url text:=rtrim(trim(project_url),'/');
  project_secret_id uuid;
  cron_secret_id uuid;
  existing_job record;
  scheduled_job_id bigint;
begin
  if normalized_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'project_url must be an https Supabase project URL';
  end if;
  if length(cron_secret)<32 then
    raise exception 'cron_secret must be at least 32 characters';
  end if;

  select id into project_secret_id from vault.secrets where name='nexara_project_url';
  if project_secret_id is null then
    perform vault.create_secret(normalized_url,'nexara_project_url','Nexara Edge Function base URL');
  else
    perform vault.update_secret(project_secret_id,normalized_url,null,'Nexara Edge Function base URL');
  end if;

  select id into cron_secret_id from vault.secrets where name='nexara_automation_cron_secret';
  if cron_secret_id is null then
    perform vault.create_secret(cron_secret,'nexara_automation_cron_secret','Shared secret for automation retry invocations');
  else
    perform vault.update_secret(cron_secret_id,cron_secret,null,'Shared secret for automation retry invocations');
  end if;

  for existing_job in select jobid from cron.job where jobname='nexara-automation-retry' loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  select cron.schedule(
    'nexara-automation-retry',
    '* * * * *',
    $schedule$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='nexara_project_url') || '/functions/v1/automation-retry',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='nexara_automation_cron_secret')
        ),
        body := jsonb_build_object('scheduledAt',now()),
        timeout_milliseconds := 15000
      );
    $schedule$
  ) into scheduled_job_id;

  return scheduled_job_id;
end $$;

create or replace function public.disable_automation_retry_scheduler()
returns integer
language plpgsql
security definer
set search_path=public,cron,pg_catalog
as $$
declare
  existing_job record;
  removed integer:=0;
begin
  for existing_job in select jobid from cron.job where jobname='nexara-automation-retry' loop
    perform cron.unschedule(existing_job.jobid);
    removed:=removed+1;
  end loop;
  return removed;
end $$;

revoke all on function public.configure_automation_retry_scheduler(text,text) from public,anon,authenticated;
revoke all on function public.disable_automation_retry_scheduler() from public,anon,authenticated;
grant execute on function public.configure_automation_retry_scheduler(text,text) to service_role;
grant execute on function public.disable_automation_retry_scheduler() to service_role;
